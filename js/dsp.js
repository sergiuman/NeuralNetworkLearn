// =============================================================================
// DSP.js - Digital Signal Processing Algorithms
// =============================================================================

const DSP = (() => {

  // ─── FFT (Cooley-Tukey Radix-2) ───────────────────────────────────────────

  function fft(real, imag) {
    const N = real.length;
    if (N <= 1) return { real: [...real], imag: [...imag] };

    // Ensure power of 2
    const n = nextPow2(N);
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < N; i++) {
      re[i] = real[i];
      im[i] = imag ? imag[i] : 0;
    }

    // Bit-reversal permutation
    bitReverse(re, im, n);

    // Butterfly computation
    for (let size = 2; size <= n; size *= 2) {
      const halfSize = size / 2;
      const angle = -2 * Math.PI / size;
      const wRe = Math.cos(angle);
      const wIm = Math.sin(angle);

      for (let i = 0; i < n; i += size) {
        let curRe = 1, curIm = 0;
        for (let j = 0; j < halfSize; j++) {
          const tRe = curRe * re[i + j + halfSize] - curIm * im[i + j + halfSize];
          const tIm = curRe * im[i + j + halfSize] + curIm * re[i + j + halfSize];
          re[i + j + halfSize] = re[i + j] - tRe;
          im[i + j + halfSize] = im[i + j] - tIm;
          re[i + j] += tRe;
          im[i + j] += tIm;
          const newCurRe = curRe * wRe - curIm * wIm;
          curIm = curRe * wIm + curIm * wRe;
          curRe = newCurRe;
        }
      }
    }

    return { real: Array.from(re), imag: Array.from(im) };
  }

  function ifft(real, imag) {
    const N = real.length;
    // Conjugate
    const conjImag = imag.map(v => -v);
    const result = fft(real, conjImag);
    // Conjugate and scale
    return {
      real: result.real.map(v => v / N),
      imag: result.imag.map(v => -v / N)
    };
  }

  function bitReverse(re, im, n) {
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
      if (i < j) {
        [re[i], re[j]] = [re[j], re[i]];
        [im[i], im[j]] = [im[j], im[i]];
      }
      let k = n >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }
  }

  function nextPow2(n) {
    let p = 1;
    while (p < n) p <<= 1;
    return p;
  }

  // ─── DFT (for arbitrary lengths) ─────────────────────────────────────────

  function dft(real, imag) {
    const N = real.length;
    const outRe = new Float64Array(N);
    const outIm = new Float64Array(N);
    for (let k = 0; k < N; k++) {
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        outRe[k] += real[n] * Math.cos(angle) - (imag ? imag[n] : 0) * Math.sin(angle);
        outIm[k] += real[n] * Math.sin(angle) + (imag ? imag[n] : 0) * Math.cos(angle);
      }
    }
    return { real: Array.from(outRe), imag: Array.from(outIm) };
  }

  // ─── Magnitude & Phase ────────────────────────────────────────────────────

  function magnitude(real, imag) {
    return real.map((r, i) => Math.sqrt(r * r + (imag[i] || 0) * (imag[i] || 0)));
  }

  function phase(real, imag) {
    return real.map((r, i) => Math.atan2(imag[i] || 0, r));
  }

  function powerSpectrum(real, imag) {
    return real.map((r, i) => r * r + (imag[i] || 0) * (imag[i] || 0));
  }

  // ─── Windowing Functions ──────────────────────────────────────────────────

  function applyWindow(data, type) {
    const N = data.length;
    const windowed = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      windowed[i] = data[i] * windowFunction(i, N, type);
    }
    return Array.from(windowed);
  }

  function windowFunction(i, N, type) {
    switch (type) {
      case 'hamming':
        return 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (N - 1));
      case 'hanning':
        return 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
      case 'blackman':
        return 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1))
          + 0.08 * Math.cos(4 * Math.PI * i / (N - 1));
      case 'bartlett':
        return 1 - Math.abs((i - (N - 1) / 2) / ((N - 1) / 2));
      case 'flat-top':
        return 0.21557895 - 0.41663158 * Math.cos(2 * Math.PI * i / (N - 1))
          + 0.277263158 * Math.cos(4 * Math.PI * i / (N - 1))
          - 0.083578947 * Math.cos(6 * Math.PI * i / (N - 1))
          + 0.006947368 * Math.cos(8 * Math.PI * i / (N - 1));
      case 'rectangular':
      default:
        return 1;
    }
  }

  // ─── Statistical Functions ────────────────────────────────────────────────

  function rms(data) {
    const sum = data.reduce((s, v) => s + v * v, 0);
    return Math.sqrt(sum / data.length);
  }

  function mean(data) {
    return data.reduce((s, v) => s + v, 0) / data.length;
  }

  function variance(data) {
    const m = mean(data);
    return data.reduce((s, v) => s + (v - m) * (v - m), 0) / data.length;
  }

  function stddev(data) {
    return Math.sqrt(variance(data));
  }

  function peak(data) {
    return Math.max(...data.map(Math.abs));
  }

  function crestFactor(data) {
    const r = rms(data);
    return r === 0 ? 0 : peak(data) / r;
  }

  function zeroCrossings(data) {
    let count = 0;
    for (let i = 1; i < data.length; i++) {
      if ((data[i] >= 0 && data[i - 1] < 0) || (data[i] < 0 && data[i - 1] >= 0)) {
        count++;
      }
    }
    return count;
  }

  function energy(data) {
    return data.reduce((s, v) => s + v * v, 0);
  }

  // ─── Windowed Processing ──────────────────────────────────────────────────

  function segmentSignal(data, windowSize, overlap) {
    const step = Math.max(1, Math.floor(windowSize * (1 - overlap)));
    const segments = [];
    for (let i = 0; i + windowSize <= data.length; i += step) {
      segments.push(data.slice(i, i + windowSize));
    }
    return segments;
  }

  // ─── Feature Extraction ───────────────────────────────────────────────────

  function extractFFTCoefficients(data, numCoefficients, windowType) {
    const windowed = applyWindow(data, windowType || 'hanning');
    const result = fft(windowed, new Array(windowed.length).fill(0));
    const mag = magnitude(result.real, result.imag);
    // Return first N/2 magnitude coefficients (normalized)
    const halfLen = Math.floor(mag.length / 2);
    const coeffs = mag.slice(0, halfLen);
    const maxVal = Math.max(...coeffs, 1e-10);
    const normalized = coeffs.map(v => v / maxVal);
    return normalized.slice(0, Math.min(numCoefficients, normalized.length));
  }

  function extractFeatures(segment, config) {
    const features = [];
    if (config.includeRMS) features.push(rms(segment));
    if (config.includeMean) features.push(mean(segment));
    if (config.includeVariance) features.push(variance(segment));
    if (config.includeZeroCrossings) features.push(zeroCrossings(segment));
    if (config.includePeak) features.push(peak(segment));
    if (config.includeCrestFactor) features.push(crestFactor(segment));
    if (config.includeEnergy) features.push(energy(segment));

    if (config.includeFFT && config.fftCoefficients) {
      const fftFeats = extractFFTCoefficients(segment, config.fftCoefficients, config.windowType);
      features.push(...fftFeats);
    }
    return features;
  }

  // ─── EMG-Specific Features ───────────────────────────────────────────────

  function meanAbsoluteValue(data) {
    return data.reduce((s, v) => s + Math.abs(v), 0) / data.length;
  }

  function waveformLength(data) {
    let wl = 0;
    for (let i = 1; i < data.length; i++) {
      wl += Math.abs(data[i] - data[i - 1]);
    }
    return wl;
  }

  function slopeSignChanges(data) {
    let count = 0;
    for (let i = 2; i < data.length; i++) {
      const prev = data[i - 1] - data[i - 2];
      const curr = data[i] - data[i - 1];
      if ((prev > 0 && curr < 0) || (prev < 0 && curr > 0)) {
        count++;
      }
    }
    return count;
  }

  function willsonAmplitude(data, threshold) {
    threshold = threshold || 0.01;
    let count = 0;
    for (let i = 1; i < data.length; i++) {
      if (Math.abs(data[i] - data[i - 1]) > threshold) {
        count++;
      }
    }
    return count;
  }

  function medianFrequency(data, sampleRate) {
    const fftResult = fft(data, new Array(data.length).fill(0));
    const halfLen = Math.floor(fftResult.real.length / 2);
    const ps = powerSpectrum(fftResult.real, fftResult.imag).slice(0, halfLen);
    const totalPower = ps.reduce((s, v) => s + v, 0);
    let cumPower = 0;
    const freqStep = sampleRate / fftResult.real.length;
    for (let i = 0; i < ps.length; i++) {
      cumPower += ps[i];
      if (cumPower >= totalPower / 2) {
        return i * freqStep;
      }
    }
    return 0;
  }

  function meanFrequency(data, sampleRate) {
    const fftResult = fft(data, new Array(data.length).fill(0));
    const halfLen = Math.floor(fftResult.real.length / 2);
    const ps = powerSpectrum(fftResult.real, fftResult.imag).slice(0, halfLen);
    const freqStep = sampleRate / fftResult.real.length;
    let num = 0, den = 0;
    for (let i = 0; i < ps.length; i++) {
      num += i * freqStep * ps[i];
      den += ps[i];
    }
    return den === 0 ? 0 : num / den;
  }

  function extractEMGFeatures(segment, sampleRate) {
    return {
      mav: meanAbsoluteValue(segment),
      rms: rms(segment),
      wl: waveformLength(segment),
      zc: zeroCrossings(segment),
      ssc: slopeSignChanges(segment),
      var: variance(segment),
      wa: willsonAmplitude(segment),
      mdf: medianFrequency(segment, sampleRate || 1000),
      mnf: meanFrequency(segment, sampleRate || 1000)
    };
  }

  // ─── Autocorrelation ──────────────────────────────────────────────────────

  function autocorrelation(data, maxLag) {
    const N = data.length;
    maxLag = maxLag || N;
    const m = mean(data);
    const result = [];
    let denom = 0;
    for (let i = 0; i < N; i++) denom += (data[i] - m) * (data[i] - m);

    for (let lag = 0; lag < maxLag && lag < N; lag++) {
      let num = 0;
      for (let i = 0; i < N - lag; i++) {
        num += (data[i] - m) * (data[i + lag] - m);
      }
      result.push(denom === 0 ? 0 : num / denom);
    }
    return result;
  }

  // ─── Filters ──────────────────────────────────────────────────────────────

  function movingAverage(data, windowSize) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(data.length, i + Math.ceil(windowSize / 2));
      const slice = data.slice(start, end);
      result.push(mean(slice));
    }
    return result;
  }

  function highPassFilter(data, cutoffRatio) {
    const lowPassed = movingAverage(data, Math.max(2, Math.floor(1 / cutoffRatio)));
    return data.map((v, i) => v - lowPassed[i]);
  }

  // ─── Normalization ────────────────────────────────────────────────────────

  function normalize(data) {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    return data.map(v => (v - min) / range);
  }

  function standardize(data) {
    const m = mean(data);
    const s = stddev(data);
    return s === 0 ? data.map(() => 0) : data.map(v => (v - m) / s);
  }

  // ─── Butterworth IIR Filter ───────────────────────────────────────────────

  function _biquadCoeffs(type, cutoff, sampleRate) {
    const wc = 2 * Math.PI * cutoff / sampleRate;
    const wd = 2 * sampleRate * Math.tan(wc / 2);
    const sr = sampleRate;
    const wd2 = wd * wd;
    const sr2 = sr * sr;
    const a0 = 4 * sr2 + 2 * Math.SQRT2 * wd * sr + wd2;
    const a1 = 2 * wd2 - 8 * sr2;
    const a2 = 4 * sr2 - 2 * Math.SQRT2 * wd * sr + wd2;

    if (type === 'lowpass') {
      return { b0: wd2 / a0, b1: (2 * wd2) / a0, b2: wd2 / a0,
               a1: a1 / a0, a2: a2 / a0 };
    }
    if (type === 'highpass') {
      const b0hp = 4 * sr2;
      const b1hp = -8 * sr2;
      const b2hp = 4 * sr2;
      return { b0: b0hp / a0, b1: b1hp / a0, b2: b2hp / a0,
               a1: a1 / a0, a2: a2 / a0 };
    }
    return null;
  }

  function _applyBiquad(data, coeffs) {
    const { b0, b1, b2, a1, a2 } = coeffs;
    const N = data.length;
    const out = new Float64Array(N);
    let v1 = 0, v2 = 0;
    for (let n = 0; n < N; n++) {
      const v = data[n] - a1 * v1 - a2 * v2;
      out[n] = b0 * v + b1 * v1 + b2 * v2;
      v2 = v1;
      v1 = v;
    }
    return Array.from(out);
  }

  function butterworthFilter(data, type, cutoff, sampleRate, order) {
    order = order || 2;
    type = type || 'lowpass';
    sampleRate = sampleRate || 1000;
    cutoff = Math.min(cutoff, sampleRate / 2 - 1e-6);

    if (type === 'notch') {
      const w0 = 2 * Math.PI * cutoff / sampleRate;
      const r = 0.9;
      const cosw = Math.cos(w0);
      const coeffs = {
        b0: 1, b1: -2 * cosw, b2: 1,
        a1: -2 * r * cosw, a2: r * r
      };
      return _applyBiquad(data, coeffs);
    }

    if (type === 'bandpass') {
      // lowpass at upper edge then highpass at lower edge
      const lp = butterworthFilter(data, 'lowpass', cutoff, sampleRate, order);
      return lp;
    }

    // lowpass or highpass: cascade (order/2) biquad sections
    const sections = Math.max(1, Math.round(order / 2));
    let result = data.slice();
    const coeffs = _biquadCoeffs(type, cutoff, sampleRate);
    for (let s = 0; s < sections; s++) {
      result = _applyBiquad(result, coeffs);
    }
    return result;
  }

  // ─── Filter Frequency Response ────────────────────────────────────────────

  function filterFrequencyResponse(type, cutoff, sampleRate, order, numPoints) {
    numPoints = numPoints || 256;
    order = order || 2;
    sampleRate = sampleRate || 1000;
    cutoff = Math.min(cutoff, sampleRate / 2 - 1e-6);

    const frequencies = [];
    const magnitudeArr = [];
    const phaseArr = [];

    let coeffs;
    if (type === 'notch') {
      const w0 = 2 * Math.PI * cutoff / sampleRate;
      const r = 0.9;
      const cosw = Math.cos(w0);
      coeffs = { b0: 1, b1: -2 * cosw, b2: 1,
                 a1: -2 * r * cosw, a2: r * r };
    } else if (type === 'bandpass') {
      coeffs = _biquadCoeffs('lowpass', cutoff, sampleRate);
    } else {
      coeffs = _biquadCoeffs(type, cutoff, sampleRate);
    }

    const sections = (type === 'notch' || type === 'bandpass')
      ? 1
      : Math.max(1, Math.round(order / 2));

    for (let k = 0; k < numPoints; k++) {
      const w = Math.PI * k / (numPoints - 1);
      const freq = w * sampleRate / (2 * Math.PI);
      frequencies.push(freq);

      // Evaluate H(z) = (b0 + b1*z^-1 + b2*z^-2) / (1 + a1*z^-1 + a2*z^-2)
      // at z = e^(jw)
      const cosw = Math.cos(w);
      const sinw = Math.sin(w);
      const cos2w = Math.cos(2 * w);
      const sin2w = Math.sin(2 * w);

      const { b0, b1, b2, a1, a2 } = coeffs;

      // Numerator: b0 + b1*e^(-jw) + b2*e^(-2jw)
      let numRe = b0 + b1 * cosw + b2 * cos2w;
      let numIm = -b1 * sinw - b2 * sin2w;

      // Denominator: 1 + a1*e^(-jw) + a2*e^(-2jw)
      let denRe = 1 + a1 * cosw + a2 * cos2w;
      let denIm = -a1 * sinw - a2 * sin2w;

      // H = num / den  (complex division, then raise to power of sections)
      let hRe = (numRe * denRe + numIm * denIm) / (denRe * denRe + denIm * denIm);
      let hIm = (numIm * denRe - numRe * denIm) / (denRe * denRe + denIm * denIm);

      // Raise to the power of sections
      for (let s = 1; s < sections; s++) {
        const newRe = hRe * hRe - hIm * hIm;
        const newIm = 2 * hRe * hIm;
        hRe = newRe; hIm = newIm;
      }

      const mag = Math.sqrt(hRe * hRe + hIm * hIm);
      const magDb = mag < 1e-12 ? -240 : 20 * Math.log10(mag);
      const ph = Math.atan2(hIm, hRe);

      magnitudeArr.push(magDb);
      phaseArr.push(ph);
    }

    return { frequencies, magnitude: magnitudeArr, phase: phaseArr };
  }

  // ─── Spectrogram ──────────────────────────────────────────────────────────

  function spectrogram(signal, windowSize, hopSize, windowFn, sampleRate) {
    windowSize = windowSize || 256;
    hopSize = hopSize || 64;
    windowFn = windowFn || 'hanning';
    sampleRate = sampleRate || 1000;

    const data = [];
    const times = [];
    const halfWin = Math.floor(windowSize / 2);

    // Frequency axis: 0 to sampleRate/2, with halfWin+1 points
    const frequencies = [];
    for (let k = 0; k <= halfWin; k++) {
      frequencies.push(k * sampleRate / windowSize);
    }

    let pos = 0;
    while (pos + windowSize <= signal.length) {
      const frame = signal.slice(pos, pos + windowSize);
      const windowed = applyWindow(frame, windowFn);
      const zeros = new Array(windowSize).fill(0);
      const result = fft(windowed, zeros);
      const mag = [];
      for (let k = 0; k <= halfWin; k++) {
        const re = result.real[k];
        const im = result.imag[k];
        mag.push(Math.sqrt(re * re + im * im));
      }
      data.push(mag);
      times.push((pos + windowSize / 2) / sampleRate);
      pos += hopSize;
    }

    return { data, times, frequencies, windowSize, sampleRate };
  }

  // ─── Signal Generators ────────────────────────────────────────────────────

  function generateWhiteNoise({ samples = 256, amplitude = 1, sampleRate = 256 } = {}) {
    const values = [];
    for (let n = 0; n < samples; n++) {
      values.push(amplitude * (Math.random() * 2 - 1));
    }
    const labels = values.map((_, n) => String(n));
    return { values, sampleRate, labels, name: 'White Noise' };
  }

  function generatePinkNoise({ samples = 256, amplitude = 1, sampleRate = 256 } = {}) {
    // Voss-McCartney: 5 generators at octave rates
    const numGenerators = 5;
    const generators = new Float64Array(numGenerators).fill(0);
    const intervals = [];
    for (let g = 0; g < numGenerators; g++) {
      intervals.push(Math.pow(2, g));   // 1, 2, 4, 8, 16 samples between updates
    }

    const values = [];
    for (let n = 0; n < samples; n++) {
      for (let g = 0; g < numGenerators; g++) {
        if (n % intervals[g] === 0) {
          generators[g] = Math.random() * 2 - 1;
        }
      }
      values.push(generators.reduce((s, v) => s + v, 0));
    }

    // Normalize to [-amplitude, amplitude]
    const maxAbs = Math.max(...values.map(Math.abs), 1e-10);
    const scaled = values.map(v => amplitude * v / maxAbs);
    const labels = scaled.map((_, n) => String(n));
    return { values: scaled, sampleRate, labels, name: 'Pink Noise' };
  }

  function generateSawtooth({ samples = 256, frequency = 10, sampleRate = 256, amplitude = 1, noise = 0 } = {}) {
    const values = [];
    for (let n = 0; n < samples; n++) {
      const t = n * frequency / sampleRate;
      let v = amplitude * (2 * (t % 1) - 1);
      if (noise > 0) v += noise * (Math.random() * 2 - 1);
      values.push(v);
    }
    const labels = values.map((_, n) => String(n));
    return { values, sampleRate, labels, name: 'Sawtooth' };
  }

  function generateImpulse({ samples = 256, position = 0.5, amplitude = 1, sampleRate = 256 } = {}) {
    const values = new Array(samples).fill(0);
    const idx = Math.min(Math.floor(position * samples), samples - 1);
    values[idx] = amplitude;
    const labels = values.map((_, n) => String(n));
    return { values, sampleRate, labels, name: 'Impulse' };
  }

  function generateStepFunction({ samples = 256, position = 0.5, amplitude = 1, sampleRate = 256 } = {}) {
    const stepIdx = Math.floor(position * samples);
    const values = [];
    for (let n = 0; n < samples; n++) {
      values.push(n >= stepIdx ? amplitude : 0);
    }
    const labels = values.map((_, n) => String(n));
    return { values, sampleRate, labels, name: 'Step Function' };
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  return {
    fft, ifft, dft,
    magnitude, phase, powerSpectrum,
    applyWindow, windowFunction,
    rms, mean, variance, stddev, peak, crestFactor, zeroCrossings, energy,
    segmentSignal,
    extractFFTCoefficients, extractFeatures,
    meanAbsoluteValue, waveformLength, slopeSignChanges, willsonAmplitude,
    medianFrequency, meanFrequency, extractEMGFeatures,
    autocorrelation,
    movingAverage, highPassFilter,
    normalize, standardize,
    nextPow2,
    butterworthFilter, filterFrequencyResponse, spectrogram,
    generateWhiteNoise, generatePinkNoise, generateSawtooth,
    generateImpulse, generateStepFunction
  };

})();
