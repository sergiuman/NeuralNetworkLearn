// =============================================================================
// Data.js - Data I/O and Sample Data Generation
// =============================================================================

const DataIO = (() => {

  // ─── CSV Parsing ──────────────────────────────────────────────────────────

  function parseCSV(text, options) {
    const {
      delimiter = ',',
      hasHeader = true,
      skipEmptyLines = true,
      columnIndex = null
    } = options || {};

    const lines = text.split(/\r?\n/);
    if (skipEmptyLines) {
      const filtered = lines.filter(l => l.trim().length > 0);
      lines.length = 0;
      lines.push(...filtered);
    }

    if (lines.length === 0) return { headers: [], columns: [], data: [] };

    let headers = [];
    let startRow = 0;

    if (hasHeader) {
      headers = parseCSVLine(lines[0], delimiter);
      startRow = 1;
    }

    const rows = [];
    for (let i = startRow; i < lines.length; i++) {
      const fields = parseCSVLine(lines[i], delimiter);
      if (fields.length > 0) rows.push(fields);
    }

    if (!hasHeader && rows.length > 0) {
      headers = rows[0].map((_, i) => `Column ${i + 1}`);
    }

    // Extract columns as numeric arrays
    const columns = {};
    for (let c = 0; c < headers.length; c++) {
      columns[headers[c]] = rows.map(row => {
        const val = parseFloat(row[c]);
        return isNaN(val) ? row[c] : val;
      });
    }

    // If a specific column is requested
    if (columnIndex !== null && columnIndex !== undefined) {
      const key = typeof columnIndex === 'number' ? headers[columnIndex] : columnIndex;
      return {
        headers: [key],
        columns: { [key]: columns[key] },
        data: columns[key] || [],
        allHeaders: headers,
        allColumns: columns
      };
    }

    return { headers, columns, data: rows, raw: text };
  }

  function parseCSVLine(line, delimiter) {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === delimiter) {
          fields.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    fields.push(current.trim());
    return fields;
  }

  // ─── CSV Generation ───────────────────────────────────────────────────────

  function toCSV(headers, data) {
    const lines = [headers.join(',')];
    for (const row of data) {
      lines.push(row.map(v =>
        typeof v === 'string' && v.includes(',') ? `"${v}"` : String(v)
      ).join(','));
    }
    return lines.join('\n');
  }

  // ─── Excel Parsing (via SheetJS if available) ─────────────────────────────

  function parseExcel(arrayBuffer) {
    if (typeof XLSX === 'undefined') {
      throw new Error('SheetJS (XLSX) library not loaded. Cannot parse Excel files.');
    }

    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const csvText = XLSX.utils.sheet_to_csv(sheet);
    return parseCSV(csvText);
  }

  // ─── File Reading ─────────────────────────────────────────────────────────

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const ext = file.name.split('.').pop().toLowerCase();

      if (ext === 'xlsx' || ext === 'xls') {
        reader.onload = () => {
          try {
            resolve(parseExcel(reader.result));
          } catch (e) {
            reject(e);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        reader.onload = () => {
          try {
            resolve(parseCSV(reader.result));
          } catch (e) {
            reject(e);
          }
        };
        reader.readAsText(file);
      }
    });
  }

  // ─── Sample Data Generators ───────────────────────────────────────────────

  const generators = {

    sineWave(config) {
      const {
        samples = 256,
        frequency = 10,
        sampleRate = 256,
        amplitude = 1,
        phase = 0,
        noise = 0,
        dcOffset = 0
      } = config || {};

      const data = [];
      for (let i = 0; i < samples; i++) {
        const t = i / sampleRate;
        let value = amplitude * Math.sin(2 * Math.PI * frequency * t + phase) + dcOffset;
        if (noise > 0) value += (Math.random() * 2 - 1) * noise;
        data.push(value);
      }
      return {
        values: data,
        sampleRate,
        labels: data.map((_, i) => (i / sampleRate).toFixed(4)),
        name: `Sine ${frequency}Hz`,
        description: `Sine wave: ${frequency}Hz, amplitude=${amplitude}, samples=${samples}`
      };
    },

    multiSine(config) {
      const {
        samples = 256,
        frequencies = [5, 15, 30],
        amplitudes = [1, 0.5, 0.3],
        sampleRate = 256,
        noise = 0
      } = config || {};

      const data = new Array(samples).fill(0);
      for (let f = 0; f < frequencies.length; f++) {
        for (let i = 0; i < samples; i++) {
          const t = i / sampleRate;
          const amp = amplitudes[f] || 1;
          data[i] += amp * Math.sin(2 * Math.PI * frequencies[f] * t);
        }
      }
      if (noise > 0) {
        for (let i = 0; i < samples; i++) {
          data[i] += (Math.random() * 2 - 1) * noise;
        }
      }
      return {
        values: data,
        sampleRate,
        labels: data.map((_, i) => (i / sampleRate).toFixed(4)),
        name: `Multi-Sine (${frequencies.join(', ')}Hz)`,
        description: `Composite sine: ${frequencies.map((f, i) => `${f}Hz×${amplitudes[i] || 1}`).join(' + ')}`
      };
    },

    chirp(config) {
      const {
        samples = 512,
        startFreq = 1,
        endFreq = 50,
        sampleRate = 256,
        amplitude = 1
      } = config || {};

      const duration = samples / sampleRate;
      const data = [];
      for (let i = 0; i < samples; i++) {
        const t = i / sampleRate;
        const freq = startFreq + (endFreq - startFreq) * t / duration;
        data.push(amplitude * Math.sin(2 * Math.PI * freq * t));
      }
      return {
        values: data,
        sampleRate,
        labels: data.map((_, i) => (i / sampleRate).toFixed(4)),
        name: `Chirp ${startFreq}-${endFreq}Hz`,
        description: `Chirp signal from ${startFreq}Hz to ${endFreq}Hz`
      };
    },

    squareWave(config) {
      const {
        samples = 256,
        frequency = 5,
        sampleRate = 256,
        amplitude = 1,
        dutyCycle = 0.5,
        noise = 0
      } = config || {};

      const data = [];
      for (let i = 0; i < samples; i++) {
        const t = i / sampleRate;
        const phase = (t * frequency) % 1;
        let value = phase < dutyCycle ? amplitude : -amplitude;
        if (noise > 0) value += (Math.random() * 2 - 1) * noise;
        data.push(value);
      }
      return {
        values: data,
        sampleRate,
        labels: data.map((_, i) => (i / sampleRate).toFixed(4)),
        name: `Square ${frequency}Hz`,
        description: `Square wave: ${frequency}Hz, duty=${dutyCycle * 100}%`
      };
    },

    stockMarket(config) {
      const {
        samples = 500,
        startPrice = 100,
        volatility = 0.02,
        drift = 0.0001,
        trend = 'mixed' // 'up', 'down', 'mixed'
      } = config || {};

      let price = startPrice;
      const data = [price];

      for (let i = 1; i < samples; i++) {
        const driftAdj = trend === 'up' ? Math.abs(drift)
          : trend === 'down' ? -Math.abs(drift)
          : drift * (Math.sin(2 * Math.PI * i / samples * 3) > 0 ? 1 : -1);
        const change = driftAdj + volatility * (Math.random() * 2 - 1);
        price = price * (1 + change);
        price = Math.max(price, startPrice * 0.1);
        data.push(price);
      }

      return {
        values: data,
        sampleRate: 1,
        labels: data.map((_, i) => `Day ${i + 1}`),
        name: 'Stock Price',
        description: `Simulated stock: start=$${startPrice}, volatility=${volatility}`
      };
    },

    ecg(config) {
      const {
        samples = 512,
        sampleRate = 360,
        heartRate = 72,
        noise = 0.02
      } = config || {};

      const data = [];
      const period = sampleRate * 60 / heartRate;

      for (let i = 0; i < samples; i++) {
        const phase = (i % period) / period;
        let value = 0;

        // P wave
        if (phase > 0.05 && phase < 0.15) {
          value += 0.15 * Math.sin(Math.PI * (phase - 0.05) / 0.1);
        }
        // QRS complex
        if (phase > 0.2 && phase < 0.22) {
          value -= 0.1 * Math.sin(Math.PI * (phase - 0.2) / 0.02);
        }
        if (phase > 0.22 && phase < 0.28) {
          value += 1.0 * Math.sin(Math.PI * (phase - 0.22) / 0.06);
        }
        if (phase > 0.28 && phase < 0.30) {
          value -= 0.15 * Math.sin(Math.PI * (phase - 0.28) / 0.02);
        }
        // T wave
        if (phase > 0.35 && phase < 0.5) {
          value += 0.25 * Math.sin(Math.PI * (phase - 0.35) / 0.15);
        }

        if (noise > 0) value += (Math.random() * 2 - 1) * noise;
        data.push(value);
      }

      return {
        values: data,
        sampleRate,
        labels: data.map((_, i) => (i / sampleRate * 1000).toFixed(1) + 'ms'),
        name: 'ECG Signal',
        description: `Simulated ECG: ${heartRate} BPM, ${sampleRate}Hz`
      };
    },

    eeg(config) {
      const {
        samples = 512,
        sampleRate = 256,
        dominantBand = 'alpha', // delta, theta, alpha, beta, gamma
        noise = 0.1
      } = config || {};

      const bands = {
        delta: { freq: [0.5, 4], amp: 1.0 },
        theta: { freq: [4, 8], amp: 0.7 },
        alpha: { freq: [8, 13], amp: 0.5 },
        beta: { freq: [13, 30], amp: 0.3 },
        gamma: { freq: [30, 50], amp: 0.15 }
      };

      const data = new Array(samples).fill(0);
      for (const [bandName, band] of Object.entries(bands)) {
        const amp = bandName === dominantBand ? band.amp * 2 : band.amp;
        const numComponents = 3;
        for (let c = 0; c < numComponents; c++) {
          const freq = band.freq[0] + Math.random() * (band.freq[1] - band.freq[0]);
          const ph = Math.random() * 2 * Math.PI;
          for (let i = 0; i < samples; i++) {
            data[i] += amp / numComponents * Math.sin(2 * Math.PI * freq * i / sampleRate + ph);
          }
        }
      }

      if (noise > 0) {
        for (let i = 0; i < samples; i++) {
          data[i] += (Math.random() * 2 - 1) * noise;
        }
      }

      return {
        values: data,
        sampleRate,
        labels: data.map((_, i) => (i / sampleRate * 1000).toFixed(1) + 'ms'),
        name: `EEG (${dominantBand})`,
        description: `Simulated EEG: dominant ${dominantBand} band, ${sampleRate}Hz`
      };
    },

    vibration(config) {
      const {
        samples = 1024,
        sampleRate = 1024,
        fundamentalFreq = 25,
        harmonics = 3,
        damping = 0.001,
        noise = 0.05
      } = config || {};

      const data = [];
      for (let i = 0; i < samples; i++) {
        const t = i / sampleRate;
        let value = 0;
        for (let h = 1; h <= harmonics; h++) {
          const amp = (1 / h) * Math.exp(-damping * t * h);
          value += amp * Math.sin(2 * Math.PI * fundamentalFreq * h * t);
        }
        if (noise > 0) value += (Math.random() * 2 - 1) * noise;
        data.push(value);
      }

      return {
        values: data,
        sampleRate,
        labels: data.map((_, i) => (i / sampleRate * 1000).toFixed(1) + 'ms'),
        name: `Vibration ${fundamentalFreq}Hz`,
        description: `Vibration signal: ${fundamentalFreq}Hz fundamental, ${harmonics} harmonics`
      };
    },

    randomWalk(config) {
      const {
        samples = 256,
        stepSize = 0.1,
        startValue = 0
      } = config || {};

      let value = startValue;
      const data = [value];
      for (let i = 1; i < samples; i++) {
        value += (Math.random() * 2 - 1) * stepSize;
        data.push(value);
      }

      return {
        values: data,
        sampleRate: 1,
        labels: data.map((_, i) => `${i}`),
        name: 'Random Walk',
        description: `Random walk: step=${stepSize}`
      };
    },

    classificationDemo(config) {
      const {
        samplesPerClass = 50,
        windowSize = 32,
        sampleRate = 256,
        classes = ['Class A', 'Class B']
      } = config || {};

      // Generate labeled time-series windows
      const windows = [];
      const labels = [];

      for (let c = 0; c < classes.length; c++) {
        for (let s = 0; s < samplesPerClass; s++) {
          const data = [];
          const baseFreq = 5 + c * 15;
          const amplitude = 0.5 + c * 0.5;
          for (let i = 0; i < windowSize; i++) {
            const t = i / sampleRate;
            data.push(amplitude * Math.sin(2 * Math.PI * baseFreq * t)
              + (Math.random() * 2 - 1) * 0.1);
          }
          windows.push(data);
          labels.push(c);
        }
      }

      // Shuffle
      const indices = Array.from({ length: windows.length }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      return {
        windows: indices.map(i => windows[i]),
        labels: indices.map(i => labels[i]),
        classNames: classes,
        windowSize,
        sampleRate,
        name: 'Classification Demo',
        description: `${classes.length} classes, ${samplesPerClass} samples each, window=${windowSize}`
      };
    }
  };

  // ─── Data Utilities ───────────────────────────────────────────────────────

  function getColumnNames(parsed) {
    return parsed.headers || [];
  }

  function getNumericColumns(parsed) {
    return parsed.headers.filter(h => {
      const col = parsed.columns[h];
      return col && col.every(v => typeof v === 'number' && !isNaN(v));
    });
  }

  function columnToArray(parsed, columnName) {
    return (parsed.columns[columnName] || []).map(v => Number(v));
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  return {
    parseCSV,
    parseExcel,
    readFile,
    toCSV,
    generators,
    getColumnNames,
    getNumericColumns,
    columnToArray
  };

})();
