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

  // ─── Spectrogram ──────────────────────────────────────────────────────────

  function visualizeSpectrogram(canvas, data, options) {
    const opts = {
      padding: { top: 40, right: 20, bottom: 50, left: 70 },
      title: 'Spectrogram',
      ...options
    };

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvas.width / dpr;
    const h = canvas.clientHeight || canvas.height / dpr;

    // Apply high-DPI scaling if not already done
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.scale(dpr, dpr);
    }

    // Background
    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, w, h);

    if (!data || !data.data || data.data.length === 0 || !data.times || !data.frequencies) {
      drawNoData(ctx, opts.padding.left, opts.padding.top,
        w - opts.padding.left - opts.padding.right,
        h - opts.padding.top - opts.padding.bottom);
      ctx.fillStyle = '#e0e0e0';
      ctx.font = 'bold 14px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(opts.title, w / 2, 20);
      return canvas;
    }

    const px = opts.padding.left;
    const py = opts.padding.top;
    const pw = w - opts.padding.left - opts.padding.right;
    const ph = h - opts.padding.top - opts.padding.bottom;

    const magnitudes = data.data;       // Array of time slices, each an array of freq bins
    const times = data.times;
    const frequencies = data.frequencies;
    const numTimes = magnitudes.length;
    const numFreqs = frequencies.length;

    // Find global min/max for normalization
    let globalMin = Infinity, globalMax = -Infinity;
    for (let t = 0; t < numTimes; t++) {
      for (let f = 0; f < numFreqs; f++) {
        const v = magnitudes[t][f];
        if (isFinite(v)) {
          if (v < globalMin) globalMin = v;
          if (v > globalMax) globalMax = v;
        }
      }
    }
    if (globalMin === globalMax) { globalMin -= 1; globalMax += 1; }
    const range = globalMax - globalMin;

    // Viridis-like thermal color palette stops: value 0-1 -> RGB
    // Stops: dark blue -> cyan-blue -> green -> yellow-green -> yellow -> white
    const colorStops = [
      { t: 0.00, r:   0, g:   0, b:  64 },
      { t: 0.20, r:   0, g:  64, b: 128 },
      { t: 0.40, r:   0, g: 128, b:   0 },
      { t: 0.60, r: 128, g: 128, b:   0 },
      { t: 0.80, r: 255, g: 255, b:   0 },
      { t: 1.00, r: 255, g: 255, b: 255 }
    ];

    function spectrogramColor(norm) {
      const v = Math.max(0, Math.min(1, norm));
      let lo = colorStops[0], hi = colorStops[colorStops.length - 1];
      for (let s = 0; s < colorStops.length - 1; s++) {
        if (v >= colorStops[s].t && v <= colorStops[s + 1].t) {
          lo = colorStops[s];
          hi = colorStops[s + 1];
          break;
        }
      }
      const span = hi.t - lo.t || 1;
      const frac = (v - lo.t) / span;
      return [
        Math.round(lo.r + frac * (hi.r - lo.r)),
        Math.round(lo.g + frac * (hi.g - lo.g)),
        Math.round(lo.b + frac * (hi.b - lo.b))
      ];
    }

    // Render pixel-by-pixel using ImageData
    const imgW = Math.max(1, Math.round(pw));
    const imgH = Math.max(1, Math.round(ph));
    const imageData = ctx.createImageData(imgW, imgH);
    const pixels = imageData.data;

    for (let py_ = 0; py_ < imgH; py_++) {
      // Frequency increases downward in pixel coords -> flip: top = high freq
      const fIdx = Math.floor((1 - py_ / (imgH - 1 || 1)) * (numFreqs - 1));
      const clampedF = Math.max(0, Math.min(numFreqs - 1, fIdx));

      for (let px_ = 0; px_ < imgW; px_++) {
        const tIdx = Math.floor((px_ / (imgW - 1 || 1)) * (numTimes - 1));
        const clampedT = Math.max(0, Math.min(numTimes - 1, tIdx));

        const val = magnitudes[clampedT][clampedF];
        const norm = isFinite(val) ? (val - globalMin) / range : 0;
        const [r, g, b] = spectrogramColor(norm);

        const i = (py_ * imgW + px_) * 4;
        pixels[i]     = r;
        pixels[i + 1] = g;
        pixels[i + 2] = b;
        pixels[i + 3] = 255;
      }
    }

    ctx.putImageData(imageData, px, py);

    // Draw border around plot area
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, pw, ph);

    // Frequency axis (Y) - left side
    ctx.fillStyle = '#888';
    ctx.font = '10px Inter, system-ui, monospace';
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const y = py + (i / yTicks) * ph;
      const freqIdx = Math.floor((1 - i / yTicks) * (numFreqs - 1));
      const freqVal = frequencies[Math.max(0, Math.min(numFreqs - 1, freqIdx))];
      const label = freqVal >= 1000 ? (freqVal / 1000).toFixed(1) + 'k' : freqVal.toFixed(0);
      ctx.textAlign = 'right';
      ctx.fillText(label + ' Hz', px - 5, y + 3);
      // Tick mark
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px - 3, y);
      ctx.lineTo(px, y);
      ctx.stroke();
    }

    // Time axis (X) - bottom
    const xTicks = Math.min(numTimes, 8);
    for (let i = 0; i <= xTicks; i++) {
      const x = px + (i / xTicks) * pw;
      const tIdx = Math.floor((i / xTicks) * (numTimes - 1));
      const tVal = times[Math.max(0, Math.min(numTimes - 1, tIdx))];
      const label = isFinite(tVal) ? tVal.toFixed(2) + 's' : String(tIdx);
      ctx.fillStyle = '#888';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, py + ph + 15);
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, py + ph);
      ctx.lineTo(x, py + ph + 3);
      ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = '#a0a0a0';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Time (s)', px + pw / 2, h - 5);

    ctx.save();
    ctx.translate(12, py + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Frequency', 0, 0);
    ctx.restore();

    // Title
    ctx.fillStyle = '#e0e0e0';
    ctx.font = 'bold 14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.title, w / 2, 20);

    return canvas;
  }

  // ─── Confusion Matrix ─────────────────────────────────────────────────────

  function visualizeConfusionMatrix(canvas, matrix, classNames) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvas.width / dpr;
    const h = canvas.clientHeight || canvas.height / dpr;

    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.scale(dpr, dpr);
    }

    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, w, h);

    if (!matrix || matrix.length === 0) {
      const px = 60, py = 40, pw = w - 80, ph = h - 90;
      drawNoData(ctx, px, py, pw, ph);
      ctx.fillStyle = '#e0e0e0';
      ctx.font = 'bold 14px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Confusion Matrix', w / 2, 20);
      return canvas;
    }

    const n = matrix.length;
    const names = classNames || matrix.map((_, i) => `C${i}`);

    // Compute padding based on longest class name
    ctx.font = '11px Inter, system-ui, monospace';
    let maxLabelW = 0;
    for (const name of names) {
      const mw = ctx.measureText(name).width;
      if (mw > maxLabelW) maxLabelW = mw;
    }
    const labelPad = Math.max(50, maxLabelW + 15);

    const padding = { top: 60, right: 20, bottom: labelPad + 20, left: labelPad };
    const px = padding.left;
    const py = padding.top;
    const pw = w - padding.left - padding.right;
    const ph = h - padding.top - padding.bottom;

    // Find max value for color scaling
    let maxVal = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (matrix[r][c] > maxVal) maxVal = matrix[r][c];
      }
    }
    if (maxVal === 0) maxVal = 1;

    const cellW = pw / n;
    const cellH = ph / n;

    // Draw cells
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const val = matrix[r][c];
        const norm = val / maxVal;
        // Blue color scale: low = near-black, high = bright blue
        const blue = Math.round(40 + norm * 215);
        const green = Math.round(norm * 80);
        const red = Math.round(norm * 20);

        const cx = px + c * cellW;
        const cy = py + r * cellH;

        ctx.fillStyle = `rgb(${red},${green},${blue})`;
        ctx.fillRect(cx + 1, cy + 1, cellW - 2, cellH - 2);

        // Cell count label
        ctx.fillStyle = norm > 0.5 ? '#ffffff' : '#aaaaaa';
        ctx.font = `${Math.max(9, Math.min(14, Math.floor(cellH * 0.35)))}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(String(val), cx + cellW / 2, cy + cellH / 2 + 4);
      }
    }

    // Grid lines
    ctx.strokeStyle = '#333348';
    ctx.lineWidth = 1;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(px + i * cellW, py);
      ctx.lineTo(px + i * cellW, py + ph);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px, py + i * cellH);
      ctx.lineTo(px + pw, py + i * cellH);
      ctx.stroke();
    }

    // Column labels (Predicted) - top
    ctx.fillStyle = '#a0a0a0';
    ctx.font = '10px Inter, system-ui, monospace';
    for (let c = 0; c < n; c++) {
      ctx.textAlign = 'center';
      ctx.fillText(names[c], px + c * cellW + cellW / 2, py - 10);
    }

    // Row labels (Actual) - left
    for (let r = 0; r < n; r++) {
      ctx.textAlign = 'right';
      ctx.fillText(names[r], px - 8, py + r * cellH + cellH / 2 + 3);
    }

    // Axis header labels
    ctx.fillStyle = '#cccccc';
    ctx.font = 'bold 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Predicted', px + pw / 2, py - 28);

    ctx.save();
    ctx.translate(14, py + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Actual', 0, 0);
    ctx.restore();

    // Title
    ctx.fillStyle = '#e0e0e0';
    ctx.font = 'bold 14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Confusion Matrix', w / 2, 20);

    return canvas;
  }

  // ─── Bode Plot ────────────────────────────────────────────────────────────

  function visualizeBodePlot(canvas, data, options) {
    const opts = {
      padding: { top: 40, right: 30, bottom: 50, left: 65 },
      title: 'Frequency Response (Bode Plot)',
      cutoffFrequency: null,
      ...options
    };

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvas.width / dpr;
    const h = canvas.clientHeight || canvas.height / dpr;

    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.scale(dpr, dpr);
    }

    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, w, h);

    if (!data || !data.frequencies || data.frequencies.length === 0 ||
        !data.magnitude || !data.phase) {
      const px = opts.padding.left, py = opts.padding.top;
      const pw = w - opts.padding.left - opts.padding.right;
      const ph = h - opts.padding.top - opts.padding.bottom;
      drawNoData(ctx, px, py, pw, ph);
      ctx.fillStyle = '#e0e0e0';
      ctx.font = 'bold 14px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(opts.title, w / 2, 20);
      return canvas;
    }

    const freqs = data.frequencies;
    const magnitudes = data.magnitude;
    const phases = data.phase;
    const N = freqs.length;

    const px = opts.padding.left;
    const totalPH = h - opts.padding.top - opts.padding.bottom;
    const gap = 30;                        // gap between the two sub-plots
    const magPH = (totalPH - gap) / 2;    // height of magnitude sub-plot
    const phsPH = (totalPH - gap) / 2;    // height of phase sub-plot
    const pw = w - opts.padding.left - opts.padding.right;

    const magPY = opts.padding.top;        // top of magnitude plot
    const phsPY = opts.padding.top + magPH + gap; // top of phase plot

    // Log-scale X helper
    const logMin = Math.log10(Math.max(freqs[0], 1e-9));
    const logMax = Math.log10(Math.max(freqs[N - 1], 1e-9));
    const logRange = logMax - logMin || 1;

    function freqToX(f) {
      const lf = Math.log10(Math.max(f, 1e-9));
      return px + ((lf - logMin) / logRange) * pw;
    }

    // Y ranges
    let magMin = Infinity, magMax = -Infinity;
    for (const v of magnitudes) { if (isFinite(v)) { magMin = Math.min(magMin, v); magMax = Math.max(magMax, v); } }
    if (magMin === magMax) { magMin -= 10; magMax += 10; }
    const magPad = (magMax - magMin) * 0.05;
    magMin -= magPad; magMax += magPad;

    let phsMin = Infinity, phsMax = -Infinity;
    for (const v of phases) { if (isFinite(v)) { phsMin = Math.min(phsMin, v); phsMax = Math.max(phsMax, v); } }
    if (phsMin === phsMax) { phsMin -= 45; phsMax += 45; }
    const phsPad = (phsMax - phsMin) * 0.05;
    phsMin -= phsPad; phsMax += phsPad;

    function drawSubPlot(plotY, plotH, yMin, yMax, values, color, yAxisLabel) {
      // Background
      ctx.fillStyle = '#252535';
      ctx.fillRect(px, plotY, pw, plotH);

      // Grid
      ctx.strokeStyle = '#333348';
      ctx.lineWidth = 1;
      const yTicks = 4;
      ctx.font = '10px Inter, system-ui, monospace';
      for (let i = 0; i <= yTicks; i++) {
        const y = plotY + (i / yTicks) * plotH;
        const val = yMax - (i / yTicks) * (yMax - yMin);
        ctx.beginPath();
        ctx.moveTo(px, y);
        ctx.lineTo(px + pw, y);
        ctx.stroke();
        ctx.fillStyle = '#888';
        ctx.textAlign = 'right';
        ctx.fillText(formatNumber(val), px - 5, y + 3);
      }

      // Log X-axis decade grid lines
      const decStart = Math.ceil(logMin);
      const decEnd = Math.floor(logMax);
      for (let dec = decStart; dec <= decEnd; dec++) {
        for (let m = 1; m <= 9; m++) {
          const f = m * Math.pow(10, dec);
          if (f < freqs[0] || f > freqs[N - 1]) continue;
          const x = freqToX(f);
          ctx.strokeStyle = m === 1 ? '#444455' : '#2a2a3a';
          ctx.lineWidth = m === 1 ? 1 : 0.5;
          ctx.beginPath();
          ctx.moveTo(x, plotY);
          ctx.lineTo(x, plotY + plotH);
          ctx.stroke();
        }
      }

      // Axes border
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;
      ctx.strokeRect(px, plotY, pw, plotH);

      // Data line
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < N; i++) {
        const x = freqToX(freqs[i]);
        const y = plotY + plotH - ((values[i] - yMin) / (yMax - yMin)) * plotH;
        if (!isFinite(x) || !isFinite(y)) continue;
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Cutoff frequency dashed line
      const cf = opts.cutoffFrequency || (data && data.cutoffFrequency);
      if (cf && cf > 0 && cf >= freqs[0] && cf <= freqs[N - 1]) {
        const x = freqToX(cf);
        ctx.save();
        ctx.strokeStyle = '#FFB74D';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(x, plotY);
        ctx.lineTo(x, plotY + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        ctx.fillStyle = '#FFB74D';
        ctx.font = '9px Inter, system-ui, monospace';
        ctx.textAlign = 'left';
        const cfLabel = cf >= 1000 ? (cf / 1000).toFixed(1) + 'kHz' : cf.toFixed(0) + 'Hz';
        ctx.fillText(cfLabel, x + 3, plotY + 12);
      }

      // Y-axis rotated label
      ctx.save();
      ctx.fillStyle = '#a0a0a0';
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.translate(12, plotY + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(yAxisLabel, 0, 0);
      ctx.restore();
    }

    // Draw magnitude sub-plot
    drawSubPlot(magPY, magPH, magMin, magMax, magnitudes, '#4FC3F7', 'Magnitude (dB)');

    // Draw phase sub-plot
    drawSubPlot(phsPY, phsPH, phsMin, phsMax, phases, '#81C784', 'Phase (deg)');

    // X-axis tick labels (shared, drawn below phase plot)
    ctx.fillStyle = '#888';
    ctx.font = '10px Inter, system-ui, monospace';
    const decStart2 = Math.ceil(logMin);
    const decEnd2 = Math.floor(logMax);
    for (let dec = decStart2; dec <= decEnd2; dec++) {
      const f = Math.pow(10, dec);
      const x = freqToX(f);
      const label = f >= 1000 ? (f / 1000) + 'k' : String(f);
      ctx.textAlign = 'center';
      ctx.fillText(label, x, phsPY + phsPH + 15);
    }

    // X-axis label
    ctx.fillStyle = '#a0a0a0';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Frequency (Hz)', px + pw / 2, h - 5);

    // Title
    ctx.fillStyle = '#e0e0e0';
    ctx.font = 'bold 14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.title, w / 2, 20);

    // Sub-plot titles
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Magnitude', px + 4, magPY + 14);
    ctx.fillText('Phase', px + 4, phsPY + 14);

    return canvas;
  }

  // ─── Radar Chart ──────────────────────────────────────────────────────────

  function visualizeRadar(canvas, data, labels) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvas.width / dpr;
    const h = canvas.clientHeight || canvas.height / dpr;

    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.scale(dpr, dpr);
    }

    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, w, h);

    const title = 'Radar Chart';

    if (!data || data.length === 0 || !labels || labels.length === 0) {
      const px = 60, py = 40, pw = w - 80, ph = h - 90;
      drawNoData(ctx, px, py, pw, ph);
      ctx.fillStyle = '#e0e0e0';
      ctx.font = 'bold 14px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, w / 2, 20);
      return canvas;
    }

    const numSpokes = labels.length;

    // Reserve bottom space for legend
    const legendH = data.length > 1 ? data.length * 18 + 10 : 0;
    const titleH = 30;
    const labelPad = 30;   // extra space around radar for axis labels

    const cx = w / 2;
    const cy = titleH + (h - titleH - legendH - 20) / 2;
    const radius = Math.min(
      (w / 2) - labelPad - 20,
      (h - titleH - legendH - 40) / 2 - labelPad
    );

    if (radius <= 0) {
      drawNoData(ctx, 0, 0, w, h);
      return canvas;
    }

    // Normalize each feature (spoke) across all datasets to 0-1
    const numFeatures = numSpokes;
    const featureMins = new Array(numFeatures).fill(Infinity);
    const featureMaxs = new Array(numFeatures).fill(-Infinity);
    for (const ds of data) {
      if (!ds.values) continue;
      for (let f = 0; f < numFeatures; f++) {
        const v = ds.values[f];
        if (isFinite(v)) {
          if (v < featureMins[f]) featureMins[f] = v;
          if (v > featureMaxs[f]) featureMaxs[f] = v;
        }
      }
    }
    for (let f = 0; f < numFeatures; f++) {
      if (featureMins[f] === featureMaxs[f]) {
        featureMins[f] -= 0.5;
        featureMaxs[f] += 0.5;
      }
    }

    function spokeAngle(i) {
      // Start at the top (-PI/2), go clockwise
      return -Math.PI / 2 + (2 * Math.PI * i) / numSpokes;
    }

    // Concentric rings
    const ringLevels = [0.25, 0.5, 0.75, 1.0];
    for (const level of ringLevels) {
      ctx.strokeStyle = level === 1.0 ? '#555566' : '#333348';
      ctx.lineWidth = level === 1.0 ? 1.5 : 1;
      ctx.beginPath();
      for (let i = 0; i < numSpokes; i++) {
        const angle = spokeAngle(i);
        const x = cx + Math.cos(angle) * radius * level;
        const y = cy + Math.sin(angle) * radius * level;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();

      // Ring label (at top-right spoke direction)
      if (numSpokes > 0) {
        const labelAngle = spokeAngle(0) + 0.05;
        const lx = cx + Math.cos(labelAngle) * radius * level;
        const ly = cy + Math.sin(labelAngle) * radius * level;
        ctx.fillStyle = '#666677';
        ctx.font = '9px Inter, system-ui, monospace';
        ctx.textAlign = 'left';
        ctx.fillText((level * 100).toFixed(0) + '%', lx + 2, ly - 2);
      }
    }

    // Spokes
    ctx.strokeStyle = '#444455';
    ctx.lineWidth = 1;
    for (let i = 0; i < numSpokes; i++) {
      const angle = spokeAngle(i);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      ctx.stroke();
    }

    // Spoke labels
    ctx.fillStyle = '#cccccc';
    ctx.font = '11px Inter, system-ui, sans-serif';
    for (let i = 0; i < numSpokes; i++) {
      const angle = spokeAngle(i);
      const labelR = radius + 18;
      const lx = cx + Math.cos(angle) * labelR;
      const ly = cy + Math.sin(angle) * labelR;

      // Align text based on position relative to center
      if (Math.abs(Math.cos(angle)) < 0.15) {
        ctx.textAlign = 'center';
      } else {
        ctx.textAlign = Math.cos(angle) > 0 ? 'left' : 'right';
      }
      ctx.fillText(labels[i], lx, ly + 4);
    }

    // Dataset polygons
    for (let d = 0; d < data.length; d++) {
      const ds = data[d];
      if (!ds.values) continue;
      const color = ds.color || getColor(d);

      ctx.beginPath();
      let hasPoint = false;
      for (let i = 0; i < numSpokes; i++) {
        const raw = ds.values[i];
        const norm = isFinite(raw)
          ? (raw - featureMins[i]) / (featureMaxs[i] - featureMins[i])
          : 0;
        const clamped = Math.max(0, Math.min(1, norm));
        const angle = spokeAngle(i);
        const x = cx + Math.cos(angle) * radius * clamped;
        const y = cy + Math.sin(angle) * radius * clamped;
        if (!hasPoint) { ctx.moveTo(x, y); hasPoint = true; }
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      // Filled polygon
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Polygon outline
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Data point dots
      ctx.fillStyle = color;
      for (let i = 0; i < numSpokes; i++) {
        const raw = ds.values[i];
        const norm = isFinite(raw)
          ? (raw - featureMins[i]) / (featureMaxs[i] - featureMins[i])
          : 0;
        const clamped = Math.max(0, Math.min(1, norm));
        const angle = spokeAngle(i);
        const x = cx + Math.cos(angle) * radius * clamped;
        const y = cy + Math.sin(angle) * radius * clamped;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Legend
    if (data.length > 1) {
      const legendY = h - legendH + 10;
      const legendX = cx;
      ctx.font = '11px Inter, system-ui, sans-serif';
      for (let d = 0; d < data.length; d++) {
        const ds = data[d];
        const color = ds.color || getColor(d);
        const ly = legendY + d * 18;
        const blockX = legendX - ctx.measureText(ds.label || `Series ${d + 1}`).width / 2 - 10;
        ctx.fillStyle = color;
        ctx.fillRect(blockX, ly - 6, 12, 12);
        ctx.fillStyle = '#ccc';
        ctx.textAlign = 'left';
        ctx.fillText(ds.label || `Series ${d + 1}`, blockX + 16, ly + 4);
      }
    }

    // Title
    ctx.fillStyle = '#e0e0e0';
    ctx.font = 'bold 14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, w / 2, 20);

    return canvas;
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
        // Check for spectrogram data
        if (data && data.data && data.times && data.frequencies) {
          const canvas = _resolveCanvas(container);
          if (canvas) return visualizeSpectrogram(canvas, data, options);
        }
        // Check for confusion matrix
        if (data && data._type === 'confusionMatrix') {
          const canvas = _resolveCanvas(container);
          if (canvas) return visualizeConfusionMatrix(canvas, data.matrix, data.classNames);
        }
        // Check for bode plot
        if (data && data._type === 'bodePlot') {
          const canvas = _resolveCanvas(container);
          if (canvas) return visualizeBodePlot(canvas, data, options);
        }
        if (data && data.values) return visualizeSignal(container, data, options);
        return null;
    }
  }

  // Helper: resolve a canvas element from a container reference or ID
  function _resolveCanvas(container) {
    const wrapper = typeof container === 'string'
      ? document.getElementById(container)
      : container;
    if (!wrapper) return null;
    if (wrapper.tagName === 'CANVAS') return wrapper;
    let c = wrapper.querySelector('canvas');
    if (!c) {
      c = document.createElement('canvas');
      wrapper.innerHTML = '';
      c.style.width = '100%';
      c.style.height = '100%';
      const dpr = window.devicePixelRatio || 1;
      c.width = (wrapper.clientWidth || 500) * dpr;
      c.height = (wrapper.clientHeight || 300) * dpr;
      wrapper.appendChild(c);
      c.getContext('2d').scale(dpr, dpr);
    }
    return c;
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
    visualizeSpectrogram,
    visualizeConfusionMatrix,
    visualizeBodePlot,
    visualizeRadar,
    autoVisualize,
    getColor,
    palette
  };

})();
