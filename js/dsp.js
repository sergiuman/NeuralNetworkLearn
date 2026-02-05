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

  // ─── Public API ───────────────────────────────────────────────────────────

  return {
    fft, ifft, dft,
    magnitude, phase, powerSpectrum,
    applyWindow, windowFunction,
    rms, mean, variance, stddev, peak, crestFactor, zeroCrossings, energy,
    segmentSignal,
    extractFFTCoefficients, extractFeatures,
    autocorrelation,
    movingAverage, highPassFilter,
    normalize, standardize,
    nextPow2
  };

})();
