# SignalFlow - Signal Processing Studio

A visual, browser-based signal processing pipeline builder. Drag-and-drop processing blocks onto a canvas, connect them, configure parameters, and run analysis on any time-domain signal -- biomedical, financial, industrial, or custom data.

## Quick Start

1. Open `index.html` in a modern browser, or serve via any HTTP server:
   ```bash
   # Python
   python3 -m http.server 8000

   # Node.js
   npx serve .
   ```
2. Choose a template from the welcome screen, or start with a blank canvas.
3. Drag blocks from the left sidebar onto the canvas.
4. Connect block ports by clicking and dragging between output (right) and input (left) dots.
5. Click a block to configure its parameters in the right panel.
6. Press **Run** (or `Ctrl+Enter`) to execute the pipeline.

## Features

### Visual Pipeline Editor
- Drag-and-drop block placement
- Port-to-port wiring with bezier curves
- Click connections to delete them
- Block configuration panel with live parameter editing
- Pipeline save/load (JSON) and auto-save to localStorage

### Processing Blocks

| Block | Category | Description |
|-------|----------|-------------|
| **Data Source** | Input | Load CSV/Excel files, enter data manually, or generate sample signals (sine, ECG, EEG, stock market, vibration, chirp, etc.) |
| **Windowing** | Preprocessing | Segment signals into overlapping windows with selectable window functions (Hanning, Hamming, Blackman, Bartlett, Flat-Top) |
| **FFT** | Transform | Time-to-frequency domain via Fast Fourier Transform. Configurable coefficient count, output type (magnitude/power/phase), normalization, log scale |
| **Statistics** | Transform | Compute RMS, Mean, Variance, StdDev, Peak, Crest Factor, Zero Crossings, Energy |
| **Feature Merger** | Transform | Concatenate feature vectors from multiple upstream blocks |
| **Neural Network** | Classifier | Configurable feed-forward NN: layer count, neurons per layer, activation functions (ReLU, sigmoid, tanh, softmax), learning rate, momentum, epochs |
| **Fuzzy Classifier** | Classifier | Threshold-based fuzzy inference with configurable classes, membership functions, and defuzzification methods (centroid, bisector, MOM) |
| **Output** | Output | Visualize results as line charts, bar charts, scatter plots, or data tables |

### Sample Data Generators
- **Sine Wave** / **Multi-Sine Composite** / **Chirp**
- **Square Wave** with configurable duty cycle
- **ECG** (heart signal simulation)
- **EEG** (brain signal with selectable dominant band)
- **Stock Market** (geometric Brownian motion)
- **Mechanical Vibration** with harmonics and damping
- **Random Walk**

### Built-in Templates
- **FFT Analysis** -- composite sine signal with frequency spectrum visualization
- **Signal Classification** -- ECG windowing, FFT + statistics feature extraction, neural network, fuzzy classifier
- **Stock Analysis** -- financial time-series with statistical features and buy/hold/sell signals

### Data I/O
- CSV import with automatic column detection
- Excel (.xlsx/.xls) import via SheetJS
- Manual data entry (comma-separated values)
- CSV export of all pipeline results
- Pipeline save/load as JSON

## Architecture

```
index.html          Main page
css/app.css         All styling (dark theme, responsive)
js/
  dsp.js            DSP algorithms: FFT, DFT, windowing, statistics, filters
  nn.js             Feed-forward neural network with backpropagation
  fuzzy.js          Fuzzy logic inference system and classifiers
  data.js           CSV/Excel parsing and sample data generators
  blocks.js         Block type definitions, configs, and processing logic
  charts.js         Canvas-based charting and visualization
  pipeline.js       Visual pipeline editor (drag, connect, execute)
  main.js           App orchestration, UI events, save/load
```

## Technical Details

- **Zero build step** -- pure HTML/CSS/JavaScript, no framework dependencies
- **Canvas-based charting** -- custom renderer, no charting library needed
- **FFT** -- Cooley-Tukey radix-2 implementation with bit-reversal permutation
- **Neural Network** -- Xavier weight initialization, momentum-based SGD, mini-batch training
- **Fuzzy Logic** -- Mamdani and Sugeno inference, 7 membership function types, 5 defuzzification methods
- **Topological sort** for correct block execution order

## Browser Support

Works in any modern browser (Chrome, Firefox, Safari, Edge). The only external dependency is SheetJS (loaded from CDN) for Excel file support.

## License

MIT
