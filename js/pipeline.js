// =============================================================================
// Pipeline.js - Visual Pipeline Editor
// =============================================================================

const PipelineEditor = (() => {

  let state = {
    blocks: [],
    connections: [],
    selectedBlock: null,
    dragging: null,
    connecting: null,
    panning: false,
    panStart: null,
    offset: { x: 0, y: 0 },
    zoom: 1,
    canvas: null,
    svg: null,
    blocksContainer: null,
    blockResults: {},
    onBlockSelect: null,
    onPipelineChange: null,
    onRunComplete: null,
    onBlockContextMenu: null
  };

  const MAX_HISTORY = 50;
  let history = [];
  let historyIndex = -1;
  let _skipHistory = false;

  const BLOCK_WIDTH = 180;
  const BLOCK_HEIGHT = 'auto';
  const PORT_RADIUS = 7;
  const PORT_GAP = 28;

  // ─── Initialization ───────────────────────────────────────────────────────

  function init(canvasId, options) {
    const container = document.getElementById(canvasId);
    if (!container) return;

    state.canvas = container;
    state.onBlockSelect = options?.onBlockSelect;
    state.onPipelineChange = options?.onPipelineChange;
    state.onRunComplete = options?.onRunComplete;
    state.onBlockContextMenu = options?.onBlockContextMenu;

    // Create SVG layer for connections
    state.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    state.svg.classList.add('pipeline-svg');
    state.svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;';
    container.appendChild(state.svg);

    // Create blocks container
    state.blocksContainer = document.createElement('div');
    state.blocksContainer.classList.add('pipeline-blocks');
    state.blocksContainer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:2;';
    container.appendChild(state.blocksContainer);

    // Temp connection line
    state.tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    state.tempLine.setAttribute('class', 'temp-connection');
    state.tempLine.setAttribute('fill', 'none');
    state.tempLine.setAttribute('stroke', '#4FC3F7');
    state.tempLine.setAttribute('stroke-width', '2');
    state.tempLine.setAttribute('stroke-dasharray', '6,4');
    state.tempLine.style.display = 'none';
    state.svg.appendChild(state.tempLine);

    // Events
    container.addEventListener('mousedown', onCanvasMouseDown);
    container.addEventListener('mousemove', onCanvasMouseMove);
    container.addEventListener('mouseup', onCanvasMouseUp);
    container.addEventListener('wheel', onCanvasWheel, { passive: false });
    container.addEventListener('dblclick', onCanvasDblClick);

    // Drop zone for sidebar blocks
    container.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    container.addEventListener('drop', onDrop);

    // Keyboard
    document.addEventListener('keydown', onKeyDown);

    // Tooltip
    createTooltip();

    // Initialise history with the empty canvas snapshot
    saveToHistory();
  }

  // ─── Block Management ─────────────────────────────────────────────────────

  function addBlock(type, x, y) {
    const block = BlockRegistry.createBlockInstance(type, x, y);
    state.blocks.push(block);
    renderBlock(block);
    notifyChange();
    return block;
  }

  function removeBlock(blockId) {
    // Remove connections
    state.connections = state.connections.filter(
      c => c.fromBlock !== blockId && c.toBlock !== blockId
    );
    state.blocks = state.blocks.filter(b => b.id !== blockId);

    // Remove DOM element
    const el = document.getElementById(blockId);
    if (el) el.remove();

    if (state.selectedBlock === blockId) {
      state.selectedBlock = null;
      if (state.onBlockSelect) state.onBlockSelect(null);
    }

    delete state.blockResults[blockId];
    renderConnections();
    notifyChange();
  }

  function getBlock(blockId) {
    return state.blocks.find(b => b.id === blockId);
  }

  function updateBlockConfig(blockId, config) {
    const block = getBlock(blockId);
    if (block) {
      block.config = { ...block.config, ...config };
      notifyChange();
    }
  }

  // ─── Connection Management ────────────────────────────────────────────────

  function addConnection(fromBlock, fromPort, toBlock, toPort) {
    // Validate
    if (fromBlock === toBlock) return false;

    // Check if connection already exists
    const exists = state.connections.some(
      c => c.fromBlock === fromBlock && c.fromPort === fromPort
        && c.toBlock === toBlock && c.toPort === toPort
    );
    if (exists) return false;

    // Check port type compatibility
    const fromDef = getBlock(fromBlock)?._def;
    const toDef = getBlock(toBlock)?._def;
    if (!fromDef || !toDef) return false;

    const outPort = fromDef.outputs[fromPort];
    const inPort = toDef.inputs[toPort];
    if (!outPort || !inPort) return false;

    // Remove existing connection to this input port
    state.connections = state.connections.filter(
      c => !(c.toBlock === toBlock && c.toPort === toPort)
    );

    state.connections.push({ fromBlock, fromPort, toBlock, toPort });
    renderConnections();
    notifyChange();
    return true;
  }

  function removeConnection(index) {
    state.connections.splice(index, 1);
    renderConnections();
    notifyChange();
  }

  // ─── Rendering ────────────────────────────────────────────────────────────

  // ─── Tooltip ──────────────────────────────────────────────────────────────

  let _tooltip = null;

  function createTooltip() {
    if (document.getElementById('sf-tooltip')) {
      _tooltip = document.getElementById('sf-tooltip');
      return;
    }
    _tooltip = document.createElement('div');
    _tooltip.id = 'sf-tooltip';
    document.body.appendChild(_tooltip);
  }

  function showTooltip(html, event) {
    if (!_tooltip) return;
    _tooltip.innerHTML = html;
    positionTooltip(event);
    _tooltip.classList.add('visible');
  }

  function positionTooltip(event) {
    if (!_tooltip) return;
    const margin = 16;
    const tw = _tooltip.offsetWidth || 220;
    const th = _tooltip.offsetHeight || 80;
    let x = event.clientX + margin;
    let y = event.clientY + margin;
    if (x + tw > window.innerWidth - 8) x = event.clientX - tw - margin;
    if (y + th > window.innerHeight - 8) y = event.clientY - th - margin;
    _tooltip.style.left = x + 'px';
    _tooltip.style.top = y + 'px';
  }

  function hideTooltip() {
    if (!_tooltip) return;
    _tooltip.classList.remove('visible');
  }

  function blockTooltipHtml(def) {
    return `
      <div class="tt-title">
        <span>${def.icon || ''}</span>
        <span>${def.name}</span>
        <span class="tt-badge">${def.category || ''}</span>
      </div>
      <div class="tt-body">${def.description || ''}</div>
    `;
  }

  function portTooltipHtml(port, dir) {
    const badgeClass = dir === 'output' ? 'tt-out' : '';
    const optBadge = port.optional
      ? '<span class="tt-badge tt-opt">optional</span>' : '';
    return `
      <div class="tt-title">
        <span>${port.label}</span>
        <span class="tt-badge ${badgeClass}">${dir}</span>
        ${optBadge}
      </div>
      <div class="tt-body">${port.description || ''}</div>
      <div class="tt-type">data type: ${port.type}</div>
    `;
  }

  function connTooltipHtml(conn) {
    const fromBlock = getBlock(conn.fromBlock);
    const toBlock = getBlock(conn.toBlock);
    if (!fromBlock || !toBlock) return '';
    const fromDef = fromBlock._def;
    const toDef = toBlock._def;
    const outPort = fromDef.outputs[conn.fromPort];
    const inPort = toDef.inputs[conn.toPort];
    return `
      <div class="tt-title">
        <span>Connection</span>
        <span class="tt-badge tt-conn">${outPort ? outPort.type : 'data'}</span>
      </div>
      <div class="tt-body">
        <b>${fromDef.icon} ${fromDef.name}</b> &rarr; ${outPort ? outPort.label : '?'}<br>
        &nbsp;&nbsp;&darr;<br>
        <b>${toDef.icon} ${toDef.name}</b> &larr; ${inPort ? inPort.label : '?'}
      </div>
      <div class="tt-hint">Click to remove this connection</div>
    `;
  }

  function renderBlock(block) {
    const def = block._def || BlockRegistry.getBlockType(block.type);
    if (!def) return;

    const el = document.createElement('div');
    el.id = block.id;
    el.className = 'pipeline-block';
    el.style.left = block.x + 'px';
    el.style.top = block.y + 'px';
    el.style.width = BLOCK_WIDTH + 'px';
    el.setAttribute('data-type', block.type);
    el.setAttribute('draggable', 'false');

    // Header
    const header = document.createElement('div');
    header.className = 'block-header';
    header.style.backgroundColor = def.color || '#666';
    header.innerHTML = `
      <span class="block-icon">${def.icon || '⬜'}</span>
      <span class="block-name">${def.name}</span>
      <button class="block-remove" title="Remove block">&times;</button>
    `;
    el.appendChild(header);

    // Status indicator
    const status = document.createElement('div');
    status.className = 'block-status';
    status.id = `${block.id}-status`;
    el.appendChild(status);

    // Ports
    const portsContainer = document.createElement('div');
    portsContainer.className = 'block-ports';

    // Input ports
    const inputCol = document.createElement('div');
    inputCol.className = 'ports-column ports-input';
    for (let i = 0; i < def.inputs.length; i++) {
      const port = def.inputs[i];
      const portEl = document.createElement('div');
      portEl.className = 'block-port input-port';
      portEl.setAttribute('data-block', block.id);
      portEl.setAttribute('data-port-index', i);
      portEl.setAttribute('data-port-dir', 'input');
      portEl.setAttribute('data-port-type', port.type);
      portEl.innerHTML = `<span class="port-dot"></span><span class="port-label">${port.label}</span>`;
      inputCol.appendChild(portEl);
    }
    portsContainer.appendChild(inputCol);

    // Output ports
    const outputCol = document.createElement('div');
    outputCol.className = 'ports-column ports-output';
    for (let i = 0; i < def.outputs.length; i++) {
      const port = def.outputs[i];
      const portEl = document.createElement('div');
      portEl.className = 'block-port output-port';
      portEl.setAttribute('data-block', block.id);
      portEl.setAttribute('data-port-index', i);
      portEl.setAttribute('data-port-dir', 'output');
      portEl.setAttribute('data-port-type', port.type);
      portEl.innerHTML = `<span class="port-label">${port.label}</span><span class="port-dot"></span>`;
      outputCol.appendChild(portEl);
    }
    portsContainer.appendChild(outputCol);

    el.appendChild(portsContainer);

    // Mini preview area
    const preview = document.createElement('div');
    preview.className = 'block-preview';
    preview.id = `${block.id}-preview`;
    el.appendChild(preview);

    // Model badge (visible only for classifier blocks)
    if (def.category === 'classifier') {
      const badge = document.createElement('div');
      badge.className = 'block-model-badge no-model';
      badge.id = `${block.id}-model-badge`;
      badge.title = 'No trained model — click Train first';
      badge.textContent = '⚠ No model';
      el.appendChild(badge);
    }

    // Event handlers
    header.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('block-remove')) return;
      e.stopPropagation();
      startDragging(block.id, e);
    });

    header.querySelector('.block-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      removeBlock(block.id);
    });

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      selectBlock(block.id);
    });

    // Port interaction
    el.querySelectorAll('.port-dot').forEach(dot => {
      dot.addEventListener('mousedown', onPortMouseDown);
    });

    // ── Tooltip: block header ────────────────────────────────────────────────
    header.addEventListener('mouseenter', (e) => showTooltip(blockTooltipHtml(def), e));
    header.addEventListener('mousemove', positionTooltip);
    header.addEventListener('mouseleave', hideTooltip);

    // ── Tooltip: input ports ─────────────────────────────────────────────────
    el.querySelectorAll('.input-port').forEach((portEl, i) => {
      const port = def.inputs[i];
      if (!port) return;
      portEl.addEventListener('mouseenter', (e) => { e.stopPropagation(); showTooltip(portTooltipHtml(port, 'input'), e); });
      portEl.addEventListener('mousemove', (e) => { e.stopPropagation(); positionTooltip(e); });
      portEl.addEventListener('mouseleave', hideTooltip);
    });

    // ── Tooltip: output ports ────────────────────────────────────────────────
    el.querySelectorAll('.output-port').forEach((portEl, i) => {
      const port = def.outputs[i];
      if (!port) return;
      portEl.addEventListener('mouseenter', (e) => { e.stopPropagation(); showTooltip(portTooltipHtml(port, 'output'), e); });
      portEl.addEventListener('mousemove', (e) => { e.stopPropagation(); positionTooltip(e); });
      portEl.addEventListener('mouseleave', hideTooltip);
    });

    // Context menu (right-click)
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (state.onBlockContextMenu) state.onBlockContextMenu(block, e.clientX, e.clientY);
    });

    state.blocksContainer.appendChild(el);
  }

  function updateModelBadge(blockId, isTrained, runMode) {
    const badge = document.getElementById(`${blockId}-model-badge`);
    if (!badge) return;
    if (isTrained) {
      badge.className = 'block-model-badge trained';
      badge.textContent = '✓ Trained';
      badge.title = 'Model is trained and ready for inference';
    } else if (runMode === 'infer') {
      badge.className = 'block-model-badge no-model';
      badge.textContent = '⚠ No model';
      badge.title = 'No trained model — run Train first';
    } else {
      badge.className = 'block-model-badge no-model';
      badge.textContent = '⚠ No model';
      badge.title = 'No trained model yet';
    }
  }

  function renderConnections() {
    // Remove existing connection paths (keep tempLine)
    const paths = state.svg.querySelectorAll('.connection-path');
    paths.forEach(p => p.remove());

    // Remove existing hit areas
    const hitAreas = state.svg.querySelectorAll('.connection-hit');
    hitAreas.forEach(h => h.remove());

    for (let i = 0; i < state.connections.length; i++) {
      const conn = state.connections[i];
      const points = getConnectionPoints(conn);
      if (!points) continue;

      const d = bezierPath(points.x1, points.y1, points.x2, points.y2);

      // Visible path
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'connection-path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#4FC3F7');
      path.setAttribute('stroke-width', '2.5');
      path.setAttribute('opacity', '0.8');
      state.svg.insertBefore(path, state.tempLine);

      // Invisible wider hit area for easier clicking
      const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hitPath.setAttribute('class', 'connection-hit');
      hitPath.setAttribute('d', d);
      hitPath.setAttribute('fill', 'none');
      hitPath.setAttribute('stroke', 'transparent');
      hitPath.setAttribute('stroke-width', '12');
      hitPath.style.pointerEvents = 'stroke';
      hitPath.style.cursor = 'pointer';
      hitPath.addEventListener('click', (e) => {
        e.stopPropagation();
        removeConnection(i);
      });
      hitPath.addEventListener('mouseenter', (e) => {
        path.setAttribute('stroke', '#FF5252');
        path.setAttribute('stroke-width', '3');
        showTooltip(connTooltipHtml(conn), e);
      });
      hitPath.addEventListener('mousemove', positionTooltip);
      hitPath.addEventListener('mouseleave', () => {
        path.setAttribute('stroke', '#4FC3F7');
        path.setAttribute('stroke-width', '2.5');
        hideTooltip();
      });
      state.svg.insertBefore(hitPath, state.tempLine);
    }
  }

  function getConnectionPoints(conn) {
    const fromEl = document.getElementById(conn.fromBlock);
    const toEl = document.getElementById(conn.toBlock);
    if (!fromEl || !toEl) return null;

    const canvasRect = state.canvas.getBoundingClientRect();

    const fromPorts = fromEl.querySelectorAll('.output-port .port-dot');
    const toPorts = toEl.querySelectorAll('.input-port .port-dot');

    const fromDot = fromPorts[conn.fromPort];
    const toDot = toPorts[conn.toPort];
    if (!fromDot || !toDot) return null;

    const fromRect = fromDot.getBoundingClientRect();
    const toRect = toDot.getBoundingClientRect();

    return {
      x1: fromRect.left + fromRect.width / 2 - canvasRect.left + state.canvas.scrollLeft,
      y1: fromRect.top + fromRect.height / 2 - canvasRect.top + state.canvas.scrollTop,
      x2: toRect.left + toRect.width / 2 - canvasRect.left + state.canvas.scrollLeft,
      y2: toRect.top + toRect.height / 2 - canvasRect.top + state.canvas.scrollTop
    };
  }

  function bezierPath(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1) * 0.5;
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  }

  function selectBlock(blockId) {
    // Deselect previous
    document.querySelectorAll('.pipeline-block.selected').forEach(el => el.classList.remove('selected'));

    state.selectedBlock = blockId;
    const el = document.getElementById(blockId);
    if (el) el.classList.add('selected');

    if (state.onBlockSelect) {
      const block = getBlock(blockId);
      state.onBlockSelect(block);
    }
  }

  // ─── Connection Validation Visual Feedback ────────────────────────────────

  function highlightCompatiblePorts(sourceType, sourceDir) {
    document.querySelectorAll('.block-port').forEach(portEl => {
      const dir = portEl.classList.contains('input-port') ? 'input' : 'output';
      if (dir === sourceDir) return; // Can't connect same direction
      const portType = portEl.getAttribute('data-port-type');
      const isCompatible = portType === sourceType || sourceType === 'any' || portType === 'any';
      portEl.classList.add(isCompatible ? 'port-compatible' : 'port-incompatible');
    });
  }

  function clearPortHighlights() {
    document.querySelectorAll('.block-port').forEach(portEl => {
      portEl.classList.remove('port-compatible', 'port-incompatible');
    });
  }

  // ─── Port Connection Logic ────────────────────────────────────────────────

  function onPortMouseDown(e) {
    e.stopPropagation();
    e.preventDefault();

    const portEl = e.target.closest('.block-port');
    if (!portEl) return;

    const blockId = portEl.getAttribute('data-block');
    const portIndex = parseInt(portEl.getAttribute('data-port-index'));
    const portDir = portEl.getAttribute('data-port-dir');

    if (portDir === 'output') {
      state.connecting = {
        fromBlock: blockId,
        fromPort: portIndex,
        startX: e.clientX,
        startY: e.clientY
      };
      state.tempLine.style.display = 'block';
      const srcType = portEl.getAttribute('data-port-type') || 'any';
      highlightCompatiblePorts(srcType, 'output');
    } else if (portDir === 'input') {
      // Check if there's an existing connection to this input - if so, start reconnecting
      const existing = state.connections.findIndex(
        c => c.toBlock === blockId && c.toPort === portIndex
      );
      if (existing >= 0) {
        const conn = state.connections[existing];
        state.connecting = {
          fromBlock: conn.fromBlock,
          fromPort: conn.fromPort,
          startX: e.clientX,
          startY: e.clientY
        };
        state.connections.splice(existing, 1);
        renderConnections();
        state.tempLine.style.display = 'block';
        // Highlight based on the original output port type
        const fromBlock = getBlock(conn.fromBlock);
        const srcType = (fromBlock?._def?.outputs[conn.fromPort]?.type) || 'any';
        highlightCompatiblePorts(srcType, 'output');
      } else {
        // Start reverse connection
        state.connecting = {
          toBlock: blockId,
          toPort: portIndex,
          startX: e.clientX,
          startY: e.clientY,
          reverse: true
        };
        state.tempLine.style.display = 'block';
        const srcType = portEl.getAttribute('data-port-type') || 'any';
        highlightCompatiblePorts(srcType, 'input');
      }
    }
  }

  // ─── Block Dragging ───────────────────────────────────────────────────────

  function startDragging(blockId, e) {
    const block = getBlock(blockId);
    if (!block) return;

    state.dragging = {
      blockId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startBlockX: block.x,
      startBlockY: block.y
    };

    selectBlock(blockId);
  }

  // ─── Canvas Events ────────────────────────────────────────────────────────

  function onCanvasMouseDown(e) {
    if (e.target === state.canvas || e.target === state.blocksContainer) {
      // Deselect
      state.selectedBlock = null;
      document.querySelectorAll('.pipeline-block.selected').forEach(el => el.classList.remove('selected'));
      if (state.onBlockSelect) state.onBlockSelect(null);

      // Start panning
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        state.panning = true;
        state.panStart = { x: e.clientX, y: e.clientY, scrollLeft: state.canvas.scrollLeft, scrollTop: state.canvas.scrollTop };
      }
    }
  }

  function onCanvasMouseMove(e) {
    // Dragging a block
    if (state.dragging) {
      const d = state.dragging;
      const block = getBlock(d.blockId);
      if (!block) return;

      const dx = e.clientX - d.startMouseX;
      const dy = e.clientY - d.startMouseY;
      block.x = Math.max(0, d.startBlockX + dx);
      block.y = Math.max(0, d.startBlockY + dy);

      const el = document.getElementById(block.id);
      if (el) {
        el.style.left = block.x + 'px';
        el.style.top = block.y + 'px';
      }
      renderConnections();
    }

    // Drawing connection
    if (state.connecting) {
      const canvasRect = state.canvas.getBoundingClientRect();
      let x1, y1, x2, y2;

      if (state.connecting.reverse) {
        x2 = e.clientX - canvasRect.left + state.canvas.scrollLeft;
        y2 = e.clientY - canvasRect.top + state.canvas.scrollTop;
        // Find start port position
        const toEl = document.getElementById(state.connecting.toBlock);
        if (toEl) {
          const dot = toEl.querySelectorAll('.input-port .port-dot')[state.connecting.toPort];
          if (dot) {
            const dotRect = dot.getBoundingClientRect();
            x1 = dotRect.left + dotRect.width / 2 - canvasRect.left + state.canvas.scrollLeft;
            y1 = dotRect.top + dotRect.height / 2 - canvasRect.top + state.canvas.scrollTop;
          }
        }
      } else {
        // Find start port position
        const fromEl = document.getElementById(state.connecting.fromBlock);
        if (fromEl) {
          const dot = fromEl.querySelectorAll('.output-port .port-dot')[state.connecting.fromPort];
          if (dot) {
            const dotRect = dot.getBoundingClientRect();
            x1 = dotRect.left + dotRect.width / 2 - canvasRect.left + state.canvas.scrollLeft;
            y1 = dotRect.top + dotRect.height / 2 - canvasRect.top + state.canvas.scrollTop;
          }
        }
        x2 = e.clientX - canvasRect.left + state.canvas.scrollLeft;
        y2 = e.clientY - canvasRect.top + state.canvas.scrollTop;
      }

      if (x1 !== undefined && y1 !== undefined) {
        state.tempLine.setAttribute('d', bezierPath(x1, y1, x2, y2));
      }
    }

    // Panning
    if (state.panning && state.panStart) {
      const dx = e.clientX - state.panStart.x;
      const dy = e.clientY - state.panStart.y;
      state.canvas.scrollLeft = state.panStart.scrollLeft - dx;
      state.canvas.scrollTop = state.panStart.scrollTop - dy;
    }
  }

  function onCanvasMouseUp(e) {
    // Finish connection
    if (state.connecting) {
      const targetPort = findPortAtPosition(e.clientX, e.clientY);
      if (targetPort) {
        if (state.connecting.reverse) {
          if (targetPort.dir === 'output') {
            addConnection(targetPort.blockId, targetPort.index, state.connecting.toBlock, state.connecting.toPort);
          }
        } else {
          if (targetPort.dir === 'input') {
            addConnection(state.connecting.fromBlock, state.connecting.fromPort, targetPort.blockId, targetPort.index);
          }
        }
      }
      clearPortHighlights();
      state.connecting = null;
      state.tempLine.style.display = 'none';
    }

    state.dragging = null;
    state.panning = false;
    state.panStart = null;
  }

  function onCanvasWheel(e) {
    e.preventDefault();
  }

  function onCanvasDblClick(e) {
    // Double click on canvas adds a block from context menu
    // (or we can skip for now)
  }

  function onKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
      return;
    }
    if (e.key === 'f' || e.key === 'F') {
      if (!e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        fitToScreen();
        return;
      }
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (state.selectedBlock && !e.target.matches('input, textarea, select')) {
        removeBlock(state.selectedBlock);
      }
    }
  }

  function onDrop(e) {
    e.preventDefault();
    const blockType = e.dataTransfer.getData('text/plain');
    if (!blockType) return;

    const rect = state.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left + state.canvas.scrollLeft - BLOCK_WIDTH / 2;
    const y = e.clientY - rect.top + state.canvas.scrollTop - 20;

    addBlock(blockType, Math.max(0, x), Math.max(0, y));
  }

  function findPortAtPosition(clientX, clientY) {
    const ports = state.blocksContainer.querySelectorAll('.block-port');
    for (const port of ports) {
      const rect = port.getBoundingClientRect();
      const expanded = {
        left: rect.left - 10,
        right: rect.right + 10,
        top: rect.top - 5,
        bottom: rect.bottom + 5
      };
      if (clientX >= expanded.left && clientX <= expanded.right &&
          clientY >= expanded.top && clientY <= expanded.bottom) {
        return {
          blockId: port.getAttribute('data-block'),
          index: parseInt(port.getAttribute('data-port-index')),
          dir: port.getAttribute('data-port-dir'),
          type: port.getAttribute('data-port-type')
        };
      }
    }
    return null;
  }

  // ─── Pipeline Execution ───────────────────────────────────────────────────

  function getExecutionOrder() {
    const visited = new Set();
    const order = [];
    const inDegree = {};

    // Calculate in-degrees
    for (const block of state.blocks) {
      inDegree[block.id] = 0;
    }
    for (const conn of state.connections) {
      inDegree[conn.toBlock] = (inDegree[conn.toBlock] || 0) + 1;
    }

    // BFS topological sort
    const queue = state.blocks.filter(b => inDegree[b.id] === 0).map(b => b.id);

    while (queue.length > 0) {
      const blockId = queue.shift();
      if (visited.has(blockId)) continue;
      visited.add(blockId);
      order.push(blockId);

      // Find outgoing connections
      for (const conn of state.connections) {
        if (conn.fromBlock === blockId) {
          inDegree[conn.toBlock]--;
          if (inDegree[conn.toBlock] <= 0) {
            queue.push(conn.toBlock);
          }
        }
      }
    }

    // Add any unvisited blocks (disconnected)
    for (const block of state.blocks) {
      if (!visited.has(block.id)) {
        order.push(block.id);
      }
    }

    return order;
  }

  function run(mode) {
    const runMode = mode || 'train';
    state.blockResults = {};
    const order = getExecutionOrder();
    const errors = [];

    // Clear all statuses
    for (const block of state.blocks) {
      setBlockStatus(block.id, 'pending');
    }

    for (const blockId of order) {
      const block = getBlock(blockId);
      if (!block) continue;

      const def = block._def || BlockRegistry.getBlockType(block.type);
      if (!def || !def.process) continue;

      setBlockStatus(blockId, 'running');

      try {
        // Gather inputs from connections
        const inputs = {};
        for (const conn of state.connections) {
          if (conn.toBlock === blockId) {
            const fromResult = state.blockResults[conn.fromBlock];
            if (fromResult) {
              const outputName = def.inputs[conn.toPort]?.name;
              const fromDef = getBlock(conn.fromBlock)?._def || BlockRegistry.getBlockType(getBlock(conn.fromBlock)?.type);
              const fromOutputName = fromDef?.outputs[conn.fromPort]?.name;
              if (outputName && fromOutputName && fromResult[fromOutputName] !== undefined) {
                inputs[outputName] = fromResult[fromOutputName];
              }
            }
          }
        }

        // Inject run mode into config before processing
        block.config._runMode = runMode;
        const result = def.process(block.config, inputs);
        // Update model badge for classifier blocks
        if (def.category === 'classifier') {
          updateModelBadge(blockId, block.config._isTrained, runMode);
        }
        delete block.config._runMode;

        state.blockResults[blockId] = result;
        setBlockStatus(blockId, 'success');

        // Update preview
        updateBlockPreview(block, result);

      } catch (err) {
        console.error(`Block ${block.id} (${def.name}) error:`, err);
        errors.push({ blockId, error: err.message });
        setBlockStatus(blockId, 'error', err.message);
        state.blockResults[blockId] = {};
      }
    }

    if (state.onRunComplete) {
      state.onRunComplete({
        results: state.blockResults,
        errors,
        order,
        runMode
      });
    }

    return { results: state.blockResults, errors };
  }

  function runInference() {
    return run('infer');
  }

  function setBlockStatus(blockId, status, message) {
    const el = document.getElementById(`${blockId}-status`);
    if (!el) return;

    el.className = `block-status status-${status}`;
    el.title = message || status;

    const statusIcons = { pending: '', running: '⟳', success: '✓', error: '✗' };
    el.textContent = statusIcons[status] || '';
  }

  function updateBlockPreview(block, result) {
    const preview = document.getElementById(`${block.id}-preview`);
    if (!preview) return;

    preview.innerHTML = '';

    if (!result) return;

    // Show a mini summary based on result type
    const summaryEl = document.createElement('div');
    summaryEl.className = 'preview-summary';

    if (result.signal) {
      summaryEl.textContent = `${result.signal.values?.length || 0} samples`;
    } else if (result.segments) {
      summaryEl.textContent = `${result.segments.windows?.length || 0} windows`;
    } else if (result.spectrum) {
      summaryEl.textContent = `${result.spectrum.values?.length || 0} bins`;
    } else if (result.features) {
      summaryEl.textContent = `${result.features.vectors?.length || 0}×${result.features.vectors?.[0]?.length || 0}`;
    } else if (result.predictions) {
      summaryEl.textContent = `${result.predictions.items?.length || 0} predictions`;
    } else if (result.classification) {
      summaryEl.textContent = `${result.classification.items?.length || 0} classified`;
    } else if (result.stats) {
      const entries = Object.entries(result.stats.values || {});
      summaryEl.textContent = entries.slice(0, 2).map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(3) : v}`).join(', ');
    }

    preview.appendChild(summaryEl);
  }

  // ─── Serialization ────────────────────────────────────────────────────────

  function serialize() {
    return {
      blocks: state.blocks.map(b => ({
        id: b.id,
        type: b.type,
        x: b.x,
        y: b.y,
        config: JSON.parse(JSON.stringify(b.config, (key, value) => {
          // Skip non-serializable fields
          if (key === 'trainedNetwork' || key === 'csvData') return undefined;
          return value;
        }))
      })),
      connections: [...state.connections]
    };
  }

  function deserialize(data) {
    clear();
    if (!data) return;

    for (const blockData of data.blocks || []) {
      const def = BlockRegistry.getBlockType(blockData.type);
      if (!def) continue;

      const block = {
        id: blockData.id,
        type: blockData.type,
        x: blockData.x,
        y: blockData.y,
        config: { ...def.defaultConfig, ...blockData.config },
        _def: def
      };
      state.blocks.push(block);
      renderBlock(block);
    }

    state.connections = data.connections || [];
    renderConnections();
  }

  function clear() {
    state.blocks = [];
    state.connections = [];
    state.selectedBlock = null;
    state.blockResults = {};
    if (state.blocksContainer) state.blocksContainer.innerHTML = '';
    renderConnections();
    if (state.onBlockSelect) state.onBlockSelect(null);
    notifyChange();
  }

  // ─── Template Pipelines ───────────────────────────────────────────────────

  function loadTemplate(templateName) {
    const templates = getTemplates();
    const template = templates[templateName];
    if (template) {
      deserialize(template);
      // Auto-run after loading
      setTimeout(() => run(), 100);
    }
  }

  function getTemplates() {
    return {
      'fft-analysis': {
        blocks: [
          { id: 'b1', type: 'dataSource', x: 50, y: 100, config: {
            source: 'generate', generator: 'multiSine', sampleRate: 256,
            generatorConfig: { samples: 256, frequencies: [10, 25, 50], amplitudes: [1, 0.5, 0.3], sampleRate: 256, noise: 0.1 }
          }},
          { id: 'b2', type: 'fftBlock', x: 320, y: 80, config: {
            numCoefficients: 20, windowFunction: 'hanning', outputType: 'magnitude', normalize: true
          }},
          { id: 'b3', type: 'output', x: 590, y: 60, config: { title: 'Signal', chartType: 'auto' }},
          { id: 'b4', type: 'output', x: 590, y: 240, config: { title: 'Spectrum', chartType: 'auto' }}
        ],
        connections: [
          { fromBlock: 'b1', fromPort: 0, toBlock: 'b2', toPort: 0 },
          { fromBlock: 'b1', fromPort: 0, toBlock: 'b3', toPort: 0 },
          { fromBlock: 'b2', fromPort: 0, toBlock: 'b4', toPort: 1 }
        ]
      },
      'signal-classification': {
        blocks: [
          { id: 'b1', type: 'dataSource', x: 30, y: 120, config: {
            source: 'generate', generator: 'ecg', sampleRate: 360,
            generatorConfig: { samples: 720, sampleRate: 360, heartRate: 72, noise: 0.02 }
          }},
          { id: 'b2', type: 'windowing', x: 260, y: 100, config: {
            windowSize: 64, overlap: 0.5, windowFunction: 'hanning', applyWindow: true
          }},
          { id: 'b3', type: 'fftBlock', x: 490, y: 40, config: {
            numCoefficients: 8, outputType: 'magnitude', normalize: true
          }},
          { id: 'b4', type: 'statistics', x: 490, y: 220, config: {
            includeRMS: true, includeMean: true, includeVariance: true, includeStdDev: false,
            includePeak: true, includeCrestFactor: false, includeZeroCrossings: true, includeEnergy: false
          }},
          { id: 'b5', type: 'featureMerger', x: 740, y: 120, config: {} },
          { id: 'b6', type: 'neuralNetwork', x: 970, y: 100, config: {
            hiddenLayers: [{ neurons: 16, activation: 'relu' }, { neurons: 8, activation: 'relu' }],
            outputNeurons: 3, outputActivation: 'softmax', learningRate: 0.01,
            epochs: 200, batchSize: 4, classNames: 'Normal,Abnormal,Artifact'
          }},
          { id: 'b7', type: 'fuzzyClassifier', x: 1210, y: 100, config: {
            mode: 'threshold', classes: 'Healthy,Warning,Critical',
            thresholds: '0.33,0.66', inputFeatureIndex: 0
          }},
          { id: 'b8', type: 'output', x: 1440, y: 100, config: { title: 'Classification', chartType: 'auto' }}
        ],
        connections: [
          { fromBlock: 'b1', fromPort: 0, toBlock: 'b2', toPort: 0 },
          { fromBlock: 'b2', fromPort: 0, toBlock: 'b3', toPort: 1 },
          { fromBlock: 'b2', fromPort: 0, toBlock: 'b4', toPort: 1 },
          { fromBlock: 'b3', fromPort: 1, toBlock: 'b5', toPort: 0 },
          { fromBlock: 'b4', fromPort: 0, toBlock: 'b5', toPort: 1 },
          { fromBlock: 'b5', fromPort: 0, toBlock: 'b6', toPort: 0 },
          { fromBlock: 'b6', fromPort: 0, toBlock: 'b7', toPort: 1 },
          { fromBlock: 'b7', fromPort: 0, toBlock: 'b8', toPort: 4 }
        ]
      },
      'stock-analysis': {
        blocks: [
          { id: 'b1', type: 'dataSource', x: 50, y: 120, config: {
            source: 'generate', generator: 'stockMarket', sampleRate: 1,
            generatorConfig: { samples: 500, startPrice: 100, volatility: 0.02, drift: 0.0001, trend: 'mixed' }
          }},
          { id: 'b2', type: 'windowing', x: 290, y: 100, config: {
            windowSize: 32, overlap: 0.75, windowFunction: 'rectangular', applyWindow: false
          }},
          { id: 'b3', type: 'statistics', x: 530, y: 100, config: {
            includeRMS: true, includeMean: true, includeVariance: true, includeStdDev: true,
            includePeak: false, includeCrestFactor: false, includeZeroCrossings: false, includeEnergy: false
          }},
          { id: 'b4', type: 'fuzzyClassifier', x: 770, y: 100, config: {
            mode: 'threshold', classes: 'Buy,Hold,Sell', thresholds: '0.33,0.66', inputFeatureIndex: 2
          }},
          { id: 'b5', type: 'output', x: 50, y: 340, config: { title: 'Stock Price', chartType: 'auto' }},
          { id: 'b6', type: 'output', x: 1010, y: 100, config: { title: 'Trading Signal', chartType: 'auto' }}
        ],
        connections: [
          { fromBlock: 'b1', fromPort: 0, toBlock: 'b2', toPort: 0 },
          { fromBlock: 'b1', fromPort: 0, toBlock: 'b5', toPort: 0 },
          { fromBlock: 'b2', fromPort: 0, toBlock: 'b3', toPort: 1 },
          { fromBlock: 'b3', fromPort: 0, toBlock: 'b4', toPort: 0 },
          { fromBlock: 'b4', fromPort: 0, toBlock: 'b6', toPort: 4 }
        ]
      },
      'heart-rate-monitor': {
        blocks: [
          { id: 'b1', type: 'dataSource', x: 50, y: 120, config: {
            source: 'generate', generator: 'ecg', sampleRate: 360,
            generatorConfig: { samples: 720, sampleRate: 360, heartRate: 72, noise: 0.02 }
          }},
          { id: 'b2', type: 'fftBlock', x: 290, y: 120, config: {
            numCoefficients: 20, outputType: 'magnitude', normalize: true
          }},
          { id: 'b3', type: 'output', x: 50, y: 380, config: { title: 'ECG Signal', chartType: 'auto' }},
          { id: 'b4', type: 'output', x: 530, y: 120, config: { title: 'Heart Rate Spectrum', chartType: 'auto' }}
        ],
        connections: [
          { fromBlock: 'b1', fromPort: 0, toBlock: 'b2', toPort: 0 },
          { fromBlock: 'b1', fromPort: 0, toBlock: 'b3', toPort: 0 },
          { fromBlock: 'b2', fromPort: 1, toBlock: 'b4', toPort: 1 }
        ]
      },
      'noise-cancellation': {
        blocks: [
          { id: 'b1', type: 'dataSource', x: 50, y: 140, config: {
            source: 'generate', generator: 'sine', sampleRate: 256,
            generatorConfig: { samples: 512, frequency: 5, sampleRate: 256, amplitude: 1, noise: 0.8 }
          }},
          { id: 'b2', type: 'filter', x: 290, y: 140, config: {
            filterType: 'lowpass', cutoffFreq: 10, order: 4
          }},
          { id: 'b3', type: 'output', x: 50, y: 380, config: { title: 'Original (Noisy)', chartType: 'auto' }},
          { id: 'b4', type: 'output', x: 530, y: 140, config: { title: 'Filtered Signal', chartType: 'auto' }}
        ],
        connections: [
          { fromBlock: 'b1', fromPort: 0, toBlock: 'b2', toPort: 0 },
          { fromBlock: 'b1', fromPort: 0, toBlock: 'b3', toPort: 0 },
          { fromBlock: 'b2', fromPort: 0, toBlock: 'b4', toPort: 0 }
        ]
      },
      'emg-envelope': {
        blocks: [
          { id: 'b1', type: 'dataSource', x: 30, y: 130, config: {
            source: 'generate', generator: 'emg', sampleRate: 1000,
            generatorConfig: { samples: 1000, sampleRate: 1000, gestures: 3, amplitude: 1, noise: 0.1 }
          }},
          { id: 'b2', type: 'rectifier', x: 260, y: 130, config: { mode: 'full' }},
          { id: 'b3', type: 'windowing', x: 490, y: 130, config: {
            windowSize: 50, overlap: 0.5, windowFunction: 'rectangular', applyWindow: false
          }},
          { id: 'b4', type: 'statistics', x: 730, y: 130, config: {
            includeRMS: true, includeMean: true, includeVariance: false, includeStdDev: false,
            includePeak: true, includeCrestFactor: false, includeZeroCrossings: false, includeEnergy: true
          }},
          { id: 'b5', type: 'output', x: 30, y: 380, config: { title: 'Raw EMG', chartType: 'auto' }},
          { id: 'b6', type: 'output', x: 970, y: 130, config: { title: 'EMG Features', chartType: 'auto' }}
        ],
        connections: [
          { fromBlock: 'b1', fromPort: 0, toBlock: 'b2', toPort: 0 },
          { fromBlock: 'b1', fromPort: 0, toBlock: 'b5', toPort: 0 },
          { fromBlock: 'b2', fromPort: 0, toBlock: 'b3', toPort: 0 },
          { fromBlock: 'b3', fromPort: 0, toBlock: 'b4', toPort: 1 },
          { fromBlock: 'b4', fromPort: 0, toBlock: 'b6', toPort: 2 }
        ]
      },
      'vibration-analysis': {
        blocks: [
          { id: 'b1', type: 'dataSource', x: 30, y: 130, config: {
            source: 'generate', generator: 'vibration', sampleRate: 512,
            generatorConfig: { samples: 512, sampleRate: 512, fundamentalFreq: 50, harmonics: 3, amplitude: 1, noise: 0.1 }
          }},
          { id: 'b2', type: 'windowing', x: 260, y: 130, config: {
            windowSize: 128, overlap: 0.5, windowFunction: 'hanning', applyWindow: true
          }},
          { id: 'b3', type: 'fftBlock', x: 490, y: 80, config: {
            numCoefficients: 16, outputType: 'magnitude', normalize: true
          }},
          { id: 'b4', type: 'statistics', x: 490, y: 270, config: {
            includeRMS: true, includeMean: false, includeVariance: false, includeStdDev: false,
            includePeak: true, includeCrestFactor: true, includeZeroCrossings: false, includeEnergy: true
          }},
          { id: 'b5', type: 'output', x: 30, y: 380, config: { title: 'Vibration Signal', chartType: 'auto' }},
          { id: 'b6', type: 'output', x: 730, y: 80, config: { title: 'Frequency Spectrum', chartType: 'auto' }}
        ],
        connections: [
          { fromBlock: 'b1', fromPort: 0, toBlock: 'b2', toPort: 0 },
          { fromBlock: 'b1', fromPort: 0, toBlock: 'b5', toPort: 0 },
          { fromBlock: 'b2', fromPort: 0, toBlock: 'b3', toPort: 1 },
          { fromBlock: 'b2', fromPort: 0, toBlock: 'b4', toPort: 1 },
          { fromBlock: 'b3', fromPort: 1, toBlock: 'b6', toPort: 1 }
        ]
      },
      'spectrogram-demo': {
        blocks: [
          { id: 'b1', type: 'dataSource', x: 50, y: 130, config: {
            source: 'generate', generator: 'chirp', sampleRate: 256,
            generatorConfig: { samples: 512, startFreq: 2, endFreq: 60, sampleRate: 256, amplitude: 1 }
          }},
          { id: 'b2', type: 'spectrogramBlock', x: 290, y: 130, config: {
            windowSize: 64, hopSize: 16, windowFunction: 'hanning'
          }},
          { id: 'b3', type: 'output', x: 50, y: 370, config: { title: 'Chirp Signal', chartType: 'auto' }},
          { id: 'b4', type: 'output', x: 530, y: 130, config: { title: 'Spectrogram', chartType: 'auto' }}
        ],
        connections: [
          { fromBlock: 'b1', fromPort: 0, toBlock: 'b2', toPort: 0 },
          { fromBlock: 'b1', fromPort: 0, toBlock: 'b3', toPort: 0 },
          { fromBlock: 'b2', fromPort: 0, toBlock: 'b4', toPort: 0 }
        ]
      }
    };
  }

  // ─── Fit to Screen ────────────────────────────────────────────────────────

  function fitToScreen() {
    if (state.blocks.length === 0) return;
    const canvasRect = state.canvas.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.blocks.forEach(b => {
      const el = document.getElementById(b.id);
      if (!el) return;
      const w = el.offsetWidth || 180;
      const h = el.offsetHeight || 120;
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + w);
      maxY = Math.max(maxY, b.y + h);
    });
    const padding = 60;
    const contentW = maxX - minX + padding * 2;
    const contentH = maxY - minY + padding * 2;
    const scaleX = canvasRect.width / contentW;
    const scaleY = canvasRect.height / contentH;
    const scale = Math.min(scaleX, scaleY, 1); // eslint-disable-line no-unused-vars
    // Shift all blocks so they're centred
    const targetCX = canvasRect.width / 2;
    const targetCY = canvasRect.height / 2;
    const contentCX = (minX + maxX) / 2;
    const contentCY = (minY + maxY) / 2;
    const dx = targetCX - contentCX;
    const dy = targetCY - contentCY;
    state.blocks.forEach(b => {
      b.x += dx;
      b.y += dy;
      const el = document.getElementById(b.id);
      if (el) { el.style.left = b.x + 'px'; el.style.top = b.y + 'px'; }
    });
    renderConnections();
  }

  // ─── Share by URL ─────────────────────────────────────────────────────────

  function shareAsURL() {
    const data = serialize();
    const json = JSON.stringify(data);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    const url = window.location.origin + window.location.pathname + '#pipeline=' + encoded;
    return url;
  }

  function loadFromURL() {
    const hash = window.location.hash;
    if (!hash.startsWith('#pipeline=')) return false;
    const encoded = hash.slice('#pipeline='.length);
    try {
      const json = decodeURIComponent(escape(atob(encoded)));
      const data = JSON.parse(json);
      deserialize(data);
      return true;
    } catch (e) {
      console.warn('Could not load pipeline from URL:', e);
      return false;
    }
  }

  // ─── Utility ──────────────────────────────────────────────────────────────

  function saveToHistory() {
    if (_skipHistory) return;
    const snap = JSON.stringify(serialize());
    history = history.slice(0, historyIndex + 1);
    history.push(snap);
    if (history.length > MAX_HISTORY) history.shift();
    else historyIndex++;
  }

  function _restoreSnapshot(data) {
    // Remove all current block DOM elements
    state.blocks.forEach(b => {
      const el = document.getElementById(b.id);
      if (el) el.remove();
    });
    state.blocks = [];
    state.connections = [];
    state.blockResults = {};
    state.selectedBlock = null;
    // Clear SVG connections
    const paths = state.svg.querySelectorAll('.connection-path, .connection-hit');
    paths.forEach(p => p.remove());
    // Rebuild from data
    if (data.blocks) {
      for (const b of data.blocks) {
        const def = BlockRegistry.getBlockType(b.type);
        if (!def) continue;
        const block = { id: b.id, type: b.type, x: b.x, y: b.y, config: b.config, _def: def };
        state.blocks.push(block);
        renderBlock(block);
      }
    }
    if (data.connections) {
      state.connections = data.connections;
      renderConnections();
    }
  }

  function undo() {
    if (historyIndex <= 0) return false;
    historyIndex--;
    _skipHistory = true;
    const snap = JSON.parse(history[historyIndex]);
    _restoreSnapshot(snap);
    _skipHistory = false;
    if (state.onPipelineChange) state.onPipelineChange();
    return true;
  }

  function redo() {
    if (historyIndex >= history.length - 1) return false;
    historyIndex++;
    _skipHistory = true;
    const snap = JSON.parse(history[historyIndex]);
    _restoreSnapshot(snap);
    _skipHistory = false;
    if (state.onPipelineChange) state.onPipelineChange();
    return true;
  }

  function notifyChange() {
    saveToHistory();
    if (state.onPipelineChange) {
      state.onPipelineChange(serialize());
    }
  }

  function getResults() {
    return state.blockResults;
  }

  function getState() {
    return state;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  return {
    init,
    addBlock,
    removeBlock,
    getBlock,
    updateBlockConfig,
    addConnection,
    removeConnection,
    run,
    runInference,
    updateModelBadge,
    clear,
    serialize,
    deserialize,
    loadTemplate,
    getTemplates,
    getExecutionOrder,
    getResults,
    getState,
    renderConnections,
    selectBlock,
    undo,
    redo,
    fitToScreen,
    shareAsURL,
    loadFromURL
  };

})();
