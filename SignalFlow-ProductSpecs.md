# SignalFlow — Product Specification v2.0
### "The Playground for Signal Processing & AI"

---

## 1. Vision & Positioning

**What it is:** A free, browser-based, zero-install interactive studio where anyone — students, engineers, curious hobbyists, researchers — can explore how signals work, how they're processed, and how neural networks and fuzzy logic make sense of them.

**Who it's for (personas):**
- 🎓 **The Curious Student** — heard about FFT in class, wants to actually see it
- 🔬 **The Biomedical Researcher** — has ECG/EMG data, wants to quickly prototype a pipeline
- 🎵 **The Audio/Music Hacker** — wants to visualize their microphone in real time
- 🏭 **The Engineer** — exploring signal classification for vibration, industrial sensors
- 🤖 **The AI Learner** — wants to see how neural networks and fuzzy logic actually behave on real data

**Competitive positioning:**  
Nothing currently offers this combination in a browser: interactive + visual pipeline + real data + ML + education layer. The closest references are:
- `jackschaedler.github.io/circles-sines-signals` — beautiful interactive DSP education but static, no pipeline
- Node-RED — powerful pipeline editor but not DSP/ML focused, not educational
- MATLAB Signal Analyzer App — powerful but expensive, desktop-only, complex

---

## 2. Core Design Principles

1. **See before you learn** — every parameter change must update visuals immediately
2. **No install, no login** — runs in any modern browser, fully offline-capable
3. **Progressive complexity** — zero math visible by default; math revealed on demand
4. **Explain everything** — every block, port, parameter has a human-readable tooltip
5. **Real signals welcome** — microphone, file upload, or simulated; all first-class
6. **Fail gracefully** — wrong connections show helpful messages, not silent errors

---

## 3. Feature Specifications

### 3.1 UI / Pipeline Editor

**Current state:** Functional drag-and-drop canvas with bezier connections.

**Improvements required:**

#### Hover Tooltips (Priority 1 — already requested)
- **Block hover:** Show a card with: block name, what it does in plain English, what goes in, what comes out, and a mini example use case. Example for FFT block: *"Converts your signal from the time domain (how amplitude changes over time) into the frequency domain (which frequencies are present and how strong they are). Connect after a Data Source or Windowing block."*
- **Port/pin hover:** Show the data type flowing through that port, its current value summary (e.g. "1024 samples at 250 Hz"), and what types of blocks can connect to it.
- **Connection hover:** Show data flowing through that wire — type, shape, preview.
- **Parameter hover:** Show what the parameter does, its unit, typical values, and what happens at extremes.

#### Minimap
- Small overview in bottom-right corner showing full pipeline at a glance
- Click to navigate to that area

#### Undo / Redo
- `Cmd+Z` / `Cmd+Y` for all pipeline edits

#### Block Search
- Press `/` or `Space` on canvas to open a floating block search palette (like Figma or Blender's node editor)

#### Connection Validation
- Typed ports: visually show which ports are compatible when dragging a connection
- Incompatible connections show a clear warning, not just fail silently

#### Zoom & Pan Polish
- Smooth trackpad zoom (currently may be jerky)
- Fit-to-screen button (`F` key)

---

### 3.2 Data Sources — Major Expansion

**Current:** 12 simulated signal generators + CSV/Excel import.

**Add:**

#### Real-Time Microphone Input (Web Audio API)
- One-click "Use Microphone" option in Data Source block
- Uses `navigator.mediaDevices.getUserMedia()` + `AnalyserNode`
- Sample rate auto-detected (typically 44.1 kHz or 48 kHz)
- Live waveform preview inside the block
- Configurable buffer size (256 to 8192 samples)

#### Audio File Import
- Drag an MP3/WAV file directly onto the canvas → creates a Data Source block
- Web Audio API decodes → provides as timeseries

#### Real Biomedical Datasets (Curated Samples)
Bundle a small set of real, open-access signals from PhysioNet as built-in examples:
- ECG: Normal sinus rhythm, arrhythmia example
- EMG: Muscle activation during different gestures
- EEG: Alpha/beta band examples
These load from bundled JSON — no server required.

#### Improved Generators
- Add: **White Noise**, **Pink Noise**, **Impulse**, **Step Function**, **Sawtooth**
- Each generator gets a visual mini-preview inside the block as parameters change

---

### 3.3 Signal Processing Blocks — Additions

**Current:** Windowing, FFT, Statistics, Feature Merger.

**Add:**

| Block | Description |
|---|---|
| **Filter** | IIR/FIR filters: lowpass, highpass, bandpass, notch. Configurable cutoff frequency, order. Show frequency response (Bode plot) in real time |
| **Spectrogram** | Time-frequency heatmap. Critical for audio, EEG, vibration |
| **Wavelet Transform** | DWT/CWT as alternative to FFT for non-stationary signals |
| **Noise Addition** | Add Gaussian or colored noise with configurable SNR — for teaching concepts |
| **Rectifier** | Full/half-wave rectification (key for EMG processing) |
| **Envelope** | Moving RMS or Hilbert envelope extraction |
| **Resampler** | Downsample/upsample a signal |
| **Correlator** | Cross-correlation between two signals |
| **Comparator** | Compare two signals, show difference |
| **Signal Annotator** | Mark events/peaks on a signal for labeled training data |

---

### 3.4 AI / Classification Blocks — Improvements & Additions

**Current:** Neural Network (mini-batch SGD) + Fuzzy Classifier.

**Improvements:**

#### Neural Network Block
- Show a live loss curve while training (not just final result)
- Show a confusion matrix after training
- Add preset architectures: "Simple (1 layer)", "Deep (3 layers)", "Wide"
- Add: training/test split control
- Add: k-fold cross-validation option

#### Fuzzy Classifier Block  
- Visual membership function editor — drag the trapezoids/triangles directly
- Show rule firing strengths during inference

**New AI blocks:**

| Block | Description |
|---|---|
| **k-NN Classifier** | k-Nearest Neighbors. Simple, intuitive, great for teaching |
| **SVM Classifier** | Support Vector Machine via a JS implementation |
| **PCA** | Dimensionality reduction — visualize feature space in 2D |
| **Clustering (k-Means)** | Unsupervised — find patterns without labels |
| **Decision Tree** | Visual, interpretable classification tree |
| **Anomaly Detector** | Flag signals that deviate from a learned baseline |

#### Train / Inference Mode (Priority 1 — implemented March 2026)

Two distinct pipeline run modes allow separating model training from real-time inference:

| Element | Description |
|---|---|
| **▶ Train button** | Runs pipeline in *train* mode — classifiers (re)train on incoming data |
| **⚡ Infer button** | Runs pipeline in *infer* mode — classifiers use saved model, no retraining |
| **Right-click context menu** | On any classifier block: Train Pipeline / Run Inference / Reset Model / Settings / Delete |
| **Model badge on block** | "✓ Trained" (green) after training; "⚠ No model" (orange) in infer mode with no model |

**Block behaviour:**
- **Neural Network**: `trainedNetwork` config field persists across runs. In Infer mode, prediction uses saved weights. `forceRetrain = true` (set by Reset Model) forces a full retrain on next Train run.
- **k-NN Classifier**: `_trainData` config field stores training vectors+labels during Train mode. In Infer mode, incoming vectors are classified against stored training data.

**Example workflow — Stock Market:**
1. Load Data Source (2020–2022 CSV) → Windowing → Statistics → Neural Network → Output
2. Click **▶ Train** — NN trains on historical patterns, block shows "✓ Trained"
3. Change Data Source to 2023 CSV (or upload new file)
4. Click **⚡ Infer** — NN predicts Buy/Hold/Sell on 2023 data without retraining
5. Right-click NN block → **🔄 Reset Model** → next Train run retrains from scratch

---

### 3.5 Visualization & Output

**Current:** Line charts, bar charts, scatter plots, tables.

**Add:**

| Visualization | Use Case |
|---|---|
| **Spectrogram (waterfall)** | Audio/EEG time-frequency view |
| **Polar/Radar chart** | Multi-feature comparison |
| **Confusion Matrix** | NN/classifier performance |
| **Feature Space 2D** | PCA scatter with class coloring |
| **Real-time scrolling chart** | For live microphone data |
| **Waveform + annotation overlay** | Show predicted class regions on the raw signal |
| **Bode Plot** | Filter frequency response |

---

### 3.6 Education Layer — NEW (Major Differentiator)

This is what separates SignalFlow from any other tool.

#### Concept Cards
Every block has an expandable "Learn" panel:
- **Plain English explanation** (no math)
- **Intuition builder** (analogy / metaphor)
- **The math** (expandable, for those who want it)
- **Real-world use cases** (where is this used?)
- **"Try this" experiments** — suggested parameter changes and what to observe

Example for FFT block Learn card:
> **Plain English:** Your signal is a mix of many frequencies playing at once, like a chord on a piano. FFT separates them out, telling you exactly which notes (frequencies) are present and how loud each one is.
> **Intuition:** Imagine shining white light through a prism — it splits into a rainbow. FFT does the same thing to your signal.
> **Math:** [expandable DFT formula with explanation]
> **Real-world uses:** Audio equalization, heart rate detection from ECG, vibration analysis in motors
> **Try this:** Change the frequency of the sine wave generator. Watch the FFT spike move left or right.

#### Guided Tours / Learning Paths
Pre-built interactive walkthroughs:
1. **"What is a signal?"** — start from zero, build intuition
2. **"The Fourier Transform"** — inspired by jackschaedler.github.io style interactivity
3. **"From signal to decision"** — full pipeline walkthrough: ECG → features → NN → diagnosis
4. **"Noise and filtering"** — add noise, build a filter, watch it clean the signal
5. **"Introduction to Neural Networks via Signal Data"**
6. **"What is Fuzzy Logic?"**

Each tour is a step-by-step overlay on the actual pipeline editor — the user interacts with the real tool while being guided.

#### "What just happened?" Panel
After every pipeline run, show a plain-English summary:
> "Your ECG signal was split into 64 overlapping windows. Each window was passed through FFT to find its frequency components. The neural network then looked at these frequency features and predicted the signal class with 94% confidence."

---

### 3.7 Templates & Examples — Expansion

**Current:** 3 templates.

**Add 10+ curated templates:**

| Template | Signal | Pipeline | What it teaches |
|---|---|---|---|
| Heart Rate Monitor | ECG | FFT → Peak Detection | Frequency analysis, biomedical |
| Voice Frequency Analyzer | Microphone | Real-time FFT → Spectrogram | Audio analysis |
| Muscle Gesture Classifier | EMG | Rectify → Envelope → Features → NN | EMG processing, classification |
| Vibration Fault Detection | Vibration | FFT → Anomaly Detector | Industrial predictive maintenance |
| Stock Pattern Recognition | Stock | Statistics → Fuzzy → Buy/Hold/Sell | Financial signals |
| Sleep Stage Classifier | EEG | Bandpass → Features → NN | EEG, brain signals |
| Noise Cancellation Demo | Sine + Noise | Filter → Compare | Filtering intuition |
| Chirp Analysis | Chirp | Spectrogram | Non-stationary signals |
| Neural Network Playground | Sine composite | Features → NN | Pure ML learning |
| Build Your Own | Blank | — | Free exploration |

---

### 3.8 Pipeline Sharing & Collaboration

- **Share link:** Serialize pipeline to JSON → encode in URL → shareable link (no server needed)
- **Export pipeline as JSON** (already exists, improve UX)
- **Export results as CSV** (already exists)
- **Embed mode:** `?embed=true` URL param removes chrome — embed in course websites or blogs
- **Screenshot pipeline** — download a PNG of the canvas

---

### 3.9 Performance & Technical Improvements

| Area | Improvement |
|---|---|
| **Real-time mode** | For microphone input: streaming pipeline that re-runs continuously on new audio chunks |
| **Web Workers** | Move heavy computation (FFT, NN training) off main thread to prevent UI freeze |
| **Pipeline execution feedback** | Show which block is currently running, with progress |
| **Error messages** | When a block fails, show exactly why in human-readable language |
| **Mobile-friendly** | Basic touch support for pipeline view (even if editing is desktop-only) |
| **PWA** | Progressive Web App manifest so it can be installed and used offline |

---

## 4. Information Architecture

```
SignalFlow
├── Canvas (main pipeline editor)
│   ├── Block Sidebar (categorized)
│   │   ├── 📥 Input (Data Source, Microphone, File)
│   │   ├── 🔧 Processing (Filter, Windowing, FFT, Stats...)
│   │   ├── 🤖 AI (NN, Fuzzy, kNN, PCA, Clustering...)
│   │   └── 📊 Output (Chart, Table, Export)
│   ├── Canvas Area
│   └── Config Panel (right sidebar, per-selected block)
│
├── Learn Panel (collapsible right panel)
│   ├── Concept Card for selected block
│   └── "What just happened?" after run
│
├── Templates Gallery (landing / welcome screen)
│   ├── Beginner (5)
│   ├── Biomedical (3)
│   ├── Audio (2)
│   └── AI/ML (3)
│
└── Learning Paths (separate mode)
    ├── Guided Tours (overlay on main editor)
    └── Interactive Explainers
```

---

## 5. Implementation Priority (Phased Roadmap)

### Phase 1 — Polish & UX (2–3 weeks)
- Rich hover tooltips for blocks, ports, parameters *(already requested)*
- Concept cards (Learn panel) for all existing blocks
- Fix connection validation with type hints
- Undo/redo
- Improve existing chart types

### Phase 2 — Real Signals (2 weeks)
- Microphone input via Web Audio API
- Audio file import (MP3/WAV)
- Bundled real biomedical sample datasets
- Additional signal generators (noise, impulse, sawtooth)

### Phase 3 — New Processing Blocks (3 weeks)
- Filter block (lowpass/highpass/bandpass with Bode plot)
- Spectrogram block
- Rectifier + Envelope (for EMG)
- Noise Addition block (for teaching)

### Phase 4 — AI Expansion (3 weeks)
- k-NN classifier
- PCA block with 2D scatter visualization
- k-Means clustering
- NN: live loss curve + confusion matrix

### Phase 5 — Education Layer (3 weeks)
- Guided learning paths / tours
- "What just happened?" summary panel
- 10+ curated templates
- Share-by-URL feature

### Phase 6 — Performance & Mobile (2 weeks)
- Web Workers for heavy computation
- PWA / offline support
- Real-time streaming mode for microphone
- Mobile touch support

---

## 6. Technical Stack Decisions

| Decision | Recommendation | Rationale |
|---|---|---|
| **Framework** | Stay vanilla JS OR migrate to React | React would enable ReactFlow for canvas (professional), but adds build complexity. Vanilla keeps zero-install simplicity. |
| **Canvas library** | Consider ReactFlow if migrating | Best-in-class node editor UX, used by Stripe, Typeform, ML platforms |
| **Real-time audio** | Web Audio API + AudioWorklet | Native browser, low latency, no dependencies |
| **ML in browser** | Current custom NN OR add TensorFlow.js | TF.js adds CNN/LSTM capability at the cost of bundle size |
| **Charting** | Keep custom canvas renderer | It works, it's fast, no dependency |
| **Deployment** | Static hosting (Netlify/GitHub Pages) | Zero server cost, works offline |

---

## 7. Key Metrics to Track

- **Time to first insight** — how quickly can a new user get a chart from a signal?
- **Template completion rate** — do people actually run the templates?
- **Block diversity** — how many different block types does an average session use?
- **Return rate** — do people come back?
- **Education engagement** — how many people expand the Learn panels?

---

## 8. Inspiration & Reference

| Source | What to borrow |
|---|---|
| [circles-sines-signals](https://jackschaedler.github.io/circles-sines-signals/) | Interactive, visual-first DSP education approach |
| [Node-RED](https://nodered.org/) | Pipeline UX patterns, block library organization |
| [ReactFlow showcase](https://reactflow.dev/) | Node editor interaction patterns |
| [MATLAB Signal Analyzer](https://www.mathworks.com/discovery/biomedical-signal-processing.html) | Feature completeness reference |
| [PhysioNet](https://physionet.org/about/database/) | Source for bundled real biomedical signal datasets |
| [Setosa.io](https://setosa.io/ev/) | Visual explanation style |

---

*Document version: 1.0 — March 2026*  
*Based on: analysis of existing SignalFlow codebase + research into DSP education tools, interactive learning platforms, Web Audio API capabilities, and node-based UI best practices.*
