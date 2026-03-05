// =============================================================================
// Blocks.js - Processing Block Definitions and Registry
// =============================================================================

const BlockRegistry = (() => {

  // ─── Block Type Definitions ───────────────────────────────────────────────

  const blockTypes = {

    // ── Data Source ──────────────────────────────────────────────────────────

    dataSource: {
      name: 'Data Source',
      category: 'input',
      icon: '📁',
      color: '#4CAF50',
      description: 'Your pipeline starting point. Generate synthetic signals (sine wave, ECG, EEG, EMG, stock prices, vibration, audio...) or load real data from a CSV or Excel file.',
      inputs: [],
      outputs: [{ name: 'signal', type: 'timeseries', label: 'Signal', description: 'Time-series signal — amplitude values sampled at a fixed rate. Connect this to Windowing, FFT, or Statistics.' }],
      defaultConfig: {
        source: 'generate',      // 'generate', 'csv', 'manual'
        generator: 'sineWave',
        generatorConfig: { samples: 256, frequency: 10, sampleRate: 256, amplitude: 1, noise: 0, position: 0.5 },
        csvData: null,
        csvColumn: null,
        sampleRate: 256,
        manualData: ''
      },
      configUI: [
        { key: 'source', label: 'Source', type: 'select', options: [
          { value: 'generate', label: 'Generate Sample Data' },
          { value: 'csv', label: 'Upload CSV/Excel' },
          { value: 'manual', label: 'Enter Data Manually' },
          { value: 'microphone', label: 'Live Microphone' }
        ]},
        { key: 'generator', label: 'Generator', type: 'select', showIf: { source: 'generate' }, options: [
          { value: 'sineWave', label: 'Sine Wave' },
          { value: 'multiSine', label: 'Multi-Sine Composite' },
          { value: 'chirp', label: 'Chirp (Frequency Sweep)' },
          { value: 'squareWave', label: 'Square Wave' },
          { value: 'stockMarket', label: 'Stock Market Simulation' },
          { value: 'ecg', label: 'ECG (Heart Signal)' },
          { value: 'eeg', label: 'EEG (Brain Signal)' },
          { value: 'vibration', label: 'Mechanical Vibration' },
          { value: 'emg', label: 'EMG (Hand Muscle)' },
          { value: 'audioSignal', label: 'Audio Signal' },
          { value: 'randomWalk', label: 'Random Walk' },
          { value: 'whiteNoise', label: 'White Noise' },
          { value: 'pinkNoise', label: 'Pink Noise' },
          { value: 'sawtooth', label: 'Sawtooth Wave' },
          { value: 'impulse', label: 'Impulse' },
          { value: 'stepFunction', label: 'Step Function' }
        ]},
        { key: 'generatorConfig.samples', label: 'Number of Samples', type: 'number', min: 8, max: 8192, step: 1, showIf: { source: 'generate' } },
        { key: 'generatorConfig.frequency', label: 'Frequency (Hz)', type: 'number', min: 0.1, max: 1000, step: 0.1, showIf: { source: 'generate' } },
        { key: 'generatorConfig.sampleRate', label: 'Sample Rate (Hz)', type: 'number', min: 1, max: 10000, step: 1, showIf: { source: 'generate' } },
        { key: 'generatorConfig.amplitude', label: 'Amplitude', type: 'number', min: 0.01, max: 100, step: 0.01, showIf: { source: 'generate' } },
        { key: 'generatorConfig.noise', label: 'Noise Level', type: 'number', min: 0, max: 2, step: 0.01, showIf: { source: 'generate' } },
        { key: 'csvFile', label: 'Upload File', type: 'file', accept: '.csv,.xlsx,.xls,.tsv', showIf: { source: 'csv' } },
        { key: 'csvColumn', label: 'Column', type: 'select', dynamic: 'csvColumns', showIf: { source: 'csv' } },
        { key: 'sampleRate', label: 'Sample Rate (Hz)', type: 'number', min: 1, max: 100000, step: 1 },
        { key: 'manualData', label: 'Data (comma-separated)', type: 'textarea', showIf: { source: 'manual' }, placeholder: '1.0, 2.0, 3.0, ...' }
      ],
      process(config, inputs) {
        let result;
        if (config.source === 'generate') {
          const gen = DataIO.generators[config.generator];
          if (!gen) throw new Error(`Unknown generator: ${config.generator}`);
          result = gen(config.generatorConfig);
          // Enrich signal with metadata
          if (!result.label) {
            const metaMap = {
              stockMarket: { label: `${config.generatorConfig?.symbol || 'Stock'} Close Price`, units: 'USD' },
              sineWave: { label: 'Sine Wave', units: 'Amplitude' },
              ecg: { label: 'ECG Signal', units: 'mV' },
              eeg: { label: 'EEG Signal', units: 'µV' },
              emg: { label: 'EMG Signal', units: 'mV' },
              vibration: { label: 'Vibration', units: 'g' },
              audioSignal: { label: 'Audio', units: 'dB' },
              chirp: { label: 'Chirp', units: 'Amplitude' },
              randomWalk: { label: 'Random Walk', units: 'Value' },
              whiteNoise: { label: 'White Noise', units: 'Amplitude' },
              pinkNoise: { label: 'Pink Noise', units: 'Amplitude' }
            };
            const meta = metaMap[config.generator] || { label: config.generator || 'Signal', units: '' };
            result.label = meta.label;
            result.units = meta.units;
            result.source = 'generated';
          }
        } else if (config.source === 'csv' && config.csvData) {
          // Handle both raw CSV text and pre-parsed objects
          const parsed = typeof config.csvData === 'string'
            ? DataIO.parseCSV(config.csvData)
            : config.csvData;
          const values = config.csvColumn
            ? DataIO.columnToArray(parsed, config.csvColumn)
            : Object.values(parsed.columns)[0].map(Number);
          result = {
            values: values.filter(v => !isNaN(v)),
            sampleRate: config.sampleRate,
            labels: values.map((_, i) => String(i)),
            name: config.csvColumn || 'CSV Data'
          };
        } else if (config.source === 'manual') {
          const values = config.manualData.split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v));
          result = {
            values,
            sampleRate: config.sampleRate,
            labels: values.map((_, i) => String(i)),
            name: 'Manual Data'
          };
        } else if (config.source === 'microphone') {
          // MicrophoneInput.getLatestBuffer() returns Float32Array or null
          const buf = (typeof MicrophoneInput !== 'undefined' && MicrophoneInput.getLatestBuffer && MicrophoneInput.getLatestBuffer());
          const values = buf ? Array.from(buf) : [];
          result = {
            values: values.length > 0 ? values : [0],
            sampleRate: (typeof MicrophoneInput !== 'undefined' && MicrophoneInput.getSampleRate) ? MicrophoneInput.getSampleRate() : 44100,
            labels: values.map((_, i) => String(i)),
            name: 'Microphone'
          };
        } else {
          result = { values: [], sampleRate: config.sampleRate, labels: [], name: 'Empty' };
        }

        return { signal: result };
      }
    },

    // ── Windowing / Sampling ────────────────────────────────────────────────

    windowing: {
      name: 'Windowing',
      category: 'preprocessing',
      icon: '🪟',
      color: '#2196F3',
      description: 'Splits a continuous signal into short overlapping time frames and applies a window function to reduce spectral leakage. Use this before FFT for best results.',
      inputs: [{ name: 'signal', type: 'timeseries', label: 'Signal', description: 'Raw time-series signal to divide into fixed-size windows. Connect from a Data Source block.' }],
      outputs: [{ name: 'segments', type: 'segments', label: 'Segments', description: 'Array of overlapping time windows. Each window is a short slice of the signal, ready for FFT or Statistics.' }],
      defaultConfig: {
        windowSize: 32,
        overlap: 0.5,
        windowFunction: 'hanning',
        applyWindow: true
      },
      configUI: [
        { key: 'windowSize', label: 'Window Size (samples)', type: 'number', min: 4, max: 4096, step: 1 },
        { key: 'overlap', label: 'Overlap (0-1)', type: 'number', min: 0, max: 0.99, step: 0.05 },
        { key: 'windowFunction', label: 'Window Function', type: 'select', options: [
          { value: 'rectangular', label: 'Rectangular (None)' },
          { value: 'hanning', label: 'Hanning' },
          { value: 'hamming', label: 'Hamming' },
          { value: 'blackman', label: 'Blackman' },
          { value: 'bartlett', label: 'Bartlett' },
          { value: 'flat-top', label: 'Flat-Top' }
        ]},
        { key: 'applyWindow', label: 'Apply Window Function', type: 'checkbox' }
      ],
      process(config, inputs) {
        const signal = inputs.signal;
        if (!signal || !signal.values || signal.values.length === 0) {
          return { segments: { windows: [], sampleRate: 0, windowSize: config.windowSize } };
        }

        let segments = DSP.segmentSignal(signal.values, config.windowSize, config.overlap);

        if (config.applyWindow && config.windowFunction !== 'rectangular') {
          segments = segments.map(seg => DSP.applyWindow(seg, config.windowFunction));
        }

        return {
          segments: {
            windows: segments,
            sampleRate: signal.sampleRate,
            windowSize: config.windowSize,
            overlap: config.overlap,
            windowFunction: config.windowFunction,
            originalSignal: signal
          }
        };
      }
    },

    // ── FFT / Frequency Transform ───────────────────────────────────────────

    fftBlock: {
      name: 'FFT',
      category: 'transform',
      icon: '📊',
      color: '#9C27B0',
      description: 'Transforms a time-domain signal into the frequency domain using the Fast Fourier Transform (FFT). Reveals which frequencies are present and how strong they are.',
      inputs: [
        { name: 'signal', type: 'timeseries', label: 'Signal', optional: true, description: 'Raw time-series signal. The block applies a window function internally before computing the FFT.' },
        { name: 'segments', type: 'segments', label: 'Segments', optional: true, description: 'Pre-windowed signal segments from a Windowing block. FFT is computed on every window separately.' }
      ],
      outputs: [
        { name: 'spectrum', type: 'spectrum', label: 'Spectrum', description: 'Frequency spectrum showing amplitude (or power/phase) at each frequency bin — ideal for visualization.' },
        { name: 'features', type: 'features', label: 'Features', description: 'FFT coefficients packed as compact feature vectors — ideal input for a Neural Network or Fuzzy Classifier.' }
      ],
      defaultConfig: {
        numCoefficients: 10,
        windowFunction: 'hanning',
        outputType: 'magnitude', // 'magnitude', 'power', 'phase', 'complex'
        normalize: true,
        logScale: false
      },
      configUI: [
        { key: 'numCoefficients', label: 'Number of Coefficients', type: 'number', min: 1, max: 512, step: 1 },
        { key: 'windowFunction', label: 'Window (if raw signal)', type: 'select', options: [
          { value: 'rectangular', label: 'None' },
          { value: 'hanning', label: 'Hanning' },
          { value: 'hamming', label: 'Hamming' },
          { value: 'blackman', label: 'Blackman' }
        ]},
        { key: 'outputType', label: 'Output Type', type: 'select', options: [
          { value: 'magnitude', label: 'Magnitude' },
          { value: 'power', label: 'Power Spectrum' },
          { value: 'phase', label: 'Phase' }
        ]},
        { key: 'normalize', label: 'Normalize Output', type: 'checkbox' },
        { key: 'logScale', label: 'Log Scale (dB)', type: 'checkbox' }
      ],
      process(config, inputs) {
        const results = { spectrum: null, features: null };

        // Handle single signal
        if (inputs.signal && inputs.signal.values) {
          const sig = inputs.signal;
          const windowed = DSP.applyWindow(sig.values, config.windowFunction);
          const fftResult = DSP.fft(windowed, new Array(windowed.length).fill(0));
          const halfLen = Math.floor(fftResult.real.length / 2);

          let spectrum;
          if (config.outputType === 'magnitude') {
            spectrum = DSP.magnitude(fftResult.real, fftResult.imag).slice(0, halfLen);
          } else if (config.outputType === 'power') {
            spectrum = DSP.powerSpectrum(fftResult.real, fftResult.imag).slice(0, halfLen);
          } else {
            spectrum = DSP.phase(fftResult.real, fftResult.imag).slice(0, halfLen);
          }

          if (config.logScale && config.outputType !== 'phase') {
            spectrum = spectrum.map(v => 20 * Math.log10(Math.max(v, 1e-10)));
          }

          if (config.normalize) {
            const max = Math.max(...spectrum.map(Math.abs), 1e-10);
            spectrum = spectrum.map(v => v / max);
          }

          const freqStep = sig.sampleRate / fftResult.real.length;
          const frequencies = Array.from({ length: halfLen }, (_, i) => i * freqStep);

          results.spectrum = {
            values: spectrum,
            frequencies,
            sampleRate: sig.sampleRate,
            type: config.outputType,
            name: `FFT of ${sig.name || 'Signal'}`
          };

          results.features = {
            vectors: [spectrum.slice(0, config.numCoefficients)],
            labels: ['signal'],
            featureNames: Array.from({ length: config.numCoefficients }, (_, i) => `FFT_${i}`)
          };
        }

        // Handle segmented data
        if (inputs.segments && inputs.segments.windows) {
          const segs = inputs.segments;
          const allFeatures = [];
          const allSpectra = [];

          for (const window of segs.windows) {
            const fftResult = DSP.fft(window, new Array(window.length).fill(0));
            const halfLen = Math.floor(fftResult.real.length / 2);

            let spectrum;
            if (config.outputType === 'magnitude') {
              spectrum = DSP.magnitude(fftResult.real, fftResult.imag).slice(0, halfLen);
            } else if (config.outputType === 'power') {
              spectrum = DSP.powerSpectrum(fftResult.real, fftResult.imag).slice(0, halfLen);
            } else {
              spectrum = DSP.phase(fftResult.real, fftResult.imag).slice(0, halfLen);
            }

            if (config.logScale && config.outputType !== 'phase') {
              spectrum = spectrum.map(v => 20 * Math.log10(Math.max(v, 1e-10)));
            }

            if (config.normalize) {
              const max = Math.max(...spectrum.map(Math.abs), 1e-10);
              spectrum = spectrum.map(v => v / max);
            }

            allSpectra.push(spectrum);
            allFeatures.push(spectrum.slice(0, config.numCoefficients));
          }

          const freqStep = segs.sampleRate / (segs.windowSize || segs.windows[0]?.length || 1);
          const halfLen = Math.floor((segs.windowSize || segs.windows[0]?.length || 2) / 2);
          const frequencies = Array.from({ length: halfLen }, (_, i) => i * freqStep);

          results.spectrum = {
            values: allSpectra.length > 0 ? allSpectra[allSpectra.length - 1] : [],
            allSpectra,
            frequencies,
            sampleRate: segs.sampleRate,
            type: config.outputType,
            name: 'FFT of Segments'
          };

          results.features = {
            vectors: allFeatures,
            labels: allFeatures.map((_, i) => `seg_${i}`),
            featureNames: Array.from({ length: config.numCoefficients }, (_, i) => `FFT_${i}`)
          };
        }

        return results;
      }
    },

    // ── Statistics Block ────────────────────────────────────────────────────

    statistics: {
      name: 'Statistics',
      category: 'transform',
      icon: '📈',
      color: '#FF9800',
      description: 'Computes time-domain statistical metrics from a signal: RMS, mean, variance, standard deviation, peak, crest factor, zero crossings, and energy. Great for feature extraction.',
      inputs: [
        { name: 'signal', type: 'timeseries', label: 'Signal', optional: true, description: 'Raw time-series signal to compute statistics on (RMS, mean, variance, peak, zero crossings...).' },
        { name: 'segments', type: 'segments', label: 'Segments', optional: true, description: 'Windowed signal segments — statistics are computed per window then averaged across all windows.' }
      ],
      outputs: [
        { name: 'features', type: 'features', label: 'Features', description: 'Selected statistical values packed as feature vectors — ready for a Neural Network or Fuzzy Classifier.' },
        { name: 'stats', type: 'stats', label: 'Statistics', description: 'Named statistics dictionary (e.g. RMS: 0.7, Mean: 0.0) — great for the Output visualization block.' }
      ],
      defaultConfig: {
        includeRMS: true,
        includeMean: true,
        includeVariance: true,
        includeStdDev: true,
        includePeak: true,
        includeCrestFactor: false,
        includeZeroCrossings: true,
        includeEnergy: false
      },
      configUI: [
        { key: 'includeRMS', label: 'RMS', type: 'checkbox' },
        { key: 'includeMean', label: 'Mean', type: 'checkbox' },
        { key: 'includeVariance', label: 'Variance', type: 'checkbox' },
        { key: 'includeStdDev', label: 'Standard Deviation', type: 'checkbox' },
        { key: 'includePeak', label: 'Peak Value', type: 'checkbox' },
        { key: 'includeCrestFactor', label: 'Crest Factor', type: 'checkbox' },
        { key: 'includeZeroCrossings', label: 'Zero Crossings', type: 'checkbox' },
        { key: 'includeEnergy', label: 'Energy', type: 'checkbox' }
      ],
      process(config, inputs) {
        const computeStats = (data) => {
          const features = [];
          const names = [];

          if (config.includeRMS) { features.push(DSP.rms(data)); names.push('RMS'); }
          if (config.includeMean) { features.push(DSP.mean(data)); names.push('Mean'); }
          if (config.includeVariance) { features.push(DSP.variance(data)); names.push('Variance'); }
          if (config.includeStdDev) { features.push(DSP.stddev(data)); names.push('StdDev'); }
          if (config.includePeak) { features.push(DSP.peak(data)); names.push('Peak'); }
          if (config.includeCrestFactor) { features.push(DSP.crestFactor(data)); names.push('CrestFactor'); }
          if (config.includeZeroCrossings) { features.push(DSP.zeroCrossings(data)); names.push('ZeroCrossings'); }
          if (config.includeEnergy) { features.push(DSP.energy(data)); names.push('Energy'); }

          return { features, names };
        };

        // Single signal
        if (inputs.signal && inputs.signal.values) {
          const { features, names } = computeStats(inputs.signal.values);
          return {
            features: {
              vectors: [features],
              labels: ['signal'],
              featureNames: names
            },
            stats: {
              values: Object.fromEntries(names.map((n, i) => [n, features[i]])),
              name: inputs.signal.name || 'Signal'
            }
          };
        }

        // Segmented data
        if (inputs.segments && inputs.segments.windows) {
          const allFeatures = [];
          let featureNames = [];
          for (const window of inputs.segments.windows) {
            const { features, names } = computeStats(window);
            allFeatures.push(features);
            featureNames = names;
          }
          return {
            features: {
              vectors: allFeatures,
              labels: allFeatures.map((_, i) => `seg_${i}`),
              featureNames
            },
            stats: {
              values: featureNames.reduce((obj, name, i) => {
                obj[name] = DSP.mean(allFeatures.map(f => f[i]));
                return obj;
              }, {}),
              name: 'Segment Statistics (averaged)'
            }
          };
        }

        return { features: { vectors: [], labels: [], featureNames: [] }, stats: { values: {} } };
      }
    },

    // ── Feature Merger ──────────────────────────────────────────────────────

    featureMerger: {
      name: 'Feature Merger',
      category: 'transform',
      icon: '🔗',
      color: '#607D8B',
      description: 'Combines feature vectors from two upstream blocks into one wider vector. Use this to merge FFT coefficients with statistical features before feeding into a classifier.',
      inputs: [
        { name: 'features1', type: 'features', label: 'Features A', description: 'First feature set to combine (e.g. FFT coefficients from the FFT block).' },
        { name: 'features2', type: 'features', label: 'Features B', description: 'Second feature set to combine (e.g. statistical metrics from the Statistics block).' }
      ],
      outputs: [{ name: 'features', type: 'features', label: 'Merged', description: 'Combined feature vectors — both input sets concatenated side by side per sample. Feed this into Neural Network or Fuzzy Classifier.' }],
      defaultConfig: {},
      configUI: [],
      process(config, inputs) {
        const f1 = inputs.features1;
        const f2 = inputs.features2;

        if (!f1 && !f2) return { features: { vectors: [], labels: [], featureNames: [] } };
        if (!f1) return { features: f2 };
        if (!f2) return { features: f1 };

        const len = Math.min(f1.vectors.length, f2.vectors.length);
        const merged = [];
        for (let i = 0; i < len; i++) {
          merged.push([...(f1.vectors[i] || []), ...(f2.vectors[i] || [])]);
        }

        return {
          features: {
            vectors: merged,
            labels: f1.labels.slice(0, len),
            featureNames: [...(f1.featureNames || []), ...(f2.featureNames || [])]
          }
        };
      }
    },

    // ── Neural Network ──────────────────────────────────────────────────────

    neuralNetwork: {
      name: 'Neural Network',
      category: 'classifier',
      icon: '🧠',
      color: '#E91E63',
      description: 'A trainable feed-forward neural network. Auto-trains on your feature data using k-means clustering to generate labels. Classifies new samples in real time after training.',
      inputs: [{ name: 'features', type: 'features', label: 'Features', description: 'Feature vectors to train on and classify. Each row is one sample. Auto-generates training labels via k-means clustering.' }],
      outputs: [
        { name: 'predictions', type: 'predictions', label: 'Output', description: 'Classification results — class name and confidence score for every input sample.' },
        { name: 'features', type: 'features', label: 'Features', description: 'Raw output probabilities as feature vectors — useful for chaining into a Fuzzy Classifier.' }
      ],
      defaultConfig: {
        hiddenLayers: [{ neurons: 16, activation: 'relu' }, { neurons: 8, activation: 'relu' }],
        outputNeurons: 2,
        outputActivation: 'softmax',
        learningRate: 0.01,
        momentum: 0.9,
        epochs: 100,
        batchSize: 8,
        trainingMode: 'auto', // 'auto' uses first 80% for training
        classNames: ['Class A', 'Class B'],
        trainedNetwork: null,
        topology: 'feedforward',  // 'feedforward' | 'recurrent' | 'deep' | 'wide'
        _contextVector: null      // recurrent state (output of previous run)
      },
      configUI: [
        { key: 'hiddenLayers', label: 'Hidden Layers', type: 'layers' },
        { key: 'outputNeurons', label: 'Output Neurons (Classes)', type: 'number', min: 1, max: 50, step: 1 },
        { key: 'outputActivation', label: 'Output Activation', type: 'select', options: [
          { value: 'softmax', label: 'Softmax (Classification)' },
          { value: 'sigmoid', label: 'Sigmoid' },
          { value: 'linear', label: 'Linear (Regression)' }
        ]},
        { key: 'learningRate', label: 'Learning Rate', type: 'number', min: 0.0001, max: 1, step: 0.001 },
        { key: 'momentum', label: 'Momentum', type: 'number', min: 0, max: 0.999, step: 0.01 },
        { key: 'epochs', label: 'Training Epochs', type: 'number', min: 1, max: 10000, step: 1 },
        { key: 'batchSize', label: 'Batch Size', type: 'number', min: 1, max: 256, step: 1 },
        { key: 'classNames', label: 'Class Names (comma-separated)', type: 'text' },
        { key: 'topology', label: 'Network Topology', type: 'select', options: [
          { value: 'feedforward', label: 'Feedforward — standard layer-by-layer (best for tabular features)' },
          { value: 'recurrent', label: 'Recurrent (Jordan) — output feeds back as input (best for time series)' },
          { value: 'deep', label: 'Deep — 4 hidden layers, good for complex patterns' },
          { value: 'wide', label: 'Wide — 1 large hidden layer, fast and generalizes well' }
        ]}
      ],
      process(config, inputs) {
        const runMode = config._runMode || 'train';
        const features = inputs.features;
        if (!features || !features.vectors || features.vectors.length === 0) {
          return { predictions: null, features: null };
        }

        const inputSize = features.vectors[0].length;
        const classNames = typeof config.classNames === 'string'
          ? config.classNames.split(',').map(s => s.trim())
          : config.classNames || [];

        // Apply topology preset
        let layersCfg;
        const topology = config.topology || 'feedforward';
        if (topology === 'deep') {
          layersCfg = [
            { neurons: 32, activation: 'relu' },
            { neurons: 16, activation: 'relu' },
            { neurons: 8, activation: 'relu' },
            { neurons: 4, activation: 'relu' },
            { neurons: config.outputNeurons, activation: config.outputActivation }
          ];
        } else if (topology === 'wide') {
          layersCfg = [
            { neurons: 64, activation: 'relu' },
            { neurons: config.outputNeurons, activation: config.outputActivation }
          ];
        } else {
          // feedforward or recurrent: use configured hidden layers
          layersCfg = [
            ...config.hiddenLayers.map(l => ({ neurons: l.neurons, activation: l.activation })),
            { neurons: config.outputNeurons, activation: config.outputActivation }
          ];
        }

        // Recurrent: context vector (Jordan network — previous output fed back as extra input)
        const isRecurrent = topology === 'recurrent';
        if (isRecurrent && !config._contextVector) {
          config._contextVector = new Array(config.outputNeurons).fill(0);
        }
        const effectiveInputSize = isRecurrent
          ? inputSize + config.outputNeurons
          : inputSize;

        let network = config.trainedNetwork;
        const hasSavedModel = network && network.config && network.config.inputSize === effectiveInputSize;

        if (runMode === 'infer') {
          if (!hasSavedModel) {
            config._isTrained = false;
            return {
              predictions: { error: 'No trained model — run Train first.', items: [], classNames },
              features: null
            };
          }
          config._isTrained = true;
        } else {
          if (!hasSavedModel || config.forceRetrain) {
            if (isRecurrent) config._contextVector = new Array(config.outputNeurons).fill(0);
            network = NeuralNetwork.createNetwork({
              inputSize: effectiveInputSize,
              layers: layersCfg,
              learningRate: config.learningRate,
              momentum: config.momentum
            });
            if (features.vectors.length >= config.outputNeurons * 2) {
              // For recurrent mode: build sequential inputs with context
              let trainVectors = features.vectors;
              if (isRecurrent) {
                let ctx = new Array(config.outputNeurons).fill(0);
                trainVectors = features.vectors.map(v => {
                  const augmented = [...v, ...ctx];
                  // Context updates to zeros during training (simplified teacher forcing)
                  return augmented;
                });
              }
              const targets = autoGenerateTargets(trainVectors.map(v => v.slice(0, inputSize)), config.outputNeurons);
              NeuralNetwork.train(network, trainVectors, targets, config.epochs, config.batchSize);
            }
            config.trainedNetwork = network;
            config.forceRetrain = false;
          }
          config._isTrained = true;
        }

        // Predict
        const ctx = isRecurrent ? (config._contextVector || new Array(config.outputNeurons).fill(0)) : null;
        const predictions = features.vectors.map((v, idx) => {
          const input = isRecurrent ? [...v, ...ctx] : v;
          const result = NeuralNetwork.classify(network, input);
          // Update context to last prediction (Jordan recurrent)
          if (isRecurrent) {
            config._contextVector = result.output;
          }
          return {
            output: result.output,
            classIndex: result.classIndex,
            className: classNames[result.classIndex] || `Class ${result.classIndex}`,
            confidence: result.confidence
          };
        });

        // Also output as features for downstream blocks
        const outputFeatures = {
          vectors: predictions.map(p => p.output),
          labels: predictions.map(p => p.className),
          featureNames: classNames.length > 0
            ? classNames
            : Array.from({ length: config.outputNeurons }, (_, i) => `Out_${i}`)
        };

        return {
          predictions: {
            items: predictions,
            classNames,
            network: NeuralNetwork.serialize(network),
            trainingHistory: network.trainingHistory
          },
          features: outputFeatures
        };
      }
    },

    // ── Fuzzy Classifier ────────────────────────────────────────────────────

    fuzzyClassifier: {
      name: 'Fuzzy Classifier',
      category: 'classifier',
      icon: '🌫️',
      color: '#795548',
      description: 'Applies fuzzy logic rules to classify values into named categories. Gives soft, human-readable decisions (Low / Medium / High) with membership degrees and confidence scores.',
      inputs: [
        { name: 'features', type: 'features', label: 'Features', description: 'Feature vectors — uses the value at the configured feature index as the fuzzy input signal.' },
        { name: 'predictions', type: 'predictions', label: 'NN Output', optional: true, description: 'Neural network output probabilities — uses class confidence values as fuzzy inputs instead of raw features.' }
      ],
      outputs: [{ name: 'classification', type: 'classification', label: 'Classification', description: 'Fuzzy classification results — label, confidence score, and membership degrees for each input sample.' }],
      defaultConfig: {
        mode: 'threshold',  // 'threshold', 'custom'
        classes: ['Low', 'Medium', 'High'],
        thresholds: [0.33, 0.66],
        inputFeatureIndex: 0,
        defuzzMethod: 'centroid',
        customRules: []
      },
      configUI: [
        { key: 'mode', label: 'Mode', type: 'select', options: [
          { value: 'threshold', label: 'Threshold-Based' },
          { value: 'custom', label: 'Custom Rules' }
        ]},
        { key: 'classes', label: 'Class Names (comma-separated)', type: 'text' },
        { key: 'thresholds', label: 'Thresholds (comma-separated)', type: 'text', showIf: { mode: 'threshold' } },
        { key: 'inputFeatureIndex', label: 'Input Feature Index', type: 'number', min: 0, max: 100, step: 1 },
        { key: 'defuzzMethod', label: 'Defuzzification', type: 'select', options: [
          { value: 'centroid', label: 'Centroid' },
          { value: 'bisector', label: 'Bisector' },
          { value: 'mom', label: 'Mean of Maximum' },
          { value: 'som', label: 'Smallest of Maximum' },
          { value: 'lom', label: 'Largest of Maximum' }
        ]}
      ],
      process(config, inputs) {
        const classes = typeof config.classes === 'string'
          ? config.classes.split(',').map(s => s.trim())
          : config.classes;
        const thresholds = typeof config.thresholds === 'string'
          ? config.thresholds.split(',').map(s => parseFloat(s.trim()))
          : config.thresholds;

        // Get input values
        let inputValues = [];
        if (inputs.predictions && inputs.predictions.items) {
          inputValues = inputs.predictions.items.map(p =>
            p.output[config.inputFeatureIndex] || p.confidence || 0
          );
        } else if (inputs.features && inputs.features.vectors) {
          inputValues = inputs.features.vectors.map(v =>
            v[config.inputFeatureIndex] || 0
          );
        }

        if (inputValues.length === 0) {
          return { classification: { items: [], classes, summary: {} } };
        }

        // Create FIS
        const fis = FuzzyLogic.createThresholdClassifier({
          inputName: 'input',
          outputName: 'class',
          classes,
          thresholds
        });

        // Classify each input
        const items = inputValues.map((val, idx) => {
          const result = FuzzyLogic.classifyWithLabels(fis, { input: val });
          const classResult = result['class'] || { label: 'Unknown', confidence: 0, value: 0 };
          return {
            index: idx,
            inputValue: val,
            label: classResult.label,
            confidence: classResult.confidence,
            memberships: classResult.allMemberships || {}
          };
        });

        // Summary
        const summary = {};
        for (const cls of classes) {
          summary[cls] = items.filter(i => i.label === cls).length;
        }

        return {
          classification: {
            items,
            classes,
            summary,
            fisConfig: { classes, thresholds, defuzzMethod: config.defuzzMethod }
          }
        };
      }
    },

    // ── Output / Visualizer ─────────────────────────────────────────────────

    output: {
      name: 'Output',
      category: 'output',
      icon: '📺',
      color: '#F44336',
      description: 'Visualizes any data passing through the pipeline. Auto-detects the data type and renders the appropriate chart or table. Multiple ports can be connected simultaneously.',
      inputs: [
        { name: 'signal', type: 'timeseries', label: 'Signal', optional: true, description: 'Time-series signal — rendered as a line chart showing amplitude over time.' },
        { name: 'spectrum', type: 'spectrum', label: 'Spectrum', optional: true, description: 'Frequency spectrum — rendered as a frequency domain bar or line chart.' },
        { name: 'features', type: 'features', label: 'Features', optional: true, description: 'Feature vectors — rendered as a grouped bar chart of feature values per sample.' },
        { name: 'predictions', type: 'predictions', label: 'Predictions', optional: true, description: 'Class predictions — rendered as a confidence chart showing class distribution.' },
        { name: 'classification', type: 'classification', label: 'Classification', optional: true, description: 'Fuzzy classification results — rendered as a category count summary.' },
        { name: 'stats', type: 'stats', label: 'Statistics', optional: true, description: 'Statistics dictionary — rendered as a bar chart of each named metric value.' }
      ],
      outputs: [],
      defaultConfig: {
        chartType: 'auto',
        title: 'Output',
        showGrid: true,
        showLegend: true
      },
      configUI: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'chartType', label: 'Chart Type', type: 'select', options: [
          { value: 'auto', label: 'Auto-detect' },
          { value: 'line', label: 'Line Chart' },
          { value: 'bar', label: 'Bar Chart' },
          { value: 'scatter', label: 'Scatter Plot' },
          { value: 'table', label: 'Data Table' }
        ]},
        { key: 'showGrid', label: 'Show Grid', type: 'checkbox' },
        { key: 'showLegend', label: 'Show Legend', type: 'checkbox' }
      ],
      process(config, inputs) {
        // Output blocks don't transform data, they just pass through for visualization
        return { _display: { config, inputs } };
      }
    },

    // ── Filter ───────────────────────────────────────────────────────────────

    filter: {
      name: 'Filter',
      category: 'preprocessing',
      icon: '🎚️',
      color: '#00BCD4',
      description: 'Removes unwanted frequencies using a Butterworth IIR filter. Lowpass keeps slow variations, highpass keeps fast changes, bandpass keeps a range, notch removes one frequency.',
      inputs: [{ name: 'signal', type: 'timeseries', label: 'Signal', description: 'Time-series signal to filter.' }],
      outputs: [
        { name: 'signal', type: 'timeseries', label: 'Filtered', description: 'Filtered signal with unwanted frequencies removed.' },
        { name: 'response', type: 'bodePlot', label: 'Bode Plot', description: 'Frequency response of the filter — shows which frequencies pass through.' }
      ],
      defaultConfig: {
        filterType: 'lowpass',
        cutoffFreq: 50,
        order: 2
      },
      configUI: [
        { key: 'filterType', label: 'Filter Type', type: 'select', options: [
          { value: 'lowpass', label: 'Lowpass — keep slow changes' },
          { value: 'highpass', label: 'Highpass — keep fast changes' },
          { value: 'bandpass', label: 'Bandpass — keep a frequency range' },
          { value: 'notch', label: 'Notch — remove one frequency (e.g. 60Hz)' }
        ]},
        { key: 'cutoffFreq', label: 'Cutoff Frequency (Hz)', type: 'number', min: 0.1, max: 10000, step: 0.1 },
        { key: 'order', label: 'Filter Order', type: 'select', options: [
          { value: 2, label: '2nd order (gentle slope)' },
          { value: 4, label: '4th order (steeper slope)' }
        ]}
      ],
      process(config, inputs) {
        const signal = inputs.signal;
        if (!signal || !signal.values || signal.values.length === 0) {
          return { signal: null, response: null };
        }
        const filtered = DSP.butterworthFilter(signal.values, config.filterType, config.cutoffFreq, signal.sampleRate || 256, config.order || 2);
        const response = DSP.filterFrequencyResponse(config.filterType, config.cutoffFreq, signal.sampleRate || 256, config.order || 2, 256);
        return {
          signal: { values: filtered, sampleRate: signal.sampleRate, labels: signal.labels, name: `${config.filterType} filtered` },
          response: { ...response, _type: 'bodePlot', cutoff: config.cutoffFreq }
        };
      }
    },

    // ── Spectrogram ──────────────────────────────────────────────────────────

    spectrogramBlock: {
      name: 'Spectrogram',
      category: 'transform',
      icon: '🌈',
      color: '#3F51B5',
      description: 'Computes a time-frequency spectrogram — a 2D view showing how the frequency content of a signal changes over time. Essential for audio, EEG, and vibration analysis.',
      inputs: [{ name: 'signal', type: 'timeseries', label: 'Signal', description: 'Time-series signal to compute spectrogram for.' }],
      outputs: [{ name: 'spectrogram', type: 'spectrogram', label: 'Spectrogram', description: 'Time-frequency heatmap. Each column is an FFT of a short time window.' }],
      defaultConfig: {
        windowSize: 64,
        hopSize: 16,
        windowFunction: 'hanning'
      },
      configUI: [
        { key: 'windowSize', label: 'Window Size (samples)', type: 'number', min: 8, max: 1024, step: 8 },
        { key: 'hopSize', label: 'Hop Size (samples)', type: 'number', min: 1, max: 512, step: 1 },
        { key: 'windowFunction', label: 'Window Function', type: 'select', options: [
          { value: 'hanning', label: 'Hanning' },
          { value: 'hamming', label: 'Hamming' },
          { value: 'blackman', label: 'Blackman' },
          { value: 'rectangular', label: 'Rectangular' }
        ]}
      ],
      process(config, inputs) {
        const signal = inputs.signal;
        if (!signal || !signal.values || signal.values.length === 0) return { spectrogram: null };
        const result = DSP.spectrogram(signal.values, config.windowSize, config.hopSize, config.windowFunction, signal.sampleRate || 256);
        return { spectrogram: result };
      }
    },

    // ── Rectifier ────────────────────────────────────────────────────────────

    rectifier: {
      name: 'Rectifier',
      category: 'preprocessing',
      icon: '⚡',
      color: '#FF5722',
      description: 'Converts a signal to all-positive values. Full-wave flips negative values; half-wave zeros them out. Essential first step for EMG envelope extraction.',
      inputs: [{ name: 'signal', type: 'timeseries', label: 'Signal', description: 'Raw signal with positive and negative values.' }],
      outputs: [{ name: 'signal', type: 'timeseries', label: 'Rectified', description: 'All-positive signal ready for envelope detection.' }],
      defaultConfig: { mode: 'full' },
      configUI: [
        { key: 'mode', label: 'Rectification Mode', type: 'select', options: [
          { value: 'full', label: 'Full-wave — flip negatives to positive' },
          { value: 'half', label: 'Half-wave — zero out negatives' }
        ]}
      ],
      process(config, inputs) {
        const signal = inputs.signal;
        if (!signal || !signal.values) return { signal: null };
        const values = config.mode === 'half'
          ? signal.values.map(v => Math.max(0, v))
          : signal.values.map(v => Math.abs(v));
        return { signal: { ...signal, values, name: `${config.mode}-wave rectified` } };
      }
    },

    // ── Envelope ─────────────────────────────────────────────────────────────

    envelope: {
      name: 'Envelope',
      category: 'preprocessing',
      icon: '〰️',
      color: '#8BC34A',
      description: 'Extracts the amplitude envelope — the slow-moving outline of signal amplitude over time. Used to detect muscle activation from EMG or track audio loudness.',
      inputs: [{ name: 'signal', type: 'timeseries', label: 'Signal', description: 'Rectified or raw signal to extract envelope from.' }],
      outputs: [{ name: 'signal', type: 'timeseries', label: 'Envelope', description: 'Smooth amplitude envelope showing signal activation over time.' }],
      defaultConfig: { windowSize: 20 },
      configUI: [
        { key: 'windowSize', label: 'Smoothing Window (samples)', type: 'number', min: 2, max: 500, step: 1 }
      ],
      process(config, inputs) {
        const signal = inputs.signal;
        if (!signal || !signal.values) return { signal: null };
        const w = Math.max(2, config.windowSize || 20);
        const vals = signal.values;
        const env = new Array(vals.length);
        for (let i = 0; i < vals.length; i++) {
          const start = Math.max(0, i - w + 1);
          let sum = 0;
          for (let j = start; j <= i; j++) sum += vals[j] * vals[j];
          env[i] = Math.sqrt(sum / (i - start + 1));
        }
        return { signal: { ...signal, values: env, name: 'Envelope' } };
      }
    },

    // ── Noise Adder ──────────────────────────────────────────────────────────

    noiseAdder: {
      name: 'Noise Adder',
      category: 'preprocessing',
      icon: '〜',
      color: '#9E9E9E',
      description: 'Adds controlled noise to a clean signal. Great for teaching SNR concepts, testing filter robustness, or simulating real measurement conditions.',
      inputs: [{ name: 'signal', type: 'timeseries', label: 'Signal', description: 'Clean signal to add noise to.' }],
      outputs: [{ name: 'signal', type: 'timeseries', label: 'Noisy Signal', description: 'Signal with added noise at the configured level.' }],
      defaultConfig: { noiseLevel: 0.1, noiseType: 'gaussian' },
      configUI: [
        { key: 'noiseLevel', label: 'Noise Level (amplitude)', type: 'number', min: 0, max: 5, step: 0.01 },
        { key: 'noiseType', label: 'Noise Type', type: 'select', options: [
          { value: 'gaussian', label: 'Gaussian (White Noise)' },
          { value: 'pink', label: 'Pink Noise' },
          { value: 'uniform', label: 'Uniform Random' }
        ]}
      ],
      process(config, inputs) {
        const signal = inputs.signal;
        if (!signal || !signal.values) return { signal: null };
        const n = signal.values.length;
        let noise;
        if (config.noiseType === 'pink') {
          noise = DSP.generatePinkNoise({ samples: n, amplitude: config.noiseLevel }).values;
        } else if (config.noiseType === 'uniform') {
          noise = Array.from({ length: n }, () => (Math.random() * 2 - 1) * config.noiseLevel);
        } else {
          // Gaussian approximation via Box-Muller
          noise = Array.from({ length: n }, () => {
            const u1 = Math.random(), u2 = Math.random();
            return Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2) * config.noiseLevel;
          });
        }
        const values = signal.values.map((v, i) => v + noise[i]);
        return { signal: { ...signal, values, name: `${signal.name || 'Signal'} + noise` } };
      }
    },

    // ── k-NN Classifier ──────────────────────────────────────────────────────

    knnClassifier: {
      name: 'k-NN Classifier',
      category: 'classifier',
      icon: '🎯',
      color: '#009688',
      description: 'k-Nearest Neighbors classifier. Finds the k most similar training samples and votes on the class. No training phase — intuitive and great for teaching classification concepts.',
      inputs: [{ name: 'features', type: 'features', label: 'Features', description: 'Feature vectors to classify. The first 80% are used as training data.' }],
      outputs: [{ name: 'predictions', type: 'predictions', label: 'Predictions', description: 'Classification results — class label and confidence for each sample.' }],
      defaultConfig: {
        k: 3,
        classNames: ['Class A', 'Class B'],
        numClasses: 2
      },
      configUI: [
        { key: 'k', label: 'k (neighbors to vote)', type: 'number', min: 1, max: 20, step: 1 },
        { key: 'numClasses', label: 'Number of Classes', type: 'number', min: 2, max: 10, step: 1 },
        { key: 'classNames', label: 'Class Names (comma-separated)', type: 'text' }
      ],
      process(config, inputs) {
        const runMode = config._runMode || 'train';
        const features = inputs.features;
        if (!features || !features.vectors || features.vectors.length < 2) return { predictions: null };

        const classNames = typeof config.classNames === 'string'
          ? config.classNames.split(',').map(s => s.trim())
          : (config.classNames || ['Class A', 'Class B']);

        const vectors = features.vectors;
        const n = vectors.length;

        let trainVectors, trainLabels;

        if (runMode === 'infer') {
          // Use stored training data to classify new incoming vectors
          if (!config._trainData) {
            config._isTrained = false;
            return {
              predictions: { error: 'No training data — run Train first.', items: [], classNames }
            };
          }
          trainVectors = config._trainData.vectors;
          trainLabels = config._trainData.labels;
          config._isTrained = true;
        } else {
          // Train mode: auto-label and store training data
          const trainSize = Math.max(1, Math.floor(n * 0.8));
          const rms = vectors.map((v, i) => ({ i, rms: Math.sqrt(v.reduce((s, x) => s + x * x, 0) / v.length) }));
          rms.sort((a, b) => a.rms - b.rms);
          trainLabels = new Array(n).fill(0);
          for (let j = 0; j < trainSize; j++) {
            trainLabels[rms[j].i] = Math.floor(j / trainSize * config.numClasses);
          }
          trainVectors = vectors.slice(0, trainSize);
          trainLabels = trainLabels.slice(0, trainSize);
          // Persist for future infer runs
          config._trainData = { vectors: [...trainVectors], labels: [...trainLabels] };
          config._isTrained = true;
        }

        // kNN predict all incoming vectors against stored training data
        const predictions = vectors.map((query) => {
          const dists = [];
          for (let ti = 0; ti < trainVectors.length; ti++) {
            let d = 0;
            for (let f = 0; f < query.length; f++) {
              const diff = query[f] - trainVectors[ti][f];
              d += diff * diff;
            }
            dists.push({ d: Math.sqrt(d), label: trainLabels[ti] });
          }
          dists.sort((a, b) => a.d - b.d);
          const votes = new Array(config.numClasses).fill(0);
          const k = Math.min(config.k, dists.length);
          for (let j = 0; j < k; j++) votes[dists[j].label]++;
          const classIndex = votes.indexOf(Math.max(...votes));
          const confidence = votes[classIndex] / k;
          const output = new Array(config.numClasses).fill(0);
          output[classIndex] = confidence;
          return { output, classIndex, className: classNames[classIndex] || `Class ${classIndex}`, confidence };
        });

        return {
          predictions: { items: predictions, classNames }
        };
      }
    },

    // ── Live Data Source ─────────────────────────────────────────────────────
    liveDataSource: {
      name: 'Live Data Source',
      category: 'input',
      icon: '📡',
      color: '#FF6F00',
      description: 'Connects to real-world live data feeds. Polls Yahoo Finance for stock/index prices, or runs a simulated feed. Automatically triggers pipeline inference on each new data tick.',
      inputs: [],
      outputs: [{ name: 'signal', type: 'timeseries', label: 'Live Signal', description: 'Real-time price/value timeseries. Carries metadata: label, units, symbol, last price, last update timestamp.' }],
      defaultConfig: {
        source: 'yahoo',      // 'yahoo' | 'simulate'
        symbol: '^GSPC',      // Yahoo Finance symbol
        interval: '1d',       // '1d' | '1h' | '5m' | '1m'
        historyBars: 30,      // number of historical bars to fetch
        autoInfer: true,      // trigger pipeline infer on each new tick
        pollSeconds: 60,      // polling interval in seconds
        _cachedSignal: null,  // populated by startFeed
        _feedInterval: null,
        _feedActive: false,
        _lastUpdate: null,
        _error: null,
        _tickCount: 0
      },
      configUI: [
        { key: 'source', label: 'Data Source', type: 'select', options: [
          { value: 'yahoo', label: 'Yahoo Finance (live)' },
          { value: 'simulate', label: 'Simulation (offline)' }
        ]},
        { key: 'symbol', label: 'Symbol (e.g. ^GSPC, SPY, AAPL)', type: 'text' },
        { key: 'interval', label: 'Bar Interval', type: 'select', options: [
          { value: '1d', label: 'Daily' },
          { value: '1h', label: 'Hourly' },
          { value: '5m', label: '5 Minutes' },
          { value: '1m', label: '1 Minute' }
        ]},
        { key: 'historyBars', label: 'History Bars', type: 'number', min: 5, max: 200, step: 5 },
        { key: 'pollSeconds', label: 'Poll Interval (seconds)', type: 'number', min: 10, max: 3600, step: 10 },
        { key: 'autoInfer', label: 'Auto-infer on new data', type: 'checkbox' }
      ],
      // --- Lifecycle: called by pipeline.js, not process() ---
      startFeed(config, onNewData) {
        if (config._feedActive) return; // already running
        config._feedActive = true;
        config._error = null;

        const doFetch = async () => {
          try {
            let signal;
            if (config.source === 'yahoo') {
              // Map historyBars to Yahoo range parameter
              const intervalRangeMap = {
                '1m': '1d', '5m': '5d', '1h': '60d', '1d': '6mo'
              };
              const range = intervalRangeMap[config.interval] || '6mo';
              const raw = await DataIO.fetchYahooFinance(config.symbol, config.interval, range);
              // Trim to historyBars
              const n = Math.min(config.historyBars, raw.values.length);
              signal = {
                ...raw,
                values: raw.values.slice(-n),
                timestamps: (raw.timestamps || []).slice(-n)
              };
            } else {
              // Simulate: geometric brownian motion
              const gen = DataIO.generators.stockMarket({
                samples: config.historyBars,
                startPrice: (config._cachedSignal?.lastPrice || 4500),
                volatility: 0.015,
                drift: 0.0001,
                trend: 'mixed'
              });
              signal = {
                values: gen.values,
                timestamps: Array.from({ length: gen.values.length }, (_, i) => Date.now()/1000 - (gen.values.length - i) * 86400),
                sampleRate: 1,
                label: `${config.symbol} (simulated)`,
                units: 'USD',
                source: 'Simulation',
                symbol: config.symbol,
                lastPrice: gen.values[gen.values.length - 1],
                lastUpdate: Date.now()
              };
            }
            config._cachedSignal = signal;
            config._lastUpdate = Date.now();
            config._tickCount = (config._tickCount || 0) + 1;
            config._error = null;
            if (onNewData) onNewData(signal);
          } catch (err) {
            config._error = err.message;
            // On error in yahoo mode, fall back to simulation
            if (config.source === 'yahoo') {
              config.source = 'simulate'; // fallback silently
            }
          }
        };

        // First fetch immediately
        doFetch();
        // Then poll
        config._feedInterval = setInterval(doFetch, (config.pollSeconds || 60) * 1000);
      },
      stopFeed(config) {
        config._feedActive = false;
        if (config._feedInterval) {
          clearInterval(config._feedInterval);
          config._feedInterval = null;
        }
      },
      process(config, inputs) {
        if (!config._cachedSignal) {
          // Return a placeholder signal while waiting for first fetch
          const placeholder = DataIO.generators.stockMarket({
            samples: config.historyBars || 30,
            startPrice: 4500, volatility: 0.015, drift: 0.0001, trend: 'mixed'
          });
          return {
            signal: {
              values: placeholder.values,
              sampleRate: 1,
              label: `${config.symbol} (waiting for live data…)`,
              units: 'USD',
              source: config.source === 'yahoo' ? 'Yahoo Finance' : 'Simulation',
              symbol: config.symbol,
              lastPrice: placeholder.values[placeholder.values.length - 1],
              _isPlaceholder: true
            }
          };
        }
        return { signal: config._cachedSignal };
      }
    }
  };

  // ─── Helper: Auto-generate training targets ───────────────────────────────

  function autoGenerateTargets(vectors, numClasses) {
    // Simple k-means-like clustering for auto-labeling
    const N = vectors.length;
    const dim = vectors[0].length;

    // Initialize centroids
    const centroids = [];
    const step = Math.floor(N / numClasses);
    for (let c = 0; c < numClasses; c++) {
      centroids.push([...vectors[Math.min(c * step, N - 1)]]);
    }

    // Iterate
    let assignments = new Array(N).fill(0);
    for (let iter = 0; iter < 20; iter++) {
      // Assign
      for (let i = 0; i < N; i++) {
        let bestDist = Infinity;
        for (let c = 0; c < numClasses; c++) {
          let dist = 0;
          for (let d = 0; d < dim; d++) {
            dist += (vectors[i][d] - centroids[c][d]) ** 2;
          }
          if (dist < bestDist) {
            bestDist = dist;
            assignments[i] = c;
          }
        }
      }

      // Update centroids
      for (let c = 0; c < numClasses; c++) {
        const members = vectors.filter((_, i) => assignments[i] === c);
        if (members.length > 0) {
          for (let d = 0; d < dim; d++) {
            centroids[c][d] = members.reduce((s, v) => s + v[d], 0) / members.length;
          }
        }
      }
    }

    // Convert to one-hot
    return assignments.map(c => {
      const target = new Array(numClasses).fill(0);
      target[c] = 1;
      return target;
    });
  }

  // ─── Registry API ─────────────────────────────────────────────────────────

  function getBlockType(type) {
    return blockTypes[type];
  }

  function getAllTypes() {
    return Object.entries(blockTypes).map(([key, def]) => ({
      type: key,
      ...def
    }));
  }

  function getByCategory(category) {
    return getAllTypes().filter(b => b.category === category);
  }

  function getCategories() {
    return [
      { id: 'input', name: 'Data Input', icon: '📥' },
      { id: 'preprocessing', name: 'Preprocessing', icon: '⚙️' },
      { id: 'transform', name: 'Transform', icon: '🔄' },
      { id: 'classifier', name: 'Classifiers', icon: '🎯' },
      { id: 'output', name: 'Output', icon: '📤' }
    ];
  }

  function createBlockInstance(type, x, y) {
    const def = blockTypes[type];
    if (!def) throw new Error(`Unknown block type: ${type}`);

    return {
      id: 'block_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      type,
      x: x || 100,
      y: y || 100,
      config: JSON.parse(JSON.stringify(def.defaultConfig)),
      _def: def
    };
  }

  return {
    blockTypes,
    getBlockType,
    getAllTypes,
    getByCategory,
    getCategories,
    createBlockInstance
  };

})();
