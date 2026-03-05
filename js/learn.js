/**
 * learn.js — Learn Panel
 *
 * Educational sidebar that shows concept cards for each block type when
 * selected, plus a "What just happened?" summary after pipeline runs.
 *
 * Exposes a single global: LearnPanel
 */

const LearnPanel = (() => {
  // -------------------------------------------------------------------------
  // Internal state
  // -------------------------------------------------------------------------

  let _panelEl = null;
  let _contentEl = null;
  let _visible = false;
  let _initialized = false;

  // -------------------------------------------------------------------------
  // Concept card data
  // -------------------------------------------------------------------------

  const CARDS = {
    dataSource: {
      icon: '📁',
      name: 'Data Source',
      color: '#4CAF50',
      plain:
        'This is where your signal comes from. Choose from 12 built-in generators (sine waves, ECG heartbeats, EEG brain signals, EMG muscle signals, stock prices...) or upload your own data from a CSV/Excel file.',
      intuition:
        'Think of it like a signal generator on a lab bench — or just plugging in your microphone or connecting your data logger.',
      uses: [
        'Biomedical sensors (ECG, EEG, EMG)',
        'Audio systems',
        'Financial data feeds',
        'Industrial sensors',
      ],
      try: 'Change the generator type from Sine Wave to ECG, then run the pipeline. Notice how the heartbeat shape is completely different from a smooth sine wave.',
      math: {
        title: 'Sine Wave Formula',
        body: 'x(t) = A · sin(2π·f·t + φ)<br>where A = amplitude, f = frequency (Hz), t = time (seconds), φ = phase offset',
      },
    },

    windowing: {
      icon: '🪟',
      name: 'Windowing',
      color: '#2196F3',
      plain:
        "Cuts your long signal into short, overlapping chunks called windows. This is necessary before FFT because the FFT assumes your signal repeats forever — without windowing, you'd get fake frequencies at the edges (called spectral leakage).",
      intuition:
        "Imagine reading a long novel by focusing on one page at a time, with some overlap so you don't lose context at page boundaries. That's windowing.",
      uses: [
        'Speech recognition preprocessing',
        'EEG band analysis',
        'Real-time audio processing',
        'Vibration fault detection',
      ],
      try: 'Change the Overlap from 0.5 to 0.9 — watch how many more windows are created. More windows = smoother time resolution, but slower processing.',
      math: {
        title: 'Hanning Window Function',
        body: 'w(n) = 0.5 · (1 − cos(2π·n / (N−1)))<br>Applied as: x_windowed[n] = x[n] · w[n]<br>This tapers the signal to zero at the edges, eliminating spectral leakage.',
      },
    },

    fftBlock: {
      icon: '📊',
      name: 'FFT',
      color: '#9C27B0',
      plain:
        "Converts your signal from the time domain (how amplitude changes over time) to the frequency domain (which frequencies are present and how strong they are). It answers the question: 'What notes is this signal playing?'",
      intuition:
        'Like shining white light through a prism — it splits into a rainbow of individual colors. FFT splits your signal into its component frequencies. A 10Hz sine wave will show a single spike at 10Hz. A chord on a piano will show multiple spikes.',
      uses: [
        'Audio equalizers and pitch detection',
        'ECG heart rate analysis',
        'Vibration fault diagnosis in motors',
        'Radio signal analysis',
        'MRI imaging',
      ],
      try: 'Set the Data Source to a 10Hz sine wave with 256 samples at 256Hz sample rate. Run the pipeline — you should see a single sharp spike at exactly 10Hz in the spectrum.',
      math: {
        title: 'Discrete Fourier Transform (DFT)',
        body: 'X[k] = Σ(n=0 to N-1) x[n] · e^(−j2πkn/N)<br>The FFT computes this in O(N log N) instead of O(N²).<br>The result X[k] gives the amplitude and phase of frequency k·(sampleRate/N) Hz.',
      },
    },

    statistics: {
      icon: '📈',
      name: 'Statistics',
      color: '#FF9800',
      plain:
        'Extracts numerical summaries from your signal — instead of looking at thousands of individual samples, you get a compact report: How large is it on average? How much does it vary? How many times does it cross zero? These summaries are called features.',
      intuition:
        'Like a report card for your signal. Instead of reading every sentence of an essay, you just look at: word count, average sentence length, number of paragraphs. Statistics does the same for signals.',
      uses: [
        'EMG signal strength estimation',
        'Heart rate variability analysis',
        'Audio loudness measurement',
        'Structural health monitoring',
        'Quality control in manufacturing',
      ],
      try: 'Check all metrics, then compare the statistics between a Sine Wave and a Square Wave of the same amplitude. Notice how the RMS values differ even though the peak amplitude is the same.',
      math: {
        title: 'Key Statistical Metrics',
        body: 'RMS = √(mean(x²)) — signal power<br>Variance = mean((x − mean(x))²) — spread<br>Crest Factor = peak / RMS — peakiness<br>Zero Crossings = count of sign changes per unit time',
      },
    },

    featureMerger: {
      icon: '🔗',
      name: 'Feature Merger',
      color: '#607D8B',
      plain:
        'Combines feature vectors from two upstream blocks into one wider vector. Use this when you want your AI to consider multiple types of information simultaneously — for example, both frequency content (from FFT) and statistical properties (from Statistics).',
      intuition:
        'Like filling in two questionnaires and combining them into one bigger form before handing it to a hiring manager. More information = better decisions.',
      uses: [
        'Multi-modal EMG classification (frequency + time features)',
        'Audio genre classification',
        'Multi-sensor fusion in robotics',
        'Clinical diagnosis from multiple biomarkers',
      ],
      try: 'Connect both the FFT Features output AND the Statistics Features output to this block, then feed the merged result into the Neural Network. Compare accuracy vs. using just one source.',
      math: {
        title: 'Feature Concatenation',
        body: 'merged[n] = [features_A[n], features_B[n]]<br>If A has 10 features and B has 5 features,<br>merged has 15 features per sample.<br>This increases the information available to the classifier.',
      },
    },

    neuralNetwork: {
      icon: '🧠',
      name: 'Neural Network',
      color: '#E91E63',
      plain:
        'A mathematical model loosely inspired by the brain. It learns patterns in your feature data and predicts which class a new signal belongs to. This one auto-trains itself using k-means clustering to automatically group your data into classes.',
      intuition:
        "Like teaching a dog tricks: you show it examples, it makes a guess, you reward or correct it, and repeat until it gets it right. After thousands of repetitions (epochs), it learns the pattern. The 'layers' are like stages of pattern recognition — early layers spot simple features, later layers combine them into complex decisions.",
      uses: [
        'Speech recognition (Apple Siri, Google Assistant)',
        'Medical diagnosis (ECG arrhythmia detection)',
        'Fraud detection in finance',
        'Gesture recognition via EMG',
      ],
      try: 'Increase Training Epochs from 100 to 500. Watch how the final accuracy improves. Then try changing the architecture to have 3 hidden layers — does it learn faster or slower?',
      math: {
        title: 'Forward Pass & Backpropagation',
        body: 'Forward: y = activation(W·x + b)<br>Loss: L = −Σ y_true · log(y_pred) (cross-entropy)<br>Update: w ← w − η · ∂L/∂w<br>where η = learning rate, computed via chain rule (backprop)',
      },
    },

    fuzzyClassifier: {
      icon: '🌫️',
      name: 'Fuzzy Classifier',
      color: '#795548',
      plain:
        "Instead of hard yes/no decisions, fuzzy logic gives partial membership — 'this signal is 70% High and 30% Medium'. It handles uncertainty gracefully and produces human-readable decisions with confidence scores.",
      intuition:
        "A thermostat doesn't just say HOT or COLD — it says 'somewhat warm, leaning hot'. Fuzzy logic formalizes this kind of human intuition. It's great when your categories naturally overlap rather than having sharp boundaries.",
      uses: [
        'HVAC control systems',
        'Camera autofocus algorithms',
        'Antilock braking (ABS)',
        'Medical symptom severity scoring',
        'Industrial process control',
      ],
      try: 'Change Defuzzification from Centroid to SOM (Smallest of Maximum). Notice how the classification boundaries shift. Centroid gives smooth, average decisions; SOM gives more conservative ones.',
      math: {
        title: 'Fuzzy Inference',
        body: '1. Fuzzify: μ_Low(x), μ_Med(x), μ_High(x) ∈ [0,1]<br>2. Fire rules: e.g. IF x is High THEN output = 1<br>3. Defuzzify (centroid):<br>&nbsp;&nbsp; y* = ∫μ(x)·x dx / ∫μ(x) dx',
      },
    },

    output: {
      icon: '📺',
      name: 'Output',
      color: '#F44336',
      plain:
        'Visualizes whatever data is flowing through it. Connect any upstream port to see it rendered as a chart. Different data types automatically get the most appropriate visualization — time signals as line charts, spectra as frequency plots, classifications as category summaries.',
      intuition:
        'Like plugging a TV into a camera — it just shows what it receives, in the best way it knows how.',
      uses: [
        'Any visualization need',
        'Multiple outputs can be connected simultaneously for side-by-side comparison',
      ],
      try: 'Connect BOTH the raw signal from Data Source AND the spectrum from FFT to two separate Output blocks. Run and compare the time-domain and frequency-domain views side by side.',
      math: null,
    },

    filter: {
      icon: '🎚️',
      name: 'Filter',
      color: '#00BCD4',
      plain:
        'Removes unwanted frequencies from your signal. A lowpass filter keeps only slow variations; a highpass keeps only fast changes; a bandpass keeps a specific frequency range; a notch removes one specific frequency (like 50/60Hz power line noise).',
      intuition:
        "Like sunglasses for your signal — they block certain wavelengths and let others through. A lowpass filter is like wearing glasses that only show blurry, slow-moving shapes.",
      uses: [
        'ECG baseline wander removal (highpass at 0.5Hz)',
        'EMG noise removal (lowpass at 500Hz)',
        'Power line noise removal (60Hz notch)',
        'Audio crossover networks in speaker systems',
      ],
      try: 'Add Gaussian noise to your signal using the Noise Addition block, then apply a lowpass filter and watch the noise disappear.',
      math: {
        title: 'Butterworth Filter Transfer Function',
        body: 'H(s) = 1 / (1 + (s/ωc)^2n)<br>The Butterworth filter has maximally flat frequency response in the passband.<br>Converted to digital using the bilinear transform: s → 2f_s·(z-1)/(z+1)',
      },
    },

    knnClassifier: {
      icon: '🎯',
      name: 'kNN Classifier',
      color: '#009688',
      plain:
        'k-Nearest Neighbors: to classify a new sample, it finds the k most similar training examples and votes on the class. Simple, intuitive, requires no training phase — just stores the training data and compares at prediction time.',
      intuition:
        "If you want to know if a neighborhood is expensive, look at the 5 nearest houses and see what they sold for. kNN does the same thing — to classify something new, ask its nearest neighbors what they are.",
      uses: [
        'Gesture recognition',
        'Anomaly detection',
        'Recommendation systems',
        'Medical diagnosis',
        'Image classification',
      ],
      try: 'Change k from 1 to 5 — a higher k smooths decision boundaries but can misclassify near boundaries.',
      math: {
        title: 'kNN Distance & Voting',
        body: 'dist(a,b) = √Σ(a_i − b_i)² (Euclidean)<br>Find k points in training set with smallest dist<br>Classify by majority vote among k neighbors<br>Time complexity: O(n·d) per query (n=samples, d=features)',
      },
    },

    rectifier: {
      icon: '⚡',
      name: 'Rectifier',
      color: '#FF5722',
      plain:
        'Converts a signal with positive and negative values into one that is all-positive. Full-wave rectification flips all negative values to positive; half-wave keeps only the positive parts. Essential preprocessing step for EMG signals.',
      intuition:
        "Like flipping all the valleys in a wave to become peaks. If you're measuring muscle activity, you don't care about direction — just magnitude.",
      uses: [
        'EMG signal processing (step 1 of envelope detection)',
        'Power supply design',
        'AM radio demodulation',
      ],
      try: "Apply full-wave rectification to an EMG signal, then connect to the Envelope block. You'll see the muscle activation pattern clearly.",
      math: {
        title: 'Rectification',
        body: 'Full-wave: y[n] = |x[n]|<br>Half-wave: y[n] = max(0, x[n])<br>The rectified signal is always ≥ 0, preserving magnitude information while discarding direction.',
      },
    },

    envelope: {
      icon: '〰️',
      name: 'Envelope',
      color: '#8BC34A',
      plain:
        'Extracts the slow-moving amplitude envelope from a signal — the overall shape of how loud or active the signal is over time. Used to detect when a muscle activates, when a sound starts, or how signal strength changes.',
      intuition:
        "Like tracing the outline of a mountain range — you're not interested in every rock, just the general shape of the terrain. The envelope follows the peaks of the signal, smoothed over time.",
      uses: [
        'EMG muscle onset detection',
        'Audio amplitude following (compressors, limiters)',
        'AM radio demodulation',
        'Respiratory signal extraction from ECG',
      ],
      try: 'Chain: Data Source (EMG) → Rectifier → Envelope → Output. Compare the envelope to the original EMG — the envelope clearly shows when the muscle is active.',
      math: {
        title: 'Moving RMS Envelope',
        body: 'E[n] = √(mean(x[n-W:n]²))<br>where W = window size (smoothing factor)<br>Alternatively: Hilbert transform gives instantaneous envelope:<br>E[n] = |x[n] + j·H{x[n]}|',
      },
    },

    liveDataSource: {
      icon: '📡',
      name: 'Live Data Source',
      color: '#1565C0',
      plain:
        'Connects to real-world data in real time — stock prices, sensors, or simulated feeds. Polls Yahoo Finance (or a built-in simulator) every N seconds and feeds fresh data into the pipeline. When new data arrives, it can automatically re-run the pipeline in Infer mode so your trained model makes predictions on the latest values.',
      intuition:
        'Polling means asking a server "any new data?" on a schedule. Each polling cycle that returns new data is called a tick. A symbol is the identifier for a financial instrument — for example, ^GSPC is the S&P 500 index, which tracks 500 large US companies. Auto-infer runs the pipeline without retraining, using the model you already trained.',
      uses: [
        'Live S&P 500 price monitoring and prediction',
        'Real-time sensor dashboards (IoT, industrial)',
        'Algorithmic trading signal generation',
        'Continuous anomaly detection on streaming data',
      ],
      try: 'Load the Live S&P 500 template. Click Train to train the Neural Network on simulated historical data, then click Start Live to fetch real prices and watch Buy/Hold/Sell predictions update automatically on each new tick.',
      math: {
        title: 'Polling & Tick Rate',
        body: 'poll_interval = N seconds (configurable)<br>On each tick: fetch latest price → append to signal buffer → run pipeline in Infer mode<br>^GSPC daily close is a clean time series: one data point per trading day (~252 per year)',
      },
    },

    neuralNetworkTopology: {
      icon: '🧠',
      name: 'NN Topology — How neurons connect',
      color: '#AD1457',
      plain:
        'The arrangement of layers and connections in a neural network determines what patterns it can learn. SignalFlow offers four topologies: Feedforward (standard one-direction flow), Recurrent/Jordan (output fed back as input for short-term memory), Deep (4 hidden layers for abstract feature detection), and Wide (1 very wide layer for many simple patterns in parallel).',
      intuition:
        'Think of topology like the floor plan of an office. A feedforward network is a straight hallway — data walks from one end to the other. A recurrent (Jordan) network has a feedback loop — the last room\'s output is passed back to the first room as extra context for the next visitor. Deep networks have many floors; wide networks have one very large floor.',
      uses: [
        'Feedforward: static feature classification (statistics, FFT features)',
        'Recurrent/Jordan: time series prediction where context matters (stock prices, ECG)',
        'Deep: complex pattern recognition when simple topologies underfit',
        'Wide: fast training with good generalisation, a strong first choice',
      ],
      try: 'In the Neural Network config, switch Topology from Feedforward to Jordan. Run Train mode on a stock price pipeline — the Jordan network remembers its previous prediction and uses it as an extra input, which can improve sequential accuracy.',
      math: {
        title: 'Jordan Recurrent Connection',
        body: 'At time t: input_t = [features_t, output_{t-1}]<br>In Train mode: recurrent state resets to zero at start of each run<br>In Infer mode: recurrent state carries over between pipeline runs<br>This gives the network continuous memory across live data ticks',
      },
    },
  };

  // -------------------------------------------------------------------------
  // HTML builders
  // -------------------------------------------------------------------------

  /**
   * Build the HTML string for a concept card.
   * @param {string} blockType
   * @returns {string} HTML
   */
  function _buildCardHTML(blockType) {
    const card = CARDS[blockType];

    if (!card) {
      return _buildUnknownCardHTML(blockType);
    }

    const useItems = card.uses
      .map((u) => `<li>${_escapeHTML(u)}</li>`)
      .join('');

    const mathSection = card.math
      ? `<div class="learn-section learn-section--math">
           <button class="learn-math-toggle" aria-expanded="false">
             The Math <span class="learn-math-arrow" aria-hidden="true">&#9656;</span>
           </button>
           <div class="learn-math-body" hidden>
             <h4 class="learn-math-title">${_escapeHTML(card.math.title)}</h4>
             <p class="learn-math-formula">${card.math.body}</p>
           </div>
         </div>`
      : '';

    return `
      <div class="learn-card" data-block-type="${_escapeAttr(blockType)}">
        <div class="learn-card-header" style="border-left: 4px solid ${_escapeAttr(card.color)};">
          <span class="learn-card-icon" aria-hidden="true">${card.icon}</span>
          <span class="learn-card-name">${_escapeHTML(card.name)}</span>
          <span class="learn-card-badge" style="background:${_escapeAttr(card.color)};">${_escapeHTML(card.name)}</span>
        </div>

        <div class="learn-section learn-section--plain">
          <h3 class="learn-section-title">Plain English</h3>
          <p class="learn-section-body">${_escapeHTML(card.plain)}</p>
        </div>

        <div class="learn-section learn-section--intuition">
          <h3 class="learn-section-title">Intuition</h3>
          <p class="learn-section-body">${_escapeHTML(card.intuition)}</p>
        </div>

        <div class="learn-section learn-section--uses">
          <h3 class="learn-section-title">Real-world uses</h3>
          <ul class="learn-uses-list">${useItems}</ul>
        </div>

        <div class="learn-section learn-section--try">
          <h3 class="learn-section-title">Try this</h3>
          <p class="learn-section-body learn-try-text">${_escapeHTML(card.try)}</p>
        </div>

        ${mathSection}
      </div>
    `;
  }

  /**
   * Fallback card for unknown block types.
   * @param {string} blockType
   * @returns {string} HTML
   */
  function _buildUnknownCardHTML(blockType) {
    return `
      <div class="learn-card learn-card--unknown">
        <div class="learn-card-header">
          <span class="learn-card-icon" aria-hidden="true">&#9632;</span>
          <span class="learn-card-name">${_escapeHTML(blockType)}</span>
        </div>
        <div class="learn-section">
          <p class="learn-section-body">No concept card is available for this block type yet.</p>
        </div>
      </div>
    `;
  }

  /**
   * Build the "What just happened?" summary HTML.
   * @param {object} runInfo
   * @returns {string} HTML
   */
  function _buildSummaryHTML(runInfo) {
    const paragraph = _generateSummaryParagraph(runInfo);

    const stepItems = (runInfo.executionOrder || [])
      .map((blockId) => {
        const block = (runInfo.blocks || []).find((b) => b.name === blockId || b.id === blockId);
        if (!block) return `<li><code>${_escapeHTML(blockId)}</code></li>`;
        const card = CARDS[block.type] || {};
        const icon = card.icon || block.icon || '';
        return `<li>${icon ? `<span aria-hidden="true">${icon}</span> ` : ''}<strong>${_escapeHTML(block.name || blockId)}</strong></li>`;
      })
      .join('');

    const stepsSection = stepItems
      ? `<div class="learn-section learn-section--steps">
           <h3 class="learn-section-title">Execution order</h3>
           <ol class="learn-steps-list">${stepItems}</ol>
         </div>`
      : '';

    return `
      <div class="learn-summary">
        <div class="learn-summary-header">
          <span class="learn-summary-icon" aria-hidden="true">&#9654;</span>
          <span class="learn-summary-title">What just happened?</span>
        </div>

        <div class="learn-section learn-section--summary-paragraph">
          <p class="learn-section-body">${paragraph}</p>
        </div>

        ${stepsSection}

        <div class="learn-section learn-section--stats">
          <h3 class="learn-section-title">Pipeline stats</h3>
          <ul class="learn-stats-list">
            <li><span class="learn-stat-label">Blocks:</span> <span class="learn-stat-value">${runInfo.totalBlocks ?? (runInfo.blocks || []).length}</span></li>
            <li><span class="learn-stat-label">Connections:</span> <span class="learn-stat-value">${(runInfo.connections || []).length}</span></li>
          </ul>
        </div>
      </div>
    `;
  }

  /**
   * Generate a plain-English paragraph summarising the pipeline run.
   * Attempts a template-based description first; falls back to a generic one.
   * @param {object} runInfo
   * @returns {string} plain text (no HTML tags)
   */
  function _generateSummaryParagraph(runInfo) {
    const blocks = runInfo.blocks || [];

    // Helper: find the first block matching a type
    const findBlock = (type) => blocks.find((b) => b.type === type);

    const ds = findBlock('dataSource');
    const win = findBlock('windowing');
    const fft = findBlock('fftBlock');
    const nn = findBlock('neuralNetwork');
    const fuzzy = findBlock('fuzzyClassifier');
    const knn = findBlock('knnClassifier');
    const stats = findBlock('statistics');

    // ---- Template path: at least dataSource present ----
    if (ds) {
      const parts = [];

      // Data source
      const generatorType = _safeGet(ds, 'result.generatorType') || 'signal';
      const nSamples = _safeGet(ds, 'result.samples') || _safeGet(ds, 'result.length') || 'N';
      const sampleRate = _safeGet(ds, 'result.sampleRate') || 'N';
      parts.push(
        `Your ${_escapeHTML(String(generatorType))} signal (${nSamples} samples at ${sampleRate} Hz)`
      );

      // Windowing
      if (win) {
        const windowCount = _safeGet(win, 'result.windowCount') || _safeGet(win, 'result.count') || 'several';
        const windowSize = _safeGet(win, 'result.windowSize') || _safeGet(win, 'result.size') || '';
        const windowFn = _safeGet(win, 'result.windowFunction') || _safeGet(win, 'result.type') || 'Hanning';
        const sizeStr = windowSize ? ` of ${windowSize} samples each` : '';
        parts.push(
          `was split into ${windowCount} overlapping windows${sizeStr}, using a ${_escapeHTML(String(windowFn))} window function`
        );
      } else {
        parts.push('was processed');
      }

      // FFT
      if (fft) {
        const freqBins = _safeGet(fft, 'result.bins') || _safeGet(fft, 'result.features') || '';
        const binsStr = freqBins ? `${freqBins} frequency components` : 'frequency components';
        parts.push(`analyzed with FFT to extract ${binsStr}`);
      }

      // Statistics
      if (stats && !fft) {
        const metricCount = _safeGet(stats, 'result.metrics')
          ? Object.keys(_safeGet(stats, 'result.metrics')).length
          : '';
        const metricStr = metricCount ? `${metricCount} statistical features` : 'statistical features';
        parts.push(`summarized into ${metricStr}`);
      }

      // Classifier
      const classifier = nn || fuzzy || knn;
      if (classifier) {
        let classifierDesc = '';
        if (nn) {
          const epochs = _safeGet(nn, 'result.epochs') || _safeGet(nn, 'result.trainedEpochs') || '';
          const classes = _safeGet(nn, 'result.classes') || _safeGet(nn, 'result.categories') || '';
          const confidence = _safeGet(nn, 'result.confidence') || _safeGet(nn, 'result.accuracy') || '';
          const epochStr = epochs ? ` for ${epochs} epochs` : '';
          const classStr = classes ? ` into ${classes} categories` : '';
          const confStr = confidence ? ` with ${Math.round(Number(confidence) * 100)}% average confidence` : '';
          classifierDesc = `The neural network trained${epochStr} and classified the signal${classStr}${confStr}`;
        } else if (fuzzy) {
          const method = _safeGet(fuzzy, 'result.defuzzMethod') || 'Centroid';
          classifierDesc = `The fuzzy classifier applied ${_escapeHTML(String(method))} defuzzification to produce soft class memberships`;
        } else if (knn) {
          const k = _safeGet(knn, 'result.k') || _safeGet(knn, 'params.k') || '';
          classifierDesc = `The kNN classifier${k ? ` (k=${k})` : ''} voted on the nearest neighbors to assign a class`;
        }
        if (classifierDesc) parts.push(classifierDesc);
      }

      // Mention live data blocks
      try {
        const liveBlocks = blocks.filter((b) => b.type === 'liveDataSource');
        if (liveBlocks.length > 0) {
          parts.push('📡 Live data block active — pipeline will auto-infer on each new tick');
        }
      } catch (e) {
        // Ignore if block list is unavailable
      }

      // Join with punctuation
      if (parts.length === 1) return parts[0] + '.';
      const last = parts.pop();
      return parts.join(', ') + ', then ' + last + '.';
    }

    // ---- Fallback: describe each block in execution order ----
    if (blocks.length === 0) {
      return 'The pipeline ran successfully with no blocks.';
    }

    const ordered = runInfo.executionOrder && runInfo.executionOrder.length > 0
      ? runInfo.executionOrder
          .map((id) => blocks.find((b) => b.name === id || b.id === id))
          .filter(Boolean)
      : blocks;

    const descriptions = ordered.map((block) => {
      const card = CARDS[block.type];
      const icon = (card && card.icon) ? card.icon + ' ' : '';
      const name = block.name || card?.name || block.type;
      return `${icon}${name}`;
    });

    return (
      'The pipeline executed the following blocks in order: ' +
      descriptions.join(' → ') +
      '.'
    );
  }

  // -------------------------------------------------------------------------
  // Utility helpers
  // -------------------------------------------------------------------------

  /** Safely traverse a dot-notation path on an object. */
  function _safeGet(obj, path) {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((acc, key) => (acc != null ? acc[key] : undefined), obj);
  }

  /** Escape text for safe HTML insertion. */
  function _escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Escape text for use inside HTML attribute values. */
  function _escapeAttr(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;');
  }

  // -------------------------------------------------------------------------
  // Collapsible math section wiring
  // -------------------------------------------------------------------------

  /**
   * Attach click handlers to all ".learn-math-toggle" buttons within a
   * given root element.
   * @param {Element} root
   */
  function _wireCollapsibles(root) {
    const toggles = root.querySelectorAll('.learn-math-toggle');
    toggles.forEach((btn) => {
      btn.addEventListener('click', () => {
        const body = btn.nextElementSibling;
        if (!body) return;
        const isHidden = body.hidden;
        body.hidden = !isHidden;
        btn.setAttribute('aria-expanded', String(isHidden));
        const arrow = btn.querySelector('.learn-math-arrow');
        if (arrow) {
          // ▶ (right) when collapsed, ▼ (down) when expanded
          arrow.innerHTML = isHidden ? '&#9662;' : '&#9656;';
        }
      });
    });
  }

  // -------------------------------------------------------------------------
  // DOM setup
  // -------------------------------------------------------------------------

  /**
   * Resolve the panel DOM element and cache child elements.
   * Safe to call multiple times — idempotent after first success.
   * @param {string} [panelId='learn-panel']
   */
  function _ensureInit(panelId) {
    if (_initialized && _panelEl) return;

    const id = panelId || 'learn-panel';
    _panelEl = document.getElementById(id);

    if (!_panelEl) {
      console.warn(`LearnPanel: element #${id} not found in DOM.`);
      return;
    }

    _contentEl = _panelEl.querySelector('.learn-panel-content');

    if (!_contentEl) {
      // Create content area if it doesn't exist yet
      _contentEl = document.createElement('div');
      _contentEl.className = 'learn-panel-content';
      _panelEl.appendChild(_contentEl);
    }

    // Wire up close button if present
    const closeBtn = _panelEl.querySelector('.learn-panel-close, [data-learn-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => hide());
    }

    _initialized = true;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Wire up the DOM panel element.
   * @param {string} panelId — id attribute of the panel element
   */
  function init(panelId) {
    _ensureInit(panelId || 'learn-panel');
  }

  /**
   * Show the concept card for a given block type.
   * @param {string} blockType — key into CARDS (e.g. 'fftBlock')
   */
  function showCard(blockType) {
    _ensureInit();
    if (!_panelEl || !_contentEl) return;

    _contentEl.innerHTML = _buildCardHTML(blockType);
    _wireCollapsibles(_contentEl);
    _show();
  }

  /**
   * Show the "What just happened?" summary after a pipeline run.
   * @param {object} runInfo — { blocks, connections, totalBlocks, executionOrder }
   */
  function showSummary(runInfo) {
    _ensureInit();
    if (!_panelEl || !_contentEl) return;

    const info = runInfo || {};
    _contentEl.innerHTML = _buildSummaryHTML(info);
    _show();
  }

  /**
   * Hide the learn panel.
   */
  function hide() {
    if (!_panelEl) return;
    _panelEl.classList.remove('visible');
    _visible = false;
  }

  /**
   * Returns true if the panel is currently visible.
   * @returns {boolean}
   */
  function isVisible() {
    return _visible;
  }

  // -------------------------------------------------------------------------
  // Internal show helper
  // -------------------------------------------------------------------------

  function _show() {
    if (!_panelEl) return;
    _panelEl.classList.add('visible');
    _visible = true;
  }

  // -------------------------------------------------------------------------
  // Expose public surface
  // -------------------------------------------------------------------------

  return {
    init,
    showCard,
    showSummary,
    hide,
    isVisible,
  };
})();
