// generate_sample_data.js - Creates Excel sample data files for testing
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'test_data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Stock Market Data (multiple scenarios)
// ═══════════════════════════════════════════════════════════════════════════════

function generateStockData() {
  const wb = XLSX.utils.book_new();

  // Scenario A: Bull market (rising trend)
  const bullData = [['Day', 'Close', 'Volume', 'High', 'Low']];
  let price = 100;
  for (let i = 0; i < 200; i++) {
    const change = 0.002 + 0.015 * (Math.random() * 2 - 1);
    price *= (1 + change);
    const high = price * (1 + Math.random() * 0.02);
    const low = price * (1 - Math.random() * 0.02);
    const vol = Math.floor(1000000 + Math.random() * 500000);
    bullData.push([i + 1, +price.toFixed(2), vol, +high.toFixed(2), +low.toFixed(2)]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bullData), 'BullMarket');

  // Scenario B: Bear market (falling trend)
  const bearData = [['Day', 'Close', 'Volume', 'High', 'Low']];
  price = 150;
  for (let i = 0; i < 200; i++) {
    const change = -0.003 + 0.015 * (Math.random() * 2 - 1);
    price *= (1 + change);
    price = Math.max(price, 10);
    const high = price * (1 + Math.random() * 0.02);
    const low = price * (1 - Math.random() * 0.02);
    const vol = Math.floor(1200000 + Math.random() * 800000);
    bearData.push([i + 1, +price.toFixed(2), vol, +high.toFixed(2), +low.toFixed(2)]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bearData), 'BearMarket');

  // Scenario C: Sideways / range-bound
  const sideData = [['Day', 'Close', 'Volume', 'High', 'Low']];
  price = 100;
  for (let i = 0; i < 200; i++) {
    const change = 0.02 * (Math.random() * 2 - 1);
    price *= (1 + change);
    price = Math.max(85, Math.min(115, price));  // clamp to range
    const high = price * (1 + Math.random() * 0.01);
    const low = price * (1 - Math.random() * 0.01);
    const vol = Math.floor(800000 + Math.random() * 400000);
    sideData.push([i + 1, +price.toFixed(2), vol, +high.toFixed(2), +low.toFixed(2)]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sideData), 'Sideways');

  // Scenario D: Volatile with crash
  const volData = [['Day', 'Close', 'Volume', 'High', 'Low']];
  price = 120;
  for (let i = 0; i < 200; i++) {
    let change;
    if (i >= 80 && i <= 100) {
      change = -0.03 + 0.02 * (Math.random() * 2 - 1);  // crash period
    } else if (i > 100 && i <= 130) {
      change = 0.02 + 0.02 * (Math.random() * 2 - 1);  // recovery
    } else {
      change = 0.001 + 0.015 * (Math.random() * 2 - 1);
    }
    price *= (1 + change);
    price = Math.max(price, 5);
    const high = price * (1 + Math.random() * 0.03);
    const low = price * (1 - Math.random() * 0.03);
    const vol = Math.floor(900000 + Math.random() * 1000000);
    volData.push([i + 1, +price.toFixed(2), vol, +high.toFixed(2), +low.toFixed(2)]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(volData), 'Volatile');

  XLSX.writeFile(wb, path.join(dataDir, 'stock_data.xlsx'));
  console.log('Created stock_data.xlsx with 4 sheets (Bull, Bear, Sideways, Volatile)');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. EMG Signal Data (hand muscle movements)
// ═══════════════════════════════════════════════════════════════════════════════

function generateEMGSignal(movement, sampleRate, duration) {
  const samples = sampleRate * duration;
  const data = [];

  // EMG parameters vary by movement type
  const params = {
    pronation:  { freqRange: [20, 150], burstAmp: 0.8, burstDuty: 0.6, noise: 0.05 },
    supination: { freqRange: [25, 200], burstAmp: 0.9, burstDuty: 0.5, noise: 0.04 },
    flexion:    { freqRange: [30, 250], burstAmp: 1.0, burstDuty: 0.7, noise: 0.06 },
    extension:  { freqRange: [15, 180], burstAmp: 0.7, burstDuty: 0.55, noise: 0.05 },
    rest:       { freqRange: [10, 50],  burstAmp: 0.05, burstDuty: 0.0, noise: 0.02 }
  };

  const p = params[movement] || params.rest;
  const burstLen = Math.floor(samples * p.burstDuty);
  const burstStart = Math.floor((samples - burstLen) / 2);

  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    let value = 0;

    // During burst (active contraction)
    if (i >= burstStart && i < burstStart + burstLen) {
      // EMG is modeled as superposition of Motor Unit Action Potentials (MUAPs)
      const numMUs = 8;
      for (let mu = 0; mu < numMUs; mu++) {
        const freq = p.freqRange[0] + Math.random() * (p.freqRange[1] - p.freqRange[0]);
        const phase = Math.random() * 2 * Math.PI;
        const amp = p.burstAmp / numMUs * (0.5 + Math.random());
        // Envelope: ramp up/down
        const burstPhase = (i - burstStart) / burstLen;
        const envelope = Math.sin(Math.PI * burstPhase);
        value += amp * envelope * Math.sin(2 * Math.PI * freq * t + phase);
      }
    }
    // Baseline noise
    value += p.noise * (Math.random() * 2 - 1);
    data.push(value);
  }
  return data;
}

function generateEMGData() {
  const wb = XLSX.utils.book_new();
  const sampleRate = 1000;  // 1kHz typical for sEMG
  const duration = 2;       // 2 seconds per trial
  const movements = ['pronation', 'supination', 'flexion', 'extension', 'rest'];
  const trialsPerMovement = 10;

  for (const movement of movements) {
    const header = ['Time_ms'];
    for (let trial = 1; trial <= trialsPerMovement; trial++) {
      header.push(`Trial_${trial}`);
    }
    const rows = [header];

    const signals = [];
    for (let trial = 0; trial < trialsPerMovement; trial++) {
      signals.push(generateEMGSignal(movement, sampleRate, duration));
    }

    for (let i = 0; i < sampleRate * duration; i++) {
      const row = [+(i / sampleRate * 1000).toFixed(1)];
      for (let trial = 0; trial < trialsPerMovement; trial++) {
        row.push(+signals[trial][i].toFixed(6));
      }
      rows.push(row);
    }

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), movement);
  }

  XLSX.writeFile(wb, path.join(dataDir, 'emg_hand_movements.xlsx'));
  console.log('Created emg_hand_movements.xlsx with 5 sheets (pronation, supination, flexion, extension, rest)');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Audio Signal Data (speech-like signals)
// ═══════════════════════════════════════════════════════════════════════════════

function generateAudioData() {
  const wb = XLSX.utils.book_new();
  const sampleRate = 8000;  // 8kHz
  const duration = 1;

  // Vowel-like formant signals
  const vowels = {
    'vowel_a': { f1: 730, f2: 1090, f3: 2440 },
    'vowel_e': { f1: 530, f2: 1840, f3: 2480 },
    'vowel_i': { f1: 270, f2: 2290, f3: 3010 },
    'silence':  { f1: 0, f2: 0, f3: 0 }
  };

  for (const [name, formants] of Object.entries(vowels)) {
    const header = ['Time_s', 'Amplitude'];
    const rows = [header];
    const samples = sampleRate * duration;

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      let value = 0;
      if (formants.f1 > 0) {
        // Glottal pulse source (sawtooth-like)
        const f0 = 120 + 10 * Math.sin(2 * Math.PI * 5 * t);  // slight vibrato
        const source = 2 * ((f0 * t) % 1) - 1;
        // Apply formant resonances
        value = source * 0.3;
        value += 0.4 * Math.sin(2 * Math.PI * formants.f1 * t);
        value += 0.2 * Math.sin(2 * Math.PI * formants.f2 * t);
        value += 0.1 * Math.sin(2 * Math.PI * formants.f3 * t);
        // Amplitude envelope
        const env = Math.min(1, Math.min(t / 0.05, (duration - t) / 0.05));
        value *= env;
      }
      value += 0.005 * (Math.random() * 2 - 1);  // background noise
      rows.push([+t.toFixed(6), +value.toFixed(6)]);
    }

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }

  XLSX.writeFile(wb, path.join(dataDir, 'audio_signals.xlsx'));
  console.log('Created audio_signals.xlsx with 4 sheets (vowel_a, vowel_e, vowel_i, silence)');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Vibration Sensor Data (machinery condition monitoring)
// ═══════════════════════════════════════════════════════════════════════════════

function generateVibrationData() {
  const wb = XLSX.utils.book_new();
  const sampleRate = 2048;
  const duration = 2;

  const conditions = {
    'normal': { fundamental: 30, harmonics: 2, noiseLevel: 0.05, imbalance: 0 },
    'imbalance': { fundamental: 30, harmonics: 2, noiseLevel: 0.05, imbalance: 0.6 },
    'misalignment': { fundamental: 30, harmonics: 5, noiseLevel: 0.1, imbalance: 0.2 },
    'bearing_fault': { fundamental: 30, harmonics: 3, noiseLevel: 0.15, imbalance: 0.3 }
  };

  for (const [condition, params] of Object.entries(conditions)) {
    const header = ['Time_s', 'AccelX', 'AccelY'];
    const rows = [header];
    const samples = sampleRate * duration;

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      let valX = 0, valY = 0;

      // Fundamental and harmonics
      for (let h = 1; h <= params.harmonics; h++) {
        const amp = 1.0 / h;
        valX += amp * Math.sin(2 * Math.PI * params.fundamental * h * t + Math.random() * 0.1);
        valY += amp * Math.cos(2 * Math.PI * params.fundamental * h * t + Math.random() * 0.1);
      }

      // Imbalance (1x component boost)
      valX += params.imbalance * Math.sin(2 * Math.PI * params.fundamental * t);

      // Bearing fault: high-frequency impulses
      if (condition === 'bearing_fault') {
        const impactFreq = 4.2 * params.fundamental;  // BPFO
        const impactPhase = (impactFreq * t) % 1;
        if (impactPhase < 0.02) {
          const impulse = 2.0 * Math.exp(-impactPhase * 200);
          valX += impulse * Math.sin(2 * Math.PI * 800 * t);
          valY += impulse * 0.5 * Math.sin(2 * Math.PI * 800 * t);
        }
      }

      valX += params.noiseLevel * (Math.random() * 2 - 1);
      valY += params.noiseLevel * (Math.random() * 2 - 1);

      rows.push([+t.toFixed(6), +valX.toFixed(6), +valY.toFixed(6)]);
    }

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), condition);
  }

  XLSX.writeFile(wb, path.join(dataDir, 'vibration_data.xlsx'));
  console.log('Created vibration_data.xlsx with 4 sheets (normal, imbalance, misalignment, bearing_fault)');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. CSV test files for quick loading
// ═══════════════════════════════════════════════════════════════════════════════

function generateCSVFiles() {
  // Small stock CSV
  let csv = 'Day,Close\n';
  let price = 100;
  for (let i = 0; i < 100; i++) {
    price *= (1 + 0.001 + 0.02 * (Math.random() * 2 - 1));
    csv += `${i + 1},${price.toFixed(2)}\n`;
  }
  fs.writeFileSync(path.join(dataDir, 'stock_simple.csv'), csv);

  // Small EMG CSV (single trial)
  csv = 'Time_ms,EMG_uV\n';
  const emg = generateEMGSignal('flexion', 1000, 1);
  for (let i = 0; i < emg.length; i++) {
    csv += `${i},${(emg[i] * 1000).toFixed(2)}\n`;  // convert to microvolts
  }
  fs.writeFileSync(path.join(dataDir, 'emg_flexion.csv'), csv);

  // Small sine CSV
  csv = 'Time,Value\n';
  for (let i = 0; i < 256; i++) {
    const t = i / 256;
    const v = Math.sin(2 * Math.PI * 10 * t) + 0.5 * Math.sin(2 * Math.PI * 25 * t);
    csv += `${t.toFixed(6)},${v.toFixed(6)}\n`;
  }
  fs.writeFileSync(path.join(dataDir, 'sine_composite.csv'), csv);

  console.log('Created CSV test files: stock_simple.csv, emg_flexion.csv, sine_composite.csv');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Run all generators
// ═══════════════════════════════════════════════════════════════════════════════

console.log('Generating sample data files...\n');
generateStockData();
generateEMGData();
generateAudioData();
generateVibrationData();
generateCSVFiles();
console.log('\nAll sample data files generated in test_data/');
