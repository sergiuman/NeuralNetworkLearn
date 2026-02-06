// =============================================================================
// Charts.js - Visualization and Charting
// =============================================================================

const Charts = (() => {

  // ─── Color Palette ────────────────────────────────────────────────────────

  const palette = [
    '#4FC3F7', '#81C784', '#FFB74D', '#F06292', '#BA68C8',
    '#4DD0E1', '#AED581', '#FFD54F', '#FF8A65', '#9575CD',
    '#26C6DA', '#66BB6A', '#FFA726', '#EF5350', '#7E57C2'
  ];

  function getColor(index) {
    return palette[index % palette.length];
  }

  // ─── Canvas Chart Renderer ────────────────────────────────────────────────

  function createChart(container, type, data, options) {
    const canvas = document.createElement('canvas');
    const wrapper = typeof container === 'string' ? document.getElementById(container) : container;
    if (!wrapper) return null;

    wrapper.innerHTML = '';
    canvas.width = wrapper.clientWidth || 500;
    canvas.height = wrapper.clientHeight || 300;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    wrapper.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const opts = {
      padding: { top: 40, right: 20, bottom: 50, left: 60 },
      showGrid: true,
      showLegend: true,
      title: '',
      xLabel: '',
      yLabel: '',
      lineWidth: 2,
      pointRadius: 0,
      animate: false,
      ...options
    };

    // Handle high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const plotX = opts.padding.left;
    const plotY = opts.padding.top;
    const plotW = w - opts.padding.left - opts.padding.right;
    const plotH = h - opts.padding.top - opts.padding.bottom;

    // Clear
    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, w, h);

    switch (type) {
      case 'line': drawLineChart(ctx, data, opts, plotX, plotY, plotW, plotH); break;
      case 'bar': drawBarChart(ctx, data, opts, plotX, plotY, plotW, plotH); break;
      case 'scatter': drawScatterChart(ctx, data, opts, plotX, plotY, plotW, plotH); break;
      default: drawLineChart(ctx, data, opts, plotX, plotY, plotW, plotH);
    }

    // Title
    if (opts.title) {
      ctx.fillStyle = '#e0e0e0';
      ctx.font = 'bold 14px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(opts.title, w / 2, 20);
    }

    // Axis labels
    if (opts.xLabel) {
      ctx.fillStyle = '#a0a0a0';
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(opts.xLabel, plotX + plotW / 2, h - 5);
    }
    if (opts.yLabel) {
      ctx.save();
      ctx.fillStyle = '#a0a0a0';
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.translate(12, plotY + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(opts.yLabel, 0, 0);
      ctx.restore();
    }

    return canvas;
  }

  // ─── Line Chart ───────────────────────────────────────────────────────────

  function drawLineChart(ctx, data, opts, px, py, pw, ph) {
    const { datasets, labels } = normalizeData(data);
    if (datasets.length === 0 || datasets[0].values.length === 0) {
      drawNoData(ctx, px, py, pw, ph);
      return;
    }

    // Calculate ranges
    let yMin = Infinity, yMax = -Infinity;
    for (const ds of datasets) {
      for (const v of ds.values) {
        if (isFinite(v)) {
          yMin = Math.min(yMin, v);
          yMax = Math.max(yMax, v);
        }
      }
    }
    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    const yPad = (yMax - yMin) * 0.05;
    yMin -= yPad;
    yMax += yPad;

    const N = datasets[0].values.length;

    // Draw grid
    if (opts.showGrid) drawGrid(ctx, px, py, pw, ph, yMin, yMax, N, labels);

    // Draw each dataset
    for (let d = 0; d < datasets.length; d++) {
      const ds = datasets[d];
      const color = ds.color || getColor(d);
      ctx.strokeStyle = color;
      ctx.lineWidth = opts.lineWidth;
      ctx.lineJoin = 'round';
      ctx.beginPath();

      let started = false;
      for (let i = 0; i < ds.values.length; i++) {
        const x = px + (i / (N - 1 || 1)) * pw;
        const y = py + ph - ((ds.values[i] - yMin) / (yMax - yMin)) * ph;
        if (!isFinite(y)) continue;
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Area fill
      if (ds.fill) {
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = color;
        ctx.lineTo(px + pw, py + ph);
        ctx.lineTo(px, py + ph);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Legend
    if (opts.showLegend && datasets.length > 1) {
      drawLegend(ctx, datasets, px + pw - 10, py + 10);
    }
  }

  // ─── Bar Chart ────────────────────────────────────────────────────────────

  function drawBarChart(ctx, data, opts, px, py, pw, ph) {
    const { datasets, labels } = normalizeData(data);
    if (datasets.length === 0) { drawNoData(ctx, px, py, pw, ph); return; }

    const N = datasets[0].values.length;
    let yMin = 0, yMax = -Infinity;
    for (const ds of datasets) {
      for (const v of ds.values) {
        yMax = Math.max(yMax, v);
        yMin = Math.min(yMin, v);
      }
    }
    if (yMax === yMin) yMax = yMin + 1;

    if (opts.showGrid) drawGrid(ctx, px, py, pw, ph, yMin, yMax, N, labels);

    const barGroupWidth = pw / N;
    const barWidth = (barGroupWidth * 0.8) / datasets.length;
    const barOffset = barGroupWidth * 0.1;

    for (let d = 0; d < datasets.length; d++) {
      const ds = datasets[d];
      const color = ds.color || getColor(d);
      ctx.fillStyle = color;

      for (let i = 0; i < ds.values.length; i++) {
        const x = px + i * barGroupWidth + barOffset + d * barWidth;
        const valH = ((ds.values[i] - yMin) / (yMax - yMin)) * ph;
        const y = py + ph - valH;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x, y, barWidth - 1, valH);
        ctx.globalAlpha = 1;
      }
    }

    if (opts.showLegend && datasets.length > 1) {
      drawLegend(ctx, datasets, px + pw - 10, py + 10);
    }
  }

  // ─── Scatter Chart ────────────────────────────────────────────────────────

  function drawScatterChart(ctx, data, opts, px, py, pw, ph) {
    const { datasets, labels } = normalizeData(data);
    if (datasets.length === 0) { drawNoData(ctx, px, py, pw, ph); return; }

    let yMin = Infinity, yMax = -Infinity;
    for (const ds of datasets) {
      for (const v of ds.values) {
        if (isFinite(v)) {
          yMin = Math.min(yMin, v);
          yMax = Math.max(yMax, v);
        }
      }
    }
    if (yMin === yMax) { yMin -= 1; yMax += 1; }

    const N = datasets[0].values.length;
    if (opts.showGrid) drawGrid(ctx, px, py, pw, ph, yMin, yMax, N, labels);

    for (let d = 0; d < datasets.length; d++) {
      const ds = datasets[d];
      const color = ds.color || getColor(d);
      ctx.fillStyle = color;

      for (let i = 0; i < ds.values.length; i++) {
        const x = px + (i / (N - 1 || 1)) * pw;
        const y = py + ph - ((ds.values[i] - yMin) / (yMax - yMin)) * ph;
        if (!isFinite(y)) continue;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ─── Grid Drawing ─────────────────────────────────────────────────────────

  function drawGrid(ctx, px, py, pw, ph, yMin, yMax, N, labels) {
    ctx.strokeStyle = '#333348';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#888';
    ctx.font = '10px Inter, system-ui, monospace';

    // Y-axis grid lines
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const y = py + (i / yTicks) * ph;
      const val = yMax - (i / yTicks) * (yMax - yMin);
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px + pw, y);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(formatNumber(val), px - 5, y + 3);
    }

    // X-axis ticks
    const xTicks = Math.min(N, 10);
    for (let i = 0; i <= xTicks; i++) {
      const x = px + (i / xTicks) * pw;
      const idx = Math.floor((i / xTicks) * (N - 1));
      ctx.beginPath();
      ctx.moveTo(x, py);
      ctx.lineTo(x, py + ph);
      ctx.stroke();
      ctx.textAlign = 'center';
      const label = labels && labels[idx] ? labels[idx] : String(idx);
      const shortLabel = label.length > 8 ? label.substring(0, 8) : label;
      ctx.fillText(shortLabel, x, py + ph + 15);
    }

    // Axes
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py + ph);
    ctx.lineTo(px + pw, py + ph);
    ctx.stroke();
  }

  // ─── Legend ───────────────────────────────────────────────────────────────

  function drawLegend(ctx, datasets, x, y) {
    ctx.textAlign = 'right';
    ctx.font = '11px Inter, system-ui, sans-serif';
    for (let i = 0; i < datasets.length; i++) {
      const ds = datasets[i];
      const color = ds.color || getColor(i);
      const ly = y + i * 18;
      ctx.fillStyle = color;
      ctx.fillRect(x - 12, ly - 6, 12, 12);
      ctx.fillStyle = '#ccc';
      ctx.fillText(ds.label || `Series ${i + 1}`, x - 16, ly + 4);
    }
  }

  // ─── No Data ──────────────────────────────────────────────────────────────

  function drawNoData(ctx, px, py, pw, ph) {
    ctx.fillStyle = '#666';
    ctx.font = '14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data to display', px + pw / 2, py + ph / 2);
    ctx.fillText('Connect blocks and run the pipeline', px + pw / 2, py + ph / 2 + 20);
  }

  // ─── Data Normalization ───────────────────────────────────────────────────

  function normalizeData(data) {
    if (!data) return { datasets: [], labels: [] };

    // Already in { datasets, labels } format
    if (data.datasets) return data;

    // Array of values
    if (Array.isArray(data) && typeof data[0] === 'number') {
      return {
        datasets: [{ values: data, label: 'Data' }],
        labels: data.map((_, i) => String(i))
      };
    }

    // { values, labels } format
    if (data.values && Array.isArray(data.values)) {
      return {
        datasets: [{ values: data.values, label: data.label || data.name || 'Data', fill: true }],
        labels: data.labels || data.values.map((_, i) => String(i))
      };
    }

    return { datasets: [], labels: [] };
  }

  // ─── Formatting ───────────────────────────────────────────────────────────

  function formatNumber(val) {
    if (Math.abs(val) >= 1000) return val.toFixed(0);
    if (Math.abs(val) >= 1) return val.toFixed(2);
    if (Math.abs(val) >= 0.01) return val.toFixed(4);
    return val.toExponential(2);
  }

  // ─── High-Level Visualization Functions ───────────────────────────────────

  function visualizeSignal(container, signal, options) {
    if (!signal || !signal.values) return;
    return createChart(container, 'line', {
      datasets: [{ values: signal.values, label: signal.name || 'Signal', fill: true }],
      labels: signal.labels
    }, {
      title: signal.name || 'Time Domain Signal',
      xLabel: 'Sample',
      yLabel: 'Amplitude',
      ...options
    });
  }

  function visualizeSpectrum(container, spectrum, options) {
    if (!spectrum || !spectrum.values) return;
    return createChart(container, 'bar', {
      datasets: [{ values: spectrum.values, label: spectrum.name || 'Spectrum' }],
      labels: spectrum.frequencies ? spectrum.frequencies.map(f => f.toFixed(1) + 'Hz') : undefined
    }, {
      title: spectrum.name || 'Frequency Spectrum',
      xLabel: 'Frequency',
      yLabel: spectrum.type === 'power' ? 'Power' : 'Magnitude',
      ...options
    });
  }

  function visualizeFeatures(container, features, options) {
    if (!features || !features.vectors || features.vectors.length === 0) return;

    // Show last feature vector as bar chart
    const lastVec = features.vectors[features.vectors.length - 1];
    return createChart(container, 'bar', {
      datasets: [{ values: lastVec, label: 'Features' }],
      labels: features.featureNames || lastVec.map((_, i) => `F${i}`)
    }, {
      title: 'Feature Vector',
      xLabel: 'Feature',
      yLabel: 'Value',
      ...options
    });
  }

  function visualizePredictions(container, predictions, options) {
    if (!predictions || !predictions.items || predictions.items.length === 0) return;

    // Show class distribution
    const classCounts = {};
    for (const item of predictions.items) {
      const cls = item.className || `Class ${item.classIndex}`;
      classCounts[cls] = (classCounts[cls] || 0) + 1;
    }

    const labels = Object.keys(classCounts);
    const values = Object.values(classCounts);

    return createChart(container, 'bar', {
      datasets: [{ values, label: 'Predictions' }],
      labels
    }, {
      title: 'Prediction Distribution',
      xLabel: 'Class',
      yLabel: 'Count',
      ...options
    });
  }

  function visualizeClassification(container, classification, options) {
    if (!classification || !classification.items) return;

    const labels = classification.classes || [];
    const counts = labels.map(cls =>
      classification.items.filter(i => i.label === cls).length
    );

    return createChart(container, 'bar', {
      datasets: [{ values: counts, label: 'Classification' }],
      labels
    }, {
      title: 'Classification Results',
      xLabel: 'Class',
      yLabel: 'Count',
      ...options
    });
  }

  function visualizeStats(container, stats, options) {
    if (!stats || !stats.values) return;
    const entries = Object.entries(stats.values);
    const labels = entries.map(([k]) => k);
    const values = entries.map(([, v]) => v);

    return createChart(container, 'bar', {
      datasets: [{ values, label: stats.name || 'Statistics' }],
      labels
    }, {
      title: stats.name || 'Statistics',
      xLabel: 'Metric',
      yLabel: 'Value',
      ...options
    });
  }

  function visualizeTrainingHistory(container, history, options) {
    if (!history || history.length === 0) return;
    return createChart(container, 'line', {
      datasets: [{ values: history.map(h => h.loss), label: 'Loss', fill: true }],
      labels: history.map(h => `${h.epoch}`)
    }, {
      title: 'Training Loss',
      xLabel: 'Epoch',
      yLabel: 'Loss',
      ...options
    });
  }

  // ─── Auto-Visualize Based on Data Type ────────────────────────────────────

  function autoVisualize(container, dataType, data, options) {
    switch (dataType) {
      case 'signal':
      case 'timeseries':
        return visualizeSignal(container, data, options);
      case 'spectrum':
        return visualizeSpectrum(container, data, options);
      case 'features':
        return visualizeFeatures(container, data, options);
      case 'predictions':
        return visualizePredictions(container, data, options);
      case 'classification':
        return visualizeClassification(container, data, options);
      case 'stats':
        return visualizeStats(container, data, options);
      default:
        if (data && data.values) return visualizeSignal(container, data, options);
        return null;
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  return {
    createChart,
    visualizeSignal,
    visualizeSpectrum,
    visualizeFeatures,
    visualizePredictions,
    visualizeClassification,
    visualizeStats,
    visualizeTrainingHistory,
    autoVisualize,
    getColor,
    palette
  };

})();
