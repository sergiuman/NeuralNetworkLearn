// =============================================================================
// Main.js - Application Orchestration
// =============================================================================

const App = (() => {

  let currentBlock = null;
  let outputPanels = [];

  // ─── Initialization ───────────────────────────────────────────────────────

  function init() {
    // Initialize pipeline editor
    PipelineEditor.init('pipeline-canvas', {
      onBlockSelect: onBlockSelected,
      onPipelineChange: onPipelineChanged,
      onRunComplete: onRunComplete
    });

    // Setup sidebar
    setupSidebar();

    // Setup toolbar
    setupToolbar();

    // Setup config panel
    setupConfigPanel();

    // Load from localStorage if available
    const saved = localStorage.getItem('signalflow-pipeline');
    if (saved) {
      try {
        PipelineEditor.deserialize(JSON.parse(saved));
      } catch (e) {
        console.warn('Could not restore saved pipeline:', e);
      }
    }

    // Welcome state - show template chooser if empty
    if (PipelineEditor.getState().blocks.length === 0) {
      showWelcome();
    }
  }

  // ─── Sidebar ──────────────────────────────────────────────────────────────

  function setupSidebar() {
    const sidebar = document.getElementById('sidebar-blocks');
    if (!sidebar) return;

    const categories = BlockRegistry.getCategories();
    for (const cat of categories) {
      const catEl = document.createElement('div');
      catEl.className = 'sidebar-category';

      const catHeader = document.createElement('div');
      catHeader.className = 'sidebar-category-header';
      catHeader.innerHTML = `<span>${cat.icon} ${cat.name}</span>`;
      catHeader.addEventListener('click', () => {
        catEl.classList.toggle('collapsed');
      });
      catEl.appendChild(catHeader);

      const catBlocks = document.createElement('div');
      catBlocks.className = 'sidebar-category-blocks';

      const blocks = BlockRegistry.getByCategory(cat.id);
      for (const blockDef of blocks) {
        const blockEl = document.createElement('div');
        blockEl.className = 'sidebar-block';
        blockEl.draggable = true;
        blockEl.innerHTML = `
          <span class="sidebar-block-icon" style="background:${blockDef.color}">${blockDef.icon}</span>
          <span class="sidebar-block-name">${blockDef.name}</span>
        `;

        blockEl.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', blockDef.type);
          e.dataTransfer.effectAllowed = 'copy';
          blockEl.classList.add('dragging');
        });

        blockEl.addEventListener('dragend', () => {
          blockEl.classList.remove('dragging');
        });

        // Double-click to add at center
        blockEl.addEventListener('dblclick', () => {
          const canvas = document.getElementById('pipeline-canvas');
          const rect = canvas.getBoundingClientRect();
          const x = canvas.scrollLeft + rect.width / 2 - 90;
          const y = canvas.scrollTop + rect.height / 2 - 40;
          PipelineEditor.addBlock(blockDef.type, x, y);
        });

        catBlocks.appendChild(blockEl);
      }

      catEl.appendChild(catBlocks);
      sidebar.appendChild(catEl);
    }
  }

  // ─── Toolbar ──────────────────────────────────────────────────────────────

  function setupToolbar() {
    document.getElementById('btn-run')?.addEventListener('click', () => {
      runPipeline();
    });

    document.getElementById('btn-clear')?.addEventListener('click', () => {
      if (confirm('Clear the entire pipeline?')) {
        PipelineEditor.clear();
        clearOutputPanels();
        hideConfigPanel();
      }
    });

    document.getElementById('btn-save')?.addEventListener('click', () => {
      savePipeline();
    });

    document.getElementById('btn-load')?.addEventListener('click', () => {
      loadPipeline();
    });

    document.getElementById('btn-export')?.addEventListener('click', () => {
      exportResults();
    });

    // Template buttons
    document.getElementById('btn-template-fft')?.addEventListener('click', () => {
      loadTemplate('fft-analysis');
    });
    document.getElementById('btn-template-classify')?.addEventListener('click', () => {
      loadTemplate('signal-classification');
    });
    document.getElementById('btn-template-stock')?.addEventListener('click', () => {
      loadTemplate('stock-analysis');
    });

    // Toggle panels
    document.getElementById('btn-toggle-output')?.addEventListener('click', () => {
      document.getElementById('output-panel')?.classList.toggle('collapsed');
    });
  }

  // ─── Config Panel ─────────────────────────────────────────────────────────

  function setupConfigPanel() {
    document.getElementById('config-close')?.addEventListener('click', hideConfigPanel);
  }

  function onBlockSelected(block) {
    currentBlock = block;
    if (block) {
      showConfigPanel(block);
    } else {
      hideConfigPanel();
    }
  }

  function showConfigPanel(block) {
    const panel = document.getElementById('config-panel');
    if (!panel) return;

    panel.classList.add('visible');
    const content = document.getElementById('config-content');
    const title = document.getElementById('config-title');

    const def = block._def || BlockRegistry.getBlockType(block.type);
    if (!def) return;

    title.innerHTML = `<span style="color:${def.color}">${def.icon}</span> ${def.name}`;
    content.innerHTML = '';

    // Build config UI from definition
    for (const field of def.configUI || []) {
      // Check showIf conditions
      if (field.showIf) {
        let show = true;
        for (const [key, val] of Object.entries(field.showIf)) {
          if (getNestedValue(block.config, key) !== val) {
            show = false;
            break;
          }
        }
        if (!show) continue;
      }

      const fieldEl = document.createElement('div');
      fieldEl.className = 'config-field';

      const label = document.createElement('label');
      label.textContent = field.label;
      fieldEl.appendChild(label);

      const currentValue = getNestedValue(block.config, field.key);

      switch (field.type) {
        case 'number': {
          const input = document.createElement('input');
          input.type = 'number';
          input.value = currentValue ?? '';
          input.min = field.min ?? '';
          input.max = field.max ?? '';
          input.step = field.step ?? 'any';
          input.addEventListener('change', () => {
            setNestedValue(block.config, field.key, parseFloat(input.value));
            PipelineEditor.updateBlockConfig(block.id, block.config);
          });
          fieldEl.appendChild(input);
          break;
        }

        case 'text': {
          const input = document.createElement('input');
          input.type = 'text';
          input.value = typeof currentValue === 'string' ? currentValue
            : Array.isArray(currentValue) ? currentValue.join(', ') : String(currentValue ?? '');
          input.placeholder = field.placeholder || '';
          input.addEventListener('change', () => {
            setNestedValue(block.config, field.key, input.value);
            PipelineEditor.updateBlockConfig(block.id, block.config);
          });
          fieldEl.appendChild(input);
          break;
        }

        case 'textarea': {
          const textarea = document.createElement('textarea');
          textarea.value = currentValue ?? '';
          textarea.rows = 3;
          textarea.placeholder = field.placeholder || '';
          textarea.addEventListener('change', () => {
            setNestedValue(block.config, field.key, textarea.value);
            PipelineEditor.updateBlockConfig(block.id, block.config);
          });
          fieldEl.appendChild(textarea);
          break;
        }

        case 'select': {
          const select = document.createElement('select');
          for (const opt of field.options || []) {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value === currentValue) option.selected = true;
            select.appendChild(option);
          }
          select.addEventListener('change', () => {
            setNestedValue(block.config, field.key, select.value);
            PipelineEditor.updateBlockConfig(block.id, block.config);
            // Refresh panel for conditional fields
            showConfigPanel(block);
          });
          fieldEl.appendChild(select);
          break;
        }

        case 'checkbox': {
          const wrapper = document.createElement('div');
          wrapper.className = 'checkbox-wrapper';
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = !!currentValue;
          input.id = `config-${field.key}`;
          input.addEventListener('change', () => {
            setNestedValue(block.config, field.key, input.checked);
            PipelineEditor.updateBlockConfig(block.id, block.config);
          });
          const checkLabel = document.createElement('label');
          checkLabel.htmlFor = input.id;
          checkLabel.textContent = field.label;
          wrapper.appendChild(input);
          wrapper.appendChild(checkLabel);
          fieldEl.innerHTML = '';
          fieldEl.appendChild(wrapper);
          break;
        }

        case 'file': {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = field.accept || '';
          input.addEventListener('change', async () => {
            if (input.files && input.files[0]) {
              try {
                const data = await DataIO.readFile(input.files[0]);
                block.config.csvData = data;
                // Update column dropdown if present
                const numericCols = DataIO.getNumericColumns(data);
                if (numericCols.length > 0) {
                  block.config.csvColumn = numericCols[0];
                }
                PipelineEditor.updateBlockConfig(block.id, block.config);
                showConfigPanel(block); // Refresh to show columns
                showNotification(`Loaded ${data.headers.length} columns, ${Object.values(data.columns)[0]?.length || 0} rows`, 'success');
              } catch (err) {
                showNotification(`Error: ${err.message}`, 'error');
              }
            }
          });
          fieldEl.appendChild(input);
          break;
        }

        case 'layers': {
          const layersContainer = document.createElement('div');
          layersContainer.className = 'layers-editor';
          const layers = currentValue || [];

          layers.forEach((layer, idx) => {
            const layerEl = document.createElement('div');
            layerEl.className = 'layer-row';

            const neuronsInput = document.createElement('input');
            neuronsInput.type = 'number';
            neuronsInput.value = layer.neurons;
            neuronsInput.min = 1;
            neuronsInput.max = 512;
            neuronsInput.placeholder = 'Neurons';
            neuronsInput.title = 'Number of neurons';

            const actSelect = document.createElement('select');
            for (const act of ['relu', 'sigmoid', 'tanh', 'leakyRelu', 'linear']) {
              const opt = document.createElement('option');
              opt.value = act;
              opt.textContent = act;
              if (act === layer.activation) opt.selected = true;
              actSelect.appendChild(opt);
            }

            const removeBtn = document.createElement('button');
            removeBtn.textContent = '×';
            removeBtn.className = 'btn-remove-layer';
            removeBtn.addEventListener('click', () => {
              layers.splice(idx, 1);
              setNestedValue(block.config, field.key, layers);
              PipelineEditor.updateBlockConfig(block.id, block.config);
              showConfigPanel(block);
            });

            neuronsInput.addEventListener('change', () => {
              layers[idx].neurons = parseInt(neuronsInput.value);
              setNestedValue(block.config, field.key, layers);
              PipelineEditor.updateBlockConfig(block.id, block.config);
            });

            actSelect.addEventListener('change', () => {
              layers[idx].activation = actSelect.value;
              setNestedValue(block.config, field.key, layers);
              PipelineEditor.updateBlockConfig(block.id, block.config);
            });

            layerEl.appendChild(neuronsInput);
            layerEl.appendChild(actSelect);
            layerEl.appendChild(removeBtn);
            layersContainer.appendChild(layerEl);
          });

          const addBtn = document.createElement('button');
          addBtn.textContent = '+ Add Layer';
          addBtn.className = 'btn-add-layer';
          addBtn.addEventListener('click', () => {
            layers.push({ neurons: 8, activation: 'relu' });
            setNestedValue(block.config, field.key, layers);
            PipelineEditor.updateBlockConfig(block.id, block.config);
            showConfigPanel(block);
          });
          layersContainer.appendChild(addBtn);

          fieldEl.appendChild(layersContainer);
          break;
        }
      }

      content.appendChild(fieldEl);
    }

    // Add "Run Block" button
    const runBtn = document.createElement('button');
    runBtn.className = 'btn btn-run-block';
    runBtn.textContent = 'Run Pipeline';
    runBtn.addEventListener('click', runPipeline);
    content.appendChild(runBtn);
  }

  function hideConfigPanel() {
    const panel = document.getElementById('config-panel');
    if (panel) panel.classList.remove('visible');
    currentBlock = null;
  }

  // ─── Pipeline Execution ───────────────────────────────────────────────────

  function runPipeline() {
    const runBtn = document.getElementById('btn-run');
    if (runBtn) {
      runBtn.classList.add('running');
      runBtn.disabled = true;
    }

    showNotification('Running pipeline...', 'info');

    // Use setTimeout to allow UI to update
    setTimeout(() => {
      try {
        const result = PipelineEditor.run();

        if (result.errors.length > 0) {
          showNotification(`Completed with ${result.errors.length} error(s)`, 'warning');
        } else {
          showNotification('Pipeline executed successfully', 'success');
        }
      } catch (err) {
        showNotification(`Error: ${err.message}`, 'error');
      } finally {
        if (runBtn) {
          runBtn.classList.remove('running');
          runBtn.disabled = false;
        }
      }
    }, 50);
  }

  function onRunComplete(result) {
    // Update output panels
    clearOutputPanels();
    displayResults(result);

    // Auto-save
    savePipelineToLocal();
  }

  function displayResults(result) {
    const outputContainer = document.getElementById('output-content');
    if (!outputContainer) return;

    outputContainer.innerHTML = '';
    const outputPanel = document.getElementById('output-panel');
    if (outputPanel) outputPanel.classList.remove('collapsed');

    const order = result.order || [];
    let hasOutput = false;

    for (const blockId of order) {
      const block = PipelineEditor.getBlock(blockId);
      const blockResult = result.results[blockId];
      if (!block || !blockResult) continue;

      const def = block._def || BlockRegistry.getBlockType(block.type);

      // Create output panel for each block with displayable data
      const displayableTypes = ['signal', 'spectrum', 'features', 'predictions', 'classification', 'stats', '_display'];
      const hasDisplayable = displayableTypes.some(t => blockResult[t]);

      if (!hasDisplayable) continue;
      hasOutput = true;

      const panel = document.createElement('div');
      panel.className = 'output-card';

      const panelHeader = document.createElement('div');
      panelHeader.className = 'output-card-header';
      panelHeader.innerHTML = `<span style="color:${def?.color || '#fff'}">${def?.icon || ''}</span> ${block.config?.title || def?.name || block.type}`;
      panel.appendChild(panelHeader);

      const chartContainer = document.createElement('div');
      chartContainer.className = 'output-chart';
      panel.appendChild(chartContainer);

      outputContainer.appendChild(panel);

      // Render chart
      requestAnimationFrame(() => {
        if (blockResult._display) {
          // Output block - render whatever inputs it has
          const inputs = blockResult._display.inputs;
          const config = blockResult._display.config;
          for (const [type, data] of Object.entries(inputs)) {
            if (data) {
              Charts.autoVisualize(chartContainer, type, data, {
                title: config.title || type
              });
              break; // One chart per output block
            }
          }
        } else {
          // Auto-visualize first displayable output
          for (const type of displayableTypes) {
            if (blockResult[type] && type !== '_display') {
              Charts.autoVisualize(chartContainer, type, blockResult[type], {
                title: `${def?.name}: ${type}`
              });
              break;
            }
          }
        }
      });

      // Add data table for stats
      if (blockResult.stats && blockResult.stats.values) {
        const table = document.createElement('div');
        table.className = 'stats-table';
        for (const [key, val] of Object.entries(blockResult.stats.values)) {
          const row = document.createElement('div');
          row.className = 'stats-row';
          row.innerHTML = `<span class="stats-key">${key}</span><span class="stats-value">${typeof val === 'number' ? val.toFixed(6) : val}</span>`;
          table.appendChild(row);
        }
        panel.appendChild(table);
      }

      // Classification summary
      if (blockResult.classification && blockResult.classification.summary) {
        const table = document.createElement('div');
        table.className = 'stats-table';
        for (const [cls, count] of Object.entries(blockResult.classification.summary)) {
          const row = document.createElement('div');
          row.className = 'stats-row';
          row.innerHTML = `<span class="stats-key">${cls}</span><span class="stats-value">${count} samples</span>`;
          table.appendChild(row);
        }
        panel.appendChild(table);
      }

      // Training history for NN
      if (blockResult.predictions && blockResult.predictions.trainingHistory) {
        const histContainer = document.createElement('div');
        histContainer.className = 'output-chart';
        panel.appendChild(histContainer);
        requestAnimationFrame(() => {
          Charts.visualizeTrainingHistory(histContainer, blockResult.predictions.trainingHistory, {
            title: 'Training Loss'
          });
        });
      }
    }

    if (!hasOutput) {
      outputContainer.innerHTML = '<div class="output-empty">No output blocks in the pipeline. Add an Output block and connect it to see results.</div>';
    }
  }

  function clearOutputPanels() {
    const outputContainer = document.getElementById('output-content');
    if (outputContainer) outputContainer.innerHTML = '';
  }

  // ─── Templates ────────────────────────────────────────────────────────────

  function loadTemplate(name) {
    clearOutputPanels();
    hideConfigPanel();
    PipelineEditor.loadTemplate(name);
    showNotification(`Loaded template: ${name}`, 'success');
    hideWelcome();
  }

  function showWelcome() {
    const welcome = document.getElementById('welcome-overlay');
    if (welcome) welcome.style.display = 'flex';
  }

  function hideWelcome() {
    const welcome = document.getElementById('welcome-overlay');
    if (welcome) welcome.style.display = 'none';
  }

  // ─── Save / Load ──────────────────────────────────────────────────────────

  function savePipeline() {
    const data = PipelineEditor.serialize();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'signalflow-pipeline.json';
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Pipeline saved', 'success');
  }

  function loadPipeline() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', () => {
      if (!input.files || !input.files[0]) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          PipelineEditor.deserialize(data);
          hideWelcome();
          showNotification('Pipeline loaded', 'success');
        } catch (e) {
          showNotification('Invalid pipeline file', 'error');
        }
      };
      reader.readAsText(input.files[0]);
    });
    input.click();
  }

  function savePipelineToLocal() {
    try {
      const data = PipelineEditor.serialize();
      localStorage.setItem('signalflow-pipeline', JSON.stringify(data));
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  function exportResults() {
    const results = PipelineEditor.getResults();
    if (!results || Object.keys(results).length === 0) {
      showNotification('No results to export. Run the pipeline first.', 'warning');
      return;
    }

    // Build CSV from all numeric results
    let csvContent = '';
    for (const [blockId, result] of Object.entries(results)) {
      const block = PipelineEditor.getBlock(blockId);
      const name = block?.config?.title || block?.type || blockId;

      if (result.signal && result.signal.values) {
        csvContent += `# ${name} - Signal\n`;
        csvContent += 'Index,Value\n';
        result.signal.values.forEach((v, i) => {
          csvContent += `${i},${v}\n`;
        });
        csvContent += '\n';
      }

      if (result.features && result.features.vectors) {
        csvContent += `# ${name} - Features\n`;
        const headers = result.features.featureNames || result.features.vectors[0]?.map((_, i) => `F${i}`) || [];
        csvContent += 'Sample,' + headers.join(',') + '\n';
        result.features.vectors.forEach((v, i) => {
          csvContent += `${i},${v.join(',')}\n`;
        });
        csvContent += '\n';
      }

      if (result.classification && result.classification.items) {
        csvContent += `# ${name} - Classification\n`;
        csvContent += 'Index,Input Value,Label,Confidence\n';
        result.classification.items.forEach(item => {
          csvContent += `${item.index},${item.inputValue},${item.label},${item.confidence}\n`;
        });
        csvContent += '\n';
      }
    }

    if (!csvContent) {
      showNotification('No exportable data found', 'warning');
      return;
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'signalflow-results.csv';
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Results exported', 'success');
  }

  // ─── Notifications ────────────────────────────────────────────────────────

  function showNotification(message, type) {
    const container = document.getElementById('notifications');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `notification notification-${type || 'info'}`;
    el.textContent = message;
    container.appendChild(el);

    setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  // ─── Pipeline Change Handler ──────────────────────────────────────────────

  function onPipelineChanged(data) {
    savePipelineToLocal();
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  function getNestedValue(obj, path) {
    return path.split('.').reduce((o, k) => o && o[k], obj);
  }

  function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, k) => {
      if (!o[k]) o[k] = {};
      return o[k];
    }, obj);
    target[last] = value;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  return {
    init,
    runPipeline,
    loadTemplate,
    showNotification
  };

})();

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', App.init);
