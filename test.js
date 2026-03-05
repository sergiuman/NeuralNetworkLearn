// test.js - Comprehensive test suite for SignalFlow
const fs = require('fs');
const vm = require('vm');

// Browser API stubs
const context = vm.createContext({
  console, Math, Array, Object, String, Number, JSON, Map, Set,
  isNaN, isFinite, parseFloat, parseInt, Infinity, NaN, undefined,
  Error, TypeError, RangeError, Promise, setTimeout, Float64Array,
  document: {
    createElement: () => ({
      style: {}, getContext: () => null,
      classList: { add: () => {} },
      setAttribute: () => {}, addEventListener: () => {},
      appendChild: () => {}, querySelectorAll: () => [],
      innerHTML: '', textContent: '', id: '', className: '',
      remove: () => {}
    }),
    getElementById: () => null,
    addEventListener: () => {},
    createElementNS: () => ({
      setAttribute: () => {}, style: {},
      classList: { add: () => {} },
      addEventListener: () => {}, insertBefore: () => {}
    }),
    querySelectorAll: () => []
  },
  window: { devicePixelRatio: 1, localStorage: { getItem: () => null, setItem: () => {} } },
  XLSX: undefined
});

// Load all source files
const files = [
  'js/dsp.js', 'js/nn.js', 'js/fuzzy.js', 'js/data.js',
  'js/blocks.js', 'js/charts.js', 'js/pipeline.js', 'js/main.js'
];
for (const f of files) {
  vm.runInContext(fs.readFileSync(f, 'utf8'), context, { filename: f });
}
console.log('All modules loaded successfully.\n');

// Test runner
let totalPass = 0, totalFail = 0;

function runTests(name, testFn) {
  const testScript = `(${testFn.toString()})()`;
  try {
    const result = vm.runInContext(testScript, context);
    totalPass += result.pass;
    totalFail += result.fail;
  } catch (e) {
    console.error(`SUITE ERROR [${name}]:`, e.message);
    console.error(e.stack);
    totalFail++;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// DSP TESTS
// ══════════════════════════════════════════════════════════════════════════════
runTests('DSP', function() {
  var pass = 0, fail = 0;
  function assert(cond, msg) {
    if (cond) { pass++; console.log('  PASS: ' + msg); }
    else { fail++; console.error('  FAIL: ' + msg); }
  }
  function approx(a, b, tol, msg) {
    var ok = Math.abs(a - b) < (tol || 0.01);
    assert(ok, msg + ' (got ' + a.toFixed(4) + ', expected ~' + b + ')');
  }

  console.log('=== DSP Tests ===');

  // FFT of pure 10Hz sine at 64 samples, 64Hz sample rate
  var N = 64, sr = 64, signal = [];
  for (var i = 0; i < N; i++) signal.push(Math.sin(2 * Math.PI * 10 * i / sr));

  var fftResult = DSP.fft(signal);
  assert(fftResult.real.length === N, 'FFT output length matches input');
  assert(fftResult.imag.length === N, 'FFT imag output length matches input');

  // Magnitude using correct API: separate real and imag arrays
  var mags = DSP.magnitude(fftResult.real, fftResult.imag);
  assert(mags.length === N, 'Magnitude array length correct');

  // Peak should be at bin 10 (10Hz at 64 sample rate with 64 samples)
  var peakBin = 0, peakVal = 0;
  for (var i = 0; i < N / 2; i++) {
    if (mags[i] > peakVal) { peakVal = mags[i]; peakBin = i; }
  }
  assert(peakBin === 10, 'FFT peak at correct bin for 10Hz (bin=' + peakBin + ')');

  // Phase using correct API
  var phases = DSP.phase(fftResult.real, fftResult.imag);
  assert(phases.length === N, 'Phase array length correct');

  // Power spectrum
  var ps = DSP.powerSpectrum(fftResult.real, fftResult.imag);
  assert(ps.length === N, 'Power spectrum length correct');

  // RMS of unit sine = 1/sqrt(2) ~ 0.707
  approx(DSP.rms(signal), 0.707, 0.02, 'RMS of unit sine');

  // Mean of sine ~ 0
  approx(DSP.mean(signal), 0, 0.01, 'Mean of sine');

  // Windowing functions - windowFunction(i, N, type) returns single value
  // Note: for even-length windows, no integer sample lands exactly at center
  approx(DSP.windowFunction(8, 16, 'hamming'), 1.0, 0.02, 'Hamming window near-center value');
  approx(DSP.windowFunction(0, 16, 'hanning'), 0, 0.01, 'Hanning window start value');
  approx(DSP.windowFunction(8, 16, 'hanning'), 1.0, 0.02, 'Hanning window near-center value');
  approx(DSP.windowFunction(5, 16, 'rectangular'), 1.0, 0.001, 'Rectangular window is always 1');

  // applyWindow
  var testData = [];
  for (var i = 0; i < 16; i++) testData.push(1.0);
  var windowed = DSP.applyWindow(testData, 'hanning');
  assert(windowed.length === 16, 'Apply window preserves length');
  approx(windowed[0], 0, 0.01, 'Windowed signal starts at ~0 (Hanning)');
  approx(windowed[8], 1.0, 0.02, 'Windowed signal near-peak at center');

  // Segmentation
  var testSig = [];
  for (var i = 0; i < 100; i++) testSig.push(i);
  var segs = DSP.segmentSignal(testSig, 32, 0.5);
  assert(segs.length > 1, 'Segmentation produces multiple windows (' + segs.length + ')');
  assert(segs[0].length === 32, 'Segment length correct');

  // Zero crossings
  assert(DSP.zeroCrossings(signal) > 0, 'Zero crossings detected');

  // Energy
  assert(DSP.energy(signal) > 0, 'Energy is positive');

  // Normalize
  var normed = DSP.normalize(signal);
  var minN = Math.min.apply(null, normed);
  var maxN = Math.max.apply(null, normed);
  approx(minN, 0, 0.01, 'Normalized min = 0');
  approx(maxN, 1, 0.01, 'Normalized max = 1');

  // Variance and stddev
  var v = DSP.variance(signal);
  assert(v > 0, 'Variance is positive');
  approx(DSP.stddev(signal), Math.sqrt(v), 0.0001, 'Stddev = sqrt(variance)');

  // Moving average
  var ma = DSP.movingAverage(signal, 5);
  assert(ma.length === signal.length, 'Moving average preserves length');

  // Extract FFT coefficients
  var coeffs = DSP.extractFFTCoefficients(signal, 10);
  assert(coeffs.length === 10, 'FFT coefficient extraction count correct');

  // Autocorrelation
  var ac = DSP.autocorrelation(signal, 20);
  assert(ac.length === 20, 'Autocorrelation output length');
  approx(ac[0], 1.0, 0.01, 'Autocorrelation at lag 0 = 1');

  // DFT (small input)
  var smallSig = [1, 0, -1, 0];
  var dftResult = DSP.dft(smallSig);
  assert(dftResult.real.length === 4, 'DFT output length correct');

  // nextPow2
  assert(DSP.nextPow2(5) === 8, 'nextPow2(5) = 8');
  assert(DSP.nextPow2(8) === 8, 'nextPow2(8) = 8');
  assert(DSP.nextPow2(1) === 1, 'nextPow2(1) = 1');

  console.log('DSP: ' + pass + ' passed, ' + fail + ' failed\n');
  return { pass: pass, fail: fail };
});

// ══════════════════════════════════════════════════════════════════════════════
// NEURAL NETWORK TESTS
// ══════════════════════════════════════════════════════════════════════════════
runTests('NeuralNetwork', function() {
  var pass = 0, fail = 0;
  function assert(cond, msg) {
    if (cond) { pass++; console.log('  PASS: ' + msg); }
    else { fail++; console.error('  FAIL: ' + msg); }
  }
  function approx(a, b, tol, msg) {
    assert(Math.abs(a - b) < (tol || 0.01), msg + ' (got ' + a.toFixed(4) + ', expected ~' + b + ')');
  }

  console.log('=== Neural Network Tests ===');

  // Create network
  var nn = NeuralNetwork.createNetwork({
    inputSize: 2,
    layers: [{ neurons: 4, activation: 'relu' }, { neurons: 2, activation: 'softmax' }]
  });
  assert(nn !== null && nn !== undefined, 'Network created');
  assert(nn.layers.length === 2, 'Correct layer count');
  assert(nn.layers[0].weights.length === 4, 'Hidden layer has 4 neurons');
  assert(nn.layers[0].weights[0].length === 2, 'Hidden layer weights connect to 2 inputs');
  assert(nn.layers[1].weights.length === 2, 'Output layer has 2 neurons');
  assert(nn.layers[1].weights[0].length === 4, 'Output layer weights connect to 4 hidden neurons');

  // Forward pass
  var fwdResult = NeuralNetwork.forward(nn, [1.0, 0.5]);
  assert(fwdResult.output.length === 2, 'Forward pass output size correct');
  assert(!isNaN(fwdResult.output[0]) && !isNaN(fwdResult.output[1]), 'Forward pass produces numeric output');

  // Softmax outputs should sum to ~1
  var sum = fwdResult.output[0] + fwdResult.output[1];
  approx(sum, 1.0, 0.01, 'Softmax outputs sum to 1');

  // predict (shortcut)
  var pred = NeuralNetwork.predict(nn, [1.0, 0.5]);
  assert(pred.length === 2, 'Predict output size correct');

  // classify
  var cls = NeuralNetwork.classify(nn, [1.0, 0.5]);
  assert(typeof cls.classIndex === 'number', 'Classify returns classIndex');
  assert(cls.output.length === 2, 'Classify returns output array');
  assert(typeof cls.confidence === 'number', 'Classify returns confidence');

  // Train on a linearly separable problem
  // Class 0: low values, Class 1: high values
  var trainInputs = [];
  var trainTargets = [];
  for (var i = 0; i < 40; i++) {
    if (i < 20) {
      trainInputs.push([Math.random() * 0.3, Math.random() * 0.3]);
      trainTargets.push([1, 0]);
    } else {
      trainInputs.push([0.7 + Math.random() * 0.3, 0.7 + Math.random() * 0.3]);
      trainTargets.push([0, 1]);
    }
  }

  var nn2 = NeuralNetwork.createNetwork({
    inputSize: 2,
    layers: [{ neurons: 8, activation: 'sigmoid' }, { neurons: 2, activation: 'softmax' }]
  });

  var history = NeuralNetwork.train(nn2, trainInputs, trainTargets, 200, 8);
  assert(history.length === 200, 'Training returns history for all epochs');
  assert(history[history.length - 1].loss < history[0].loss, 'Loss decreased during training (start=' + history[0].loss.toFixed(4) + ', end=' + history[history.length-1].loss.toFixed(4) + ')');

  // Test prediction on clear examples
  var predLow = NeuralNetwork.classify(nn2, [0.1, 0.1]);
  assert(predLow.classIndex === 0, 'Classifies low values as class 0 (got ' + predLow.classIndex + ')');

  var predHigh = NeuralNetwork.classify(nn2, [0.9, 0.9]);
  assert(predHigh.classIndex === 1, 'Classifies high values as class 1 (got ' + predHigh.classIndex + ')');

  // Batch predict
  var batch = NeuralNetwork.predictBatch(nn2, [[0.1,0.1],[0.9,0.9]]);
  assert(batch.length === 2, 'Batch prediction count correct');

  // Serialization
  var serialized = NeuralNetwork.serialize(nn2);
  assert(typeof serialized === 'object' && serialized !== null, 'Serialize returns an object');
  assert(serialized.layers.length === 2, 'Serialized has correct layer count');
  var deserialized = NeuralNetwork.deserialize(serialized);
  assert(deserialized.layers.length === nn2.layers.length, 'Deserialized network has same structure');

  // Verify deserialized produces same output
  var origPred = NeuralNetwork.predict(nn2, [0.5, 0.5]);
  var deserPred = NeuralNetwork.predict(deserialized, [0.5, 0.5]);
  approx(origPred[0], deserPred[0], 0.0001, 'Deserialized network produces same output');

  // Activation names
  assert(Array.isArray(NeuralNetwork.activations), 'Activations list is an array');
  assert(NeuralNetwork.activations.indexOf('relu') >= 0, 'Activations includes relu');
  assert(NeuralNetwork.activations.indexOf('sigmoid') >= 0, 'Activations includes sigmoid');
  assert(NeuralNetwork.activations.indexOf('softmax') >= 0, 'Activations includes softmax');

  // Softmax utility
  var sm = NeuralNetwork.softmax([1, 2, 3]);
  assert(sm.length === 3, 'Softmax output length correct');
  var smSum = sm[0] + sm[1] + sm[2];
  approx(smSum, 1.0, 0.001, 'Softmax sums to 1');
  assert(sm[2] > sm[1] && sm[1] > sm[0], 'Softmax preserves order');

  console.log('NeuralNetwork: ' + pass + ' passed, ' + fail + ' failed\n');
  return { pass: pass, fail: fail };
});

// ══════════════════════════════════════════════════════════════════════════════
// FUZZY LOGIC TESTS
// ══════════════════════════════════════════════════════════════════════════════
runTests('FuzzyLogic', function() {
  var pass = 0, fail = 0;
  function assert(cond, msg) {
    if (cond) { pass++; console.log('  PASS: ' + msg); }
    else { fail++; console.error('  FAIL: ' + msg); }
  }
  function approx(a, b, tol, msg) {
    assert(Math.abs(a - b) < (tol || 0.01), msg + ' (got ' + a.toFixed(4) + ', expected ~' + b + ')');
  }

  console.log('=== Fuzzy Logic Tests ===');

  // Membership functions are direct evaluators: fn(x, params...)
  approx(FuzzyLogic.membershipFunctions.triangular(5, 0, 5, 10), 1.0, 0.001, 'Triangular peak');
  approx(FuzzyLogic.membershipFunctions.triangular(0, 0, 5, 10), 0.0, 0.001, 'Triangular left edge');
  approx(FuzzyLogic.membershipFunctions.triangular(10, 0, 5, 10), 0.0, 0.001, 'Triangular right edge');
  approx(FuzzyLogic.membershipFunctions.triangular(2.5, 0, 5, 10), 0.5, 0.001, 'Triangular midpoint left');
  approx(FuzzyLogic.membershipFunctions.triangular(7.5, 0, 5, 10), 0.5, 0.001, 'Triangular midpoint right');

  approx(FuzzyLogic.membershipFunctions.trapezoidal(5, 0, 3, 7, 10), 1.0, 0.001, 'Trapezoidal plateau');
  approx(FuzzyLogic.membershipFunctions.trapezoidal(0, 0, 3, 7, 10), 0.0, 0.001, 'Trapezoidal left edge');
  approx(FuzzyLogic.membershipFunctions.trapezoidal(1.5, 0, 3, 7, 10), 0.5, 0.001, 'Trapezoidal left ramp');

  approx(FuzzyLogic.membershipFunctions.gaussian(5, 5, 2), 1.0, 0.001, 'Gaussian center');
  assert(FuzzyLogic.membershipFunctions.gaussian(3, 5, 2) < 1.0, 'Gaussian off-center < 1');
  assert(FuzzyLogic.membershipFunctions.gaussian(3, 5, 2) > 0, 'Gaussian off-center > 0');

  approx(FuzzyLogic.membershipFunctions.leftShoulder(-10, 0, 1), 1.0, 0.001, 'LeftShoulder below a = 1');
  approx(FuzzyLogic.membershipFunctions.leftShoulder(2, 0, 1), 0.0, 0.001, 'LeftShoulder above b = 0');
  approx(FuzzyLogic.membershipFunctions.leftShoulder(0.5, 0, 1), 0.5, 0.001, 'LeftShoulder midpoint');

  approx(FuzzyLogic.membershipFunctions.rightShoulder(2, 0, 1), 1.0, 0.001, 'RightShoulder above b = 1');
  approx(FuzzyLogic.membershipFunctions.rightShoulder(-1, 0, 1), 0.0, 0.001, 'RightShoulder below a = 0');

  // Fuzzy sets (using createFuzzySet with type and params)
  var cold = FuzzyLogic.createFuzzySet('cold', 'trapezoidal', [-10, -5, 5, 15]);
  assert(cold !== null, 'Fuzzy set created');
  approx(cold.evaluate(0), 1.0, 0.001, 'Cold set at 0 = 1');
  assert(cold.evaluate(20) === 0, 'Cold set at 20 = 0');

  var warm = FuzzyLogic.createFuzzySet('warm', 'triangular', [10, 20, 30]);
  approx(warm.evaluate(20), 1.0, 0.001, 'Warm set at 20 = 1');
  approx(warm.evaluate(15), 0.5, 0.001, 'Warm set at 15 = 0.5');

  // Fuzzy variable
  var temp = FuzzyLogic.createFuzzyVariable('temperature', [-10, 50], [cold, warm]);
  assert(temp.sets.length === 2, 'Fuzzy variable has 2 sets');
  var fuzzified = temp.fuzzify(12);
  assert(typeof fuzzified.cold === 'number', 'Fuzzified has cold membership');
  assert(typeof fuzzified.warm === 'number', 'Fuzzified has warm membership');

  // Fuzzy AND/OR/NOT - these take arrays
  approx(FuzzyLogic.fuzzyAnd([0.3, 0.7]), 0.3, 0.001, 'Fuzzy AND (min)');
  approx(FuzzyLogic.fuzzyOr([0.3, 0.7]), 0.7, 0.001, 'Fuzzy OR (max)');
  approx(FuzzyLogic.fuzzyNot(0.3), 0.7, 0.001, 'Fuzzy NOT');

  // Threshold classifier
  var classifier = FuzzyLogic.createThresholdClassifier({
    inputName: 'input',
    outputName: 'class',
    classes: ['Low', 'Medium', 'High'],
    thresholds: [0.33, 0.66]
  });
  assert(classifier !== null, 'Threshold classifier (FIS) created');
  assert(classifier.inputVariables.length === 1, 'FIS has 1 input variable');
  assert(classifier.outputVariables.length === 1, 'FIS has 1 output variable');
  assert(classifier.rules.length === 3, 'FIS has 3 rules');

  // Classify using the FIS
  var result1 = FuzzyLogic.classifyWithLabels(classifier, { input: 0.1 });
  assert(result1['class'] !== undefined, 'Classification produces result for "class" output');
  assert(result1['class'].label === 'Low', 'Classifies 0.1 as Low (got ' + result1['class'].label + ')');

  var result2 = FuzzyLogic.classifyWithLabels(classifier, { input: 0.5 });
  assert(result2['class'].label === 'Medium', 'Classifies 0.5 as Medium (got ' + result2['class'].label + ')');

  var result3 = FuzzyLogic.classifyWithLabels(classifier, { input: 0.9 });
  assert(result3['class'].label === 'High', 'Classifies 0.9 as High (got ' + result3['class'].label + ')');

  // Membership types list
  assert(FuzzyLogic.membershipTypes.length >= 5, 'Has ' + FuzzyLogic.membershipTypes.length + ' membership types');
  assert(FuzzyLogic.membershipTypes.indexOf('triangular') >= 0, 'Includes triangular');
  assert(FuzzyLogic.membershipTypes.indexOf('gaussian') >= 0, 'Includes gaussian');

  // Multi-input classifier
  var multiClass = FuzzyLogic.createMultiInputClassifier({
    inputs: [
      { name: 'temp', range: [0, 100], sets: [
        { name: 'cold', type: 'leftShoulder', params: [20, 40] },
        { name: 'hot', type: 'rightShoulder', params: [60, 80] }
      ]}
    ],
    outputs: [
      { name: 'action', range: [0, 1], sets: [
        { name: 'heat', type: 'triangular', params: [0, 0.25, 0.5] },
        { name: 'cool', type: 'triangular', params: [0.5, 0.75, 1] }
      ]}
    ],
    rules: [
      { conditions: [{ variable: 'temp', set: 'cold' }], output: { variable: 'action', set: 'heat' } },
      { conditions: [{ variable: 'temp', set: 'hot' }], output: { variable: 'action', set: 'cool' } }
    ]
  });
  assert(multiClass.inputVariables.length === 1, 'Multi-input classifier has 1 input');
  assert(multiClass.rules.length === 2, 'Multi-input classifier has 2 rules');

  var evalResult = FuzzyLogic.evaluate(multiClass, { temp: 10 });
  assert(evalResult.action !== undefined, 'Multi-input evaluation returns action');

  console.log('FuzzyLogic: ' + pass + ' passed, ' + fail + ' failed\n');
  return { pass: pass, fail: fail };
});

// ══════════════════════════════════════════════════════════════════════════════
// DATA I/O TESTS
// ══════════════════════════════════════════════════════════════════════════════
runTests('DataIO', function() {
  var pass = 0, fail = 0;
  function assert(cond, msg) {
    if (cond) { pass++; console.log('  PASS: ' + msg); }
    else { fail++; console.error('  FAIL: ' + msg); }
  }

  console.log('=== Data I/O Tests ===');

  // CSV parsing
  var csv = 'time,value,label\n0,1.5,A\n1,2.3,B\n2,3.1,A\n3,4.0,B';
  var parsed = DataIO.parseCSV(csv);
  assert(parsed.headers.length === 3, 'CSV headers parsed (' + parsed.headers.join(', ') + ')');
  assert(parsed.headers[0] === 'time', 'First header is "time"');
  assert(parsed.headers[1] === 'value', 'Second header is "value"');
  assert(parsed.columns['value'].length === 4, 'Column has 4 values');
  assert(parsed.columns['value'][1] === 2.3, 'Numeric value parsed correctly');

  // CSV with quotes
  var csvQ = 'name,val\n"hello, world",42\n"foo""bar",99';
  var parsedQ = DataIO.parseCSV(csvQ);
  assert(parsedQ.columns['name'][0] === 'hello, world', 'Quoted field with comma');

  // Column utilities
  var numCols = DataIO.getNumericColumns(parsed);
  assert(numCols.length === 2, 'Found 2 numeric columns (got ' + numCols.join(', ') + ')');

  var colArr = DataIO.columnToArray(parsed, 'value');
  assert(colArr.length === 4, 'columnToArray returns 4 values');
  assert(colArr[0] === 1.5, 'columnToArray first value correct');

  // CSV generation
  var csvOut = DataIO.toCSV(['a', 'b'], [[1, 2], [3, 4]]);
  assert(csvOut.indexOf('a,b') >= 0, 'CSV generation includes headers');
  assert(csvOut.indexOf('1,2') >= 0, 'CSV generation includes data');

  // Sample data generators
  var generators = ['sineWave', 'multiSine', 'chirp', 'squareWave', 'stockMarket', 'ecg', 'eeg', 'vibration', 'randomWalk'];
  for (var g = 0; g < generators.length; g++) {
    var name = generators[g];
    try {
      var data = DataIO.generators[name]();
      assert(data.values && data.values.length > 0, 'Generator ' + name + ': produces ' + data.values.length + ' samples');
      assert(!isNaN(data.values[0]), 'Generator ' + name + ': numeric values');
      assert(data.sampleRate > 0, 'Generator ' + name + ': has sample rate');
    } catch(e) {
      assert(false, 'Generator ' + name + ' threw: ' + e.message);
    }
  }

  // Classification demo generator
  var demo = DataIO.generators.classificationDemo();
  assert(demo.windows && demo.windows.length > 0, 'Classification demo produces ' + demo.windows.length + ' windows');
  assert(demo.labels.length === demo.windows.length, 'Labels match window count');
  assert(demo.classNames.length === 2, 'Has 2 class names');

  // Specific generator configs
  var ecg = DataIO.generators.ecg({ samples: 360, sampleRate: 360, heartRate: 60 });
  assert(ecg.values.length === 360, 'ECG with custom config: 360 samples');

  var stock = DataIO.generators.stockMarket({ samples: 100, startPrice: 50 });
  assert(stock.values.length === 100, 'Stock with custom config: 100 samples');
  assert(stock.values[0] === 50, 'Stock starts at configured price');

  console.log('DataIO: ' + pass + ' passed, ' + fail + ' failed\n');
  return { pass: pass, fail: fail };
});

// ══════════════════════════════════════════════════════════════════════════════
// BLOCK REGISTRY TESTS
// ══════════════════════════════════════════════════════════════════════════════
runTests('BlockRegistry', function() {
  var pass = 0, fail = 0;
  function assert(cond, msg) {
    if (cond) { pass++; console.log('  PASS: ' + msg); }
    else { fail++; console.error('  FAIL: ' + msg); }
  }

  console.log('=== Block Registry Tests ===');

  var expectedTypes = ['dataSource', 'windowing', 'fftBlock', 'statistics', 'featureMerger', 'neuralNetwork', 'fuzzyClassifier', 'output',
                       'filter', 'spectrogramBlock', 'rectifier', 'envelope', 'noiseAdder', 'knnClassifier', 'liveDataSource'];

  for (var i = 0; i < expectedTypes.length; i++) {
    var typeName = expectedTypes[i];
    var bt = BlockRegistry.getBlockType(typeName);
    assert(bt !== null && bt !== undefined, 'Block type exists: ' + typeName);
    if (bt) {
      assert(bt.name && bt.name.length > 0, '  has name: ' + bt.name);
      assert(bt.category && bt.category.length > 0, '  has category: ' + bt.category);
      assert(Array.isArray(bt.inputs), '  has inputs array (' + bt.inputs.length + ')');
      assert(Array.isArray(bt.outputs), '  has outputs array (' + bt.outputs.length + ')');
      assert(typeof bt.process === 'function', '  has process function');
      assert(bt.defaultConfig !== undefined, '  has defaultConfig');
      assert(bt.icon !== undefined, '  has icon');
      assert(bt.color !== undefined, '  has color');
    }
  }

  // Categories
  var cats = BlockRegistry.getCategories();
  assert(cats.length >= 4, 'Has ' + cats.length + ' categories');

  // getByCategory
  var inputBlocks = BlockRegistry.getByCategory('input');
  assert(inputBlocks.length >= 1, 'Input category has ' + inputBlocks.length + ' block(s)');

  var transformBlocks = BlockRegistry.getByCategory('transform');
  assert(transformBlocks.length >= 2, 'Transform category has ' + transformBlocks.length + ' block(s)');

  // Create block instance
  var instance = BlockRegistry.createBlockInstance('dataSource', 100, 200);
  assert(instance.id && instance.id.length > 0, 'Instance has ID: ' + instance.id);
  assert(instance.type === 'dataSource', 'Instance type correct');
  assert(instance.x === 100, 'Instance x correct');
  assert(instance.y === 200, 'Instance y correct');
  assert(instance.config !== undefined, 'Instance has config');
  assert(instance._def !== undefined, 'Instance has _def reference');

  // getAllTypes
  var allTypes = BlockRegistry.getAllTypes();
  assert(allTypes.length === expectedTypes.length, 'getAllTypes returns ' + allTypes.length + ' types');

  console.log('BlockRegistry: ' + pass + ' passed, ' + fail + ' failed\n');
  return { pass: pass, fail: fail };
});

// ══════════════════════════════════════════════════════════════════════════════
// BLOCK PROCESSING TESTS
// ══════════════════════════════════════════════════════════════════════════════
runTests('BlockProcessing', function() {
  var pass = 0, fail = 0;
  function assert(cond, msg) {
    if (cond) { pass++; console.log('  PASS: ' + msg); }
    else { fail++; console.error('  FAIL: ' + msg); }
  }

  console.log('=== Block Processing Tests ===');

  // 1. Data Source - generate sine
  var dsDef = BlockRegistry.getBlockType('dataSource');
  var dsResult;
  try {
    dsResult = dsDef.process({
      source: 'generate', generator: 'sineWave', sampleRate: 256,
      generatorConfig: { samples: 256, frequency: 10, sampleRate: 256, amplitude: 1, noise: 0 }
    }, {});
    assert(dsResult.signal !== undefined, 'DataSource returns signal');
    assert(dsResult.signal.values.length === 256, 'DataSource generates 256 samples');
    assert(dsResult.signal.sampleRate === 256, 'DataSource correct sample rate');
  } catch(e) {
    assert(false, 'DataSource threw: ' + e.message);
  }

  // 1b. Data Source - CSV text
  var csvText = 'time,value\n';
  for (var i = 0; i < 64; i++) csvText += i + ',' + Math.sin(2 * Math.PI * 5 * i / 64) + '\n';
  try {
    var csvResult = dsDef.process({
      source: 'csv', csvData: csvText, csvColumn: 'value', sampleRate: 64
    }, {});
    assert(csvResult.signal.values.length === 64, 'DataSource CSV text: 64 values parsed');
  } catch(e) {
    assert(false, 'DataSource CSV text threw: ' + e.message);
  }

  // 1c. Data Source - manual data
  try {
    var manualResult = dsDef.process({
      source: 'manual', manualData: '1, 2, 3, 4, 5', sampleRate: 1
    }, {});
    assert(manualResult.signal.values.length === 5, 'DataSource manual: 5 values');
    assert(manualResult.signal.values[2] === 3, 'DataSource manual: correct value');
  } catch(e) {
    assert(false, 'DataSource manual threw: ' + e.message);
  }

  // 2. Windowing
  var winDef = BlockRegistry.getBlockType('windowing');
  var winResult;
  try {
    winResult = winDef.process(
      { windowSize: 32, overlap: 0.5, windowFunction: 'hanning', applyWindow: true },
      { signal: dsResult.signal }
    );
    assert(winResult.segments !== undefined, 'Windowing returns segments');
    assert(winResult.segments.windows.length > 0, 'Windowing produces ' + winResult.segments.windows.length + ' windows');
    assert(winResult.segments.windows[0].length === 32, 'Window size correct');
    assert(winResult.segments.sampleRate === 256, 'Preserves sample rate');
  } catch(e) {
    assert(false, 'Windowing threw: ' + e.message);
  }

  // 3. FFT - single signal
  var fftDef = BlockRegistry.getBlockType('fftBlock');
  try {
    var fftResult1 = fftDef.process(
      { numCoefficients: 10, windowFunction: 'rectangular', outputType: 'magnitude', normalize: true },
      { signal: dsResult.signal }
    );
    assert(fftResult1.spectrum !== undefined, 'FFT produces spectrum from signal');
    assert(fftResult1.spectrum.values.length > 0, 'Spectrum has values');
    assert(fftResult1.features !== undefined, 'FFT produces features');
    assert(fftResult1.features.vectors[0].length === 10, 'Feature vector has 10 coefficients');
  } catch(e) {
    assert(false, 'FFT (signal) threw: ' + e.message);
  }

  // 3b. FFT - segmented data
  try {
    var fftResult2 = fftDef.process(
      { numCoefficients: 8, outputType: 'magnitude', normalize: true },
      { segments: winResult.segments }
    );
    assert(fftResult2.features !== undefined, 'FFT produces features from segments');
    assert(fftResult2.features.vectors.length === winResult.segments.windows.length,
      'FFT features count matches window count');
    assert(fftResult2.features.vectors[0].length === 8, 'Feature vector has 8 coefficients');
  } catch(e) {
    assert(false, 'FFT (segments) threw: ' + e.message);
  }

  // 4. Statistics - single signal
  var statDef = BlockRegistry.getBlockType('statistics');
  try {
    var statResult1 = statDef.process(
      { includeRMS: true, includeMean: true, includeVariance: true, includeStdDev: true,
        includePeak: true, includeCrestFactor: true, includeZeroCrossings: true, includeEnergy: true },
      { signal: dsResult.signal }
    );
    assert(statResult1.stats !== undefined, 'Statistics returns stats');
    assert(statResult1.stats.values.RMS !== undefined, 'Stats includes RMS');
    assert(statResult1.stats.values.Mean !== undefined, 'Stats includes Mean');
    assert(statResult1.features.vectors.length === 1, 'Stats features has 1 row for single signal');
    assert(statResult1.features.vectors[0].length === 8, 'Stats features has 8 values (all stats enabled)');
  } catch(e) {
    assert(false, 'Statistics (signal) threw: ' + e.message);
  }

  // 4b. Statistics - segmented
  try {
    var statResult2 = statDef.process(
      { includeRMS: true, includeMean: true, includeVariance: true, includeStdDev: false,
        includePeak: true, includeCrestFactor: false, includeZeroCrossings: true, includeEnergy: false },
      { segments: winResult.segments }
    );
    assert(statResult2.features.vectors.length === winResult.segments.windows.length,
      'Stats features count matches window count');
  } catch(e) {
    assert(false, 'Statistics (segments) threw: ' + e.message);
  }

  // 5. Feature Merger
  var mergerDef = BlockRegistry.getBlockType('featureMerger');
  try {
    var fftFeats = fftResult2.features;
    var statFeats = statResult2.features;
    var merged = mergerDef.process({}, { features1: fftFeats, features2: statFeats });
    assert(merged.features !== undefined, 'Merger returns features');
    var expectedLen = fftFeats.vectors[0].length + statFeats.vectors[0].length;
    assert(merged.features.vectors[0].length === expectedLen,
      'Merged vector length = ' + merged.features.vectors[0].length + ' (expected ' + expectedLen + ')');
    assert(merged.features.vectors.length === Math.min(fftFeats.vectors.length, statFeats.vectors.length),
      'Merged row count = min of inputs');
  } catch(e) {
    assert(false, 'Feature Merger threw: ' + e.message);
  }

  // 6. Neural Network
  var nnDef = BlockRegistry.getBlockType('neuralNetwork');
  try {
    var featureVectors = [];
    var labels = [];
    for (var i = 0; i < 20; i++) {
      featureVectors.push([Math.random(), Math.random(), Math.random()]);
      labels.push(i % 2);
    }
    var nnResult = nnDef.process(
      {
        hiddenLayers: [{ neurons: 4, activation: 'relu' }],
        outputNeurons: 2, outputActivation: 'softmax',
        learningRate: 0.01, epochs: 10, batchSize: 4,
        classNames: 'A,B', trainMode: 'auto'
      },
      { features: { vectors: featureVectors, labels: labels, featureNames: ['f1', 'f2', 'f3'] } }
    );
    assert(nnResult.predictions !== undefined, 'NN returns predictions');
    assert(nnResult.predictions.items.length === 20, 'NN predicts all 20 inputs');
    assert(nnResult.predictions.items[0].className !== undefined, 'Prediction has className');
    assert(nnResult.predictions.items[0].confidence !== undefined, 'Prediction has confidence');
    assert(nnResult.features !== undefined, 'NN also outputs features');
  } catch(e) {
    assert(false, 'Neural Network threw: ' + e.message);
  }

  // 7. Fuzzy Classifier
  var fuzzyDef = BlockRegistry.getBlockType('fuzzyClassifier');
  try {
    var fuzzyFeatures = [];
    for (var i = 0; i < 10; i++) fuzzyFeatures.push([Math.random()]);
    var fuzzyResult = fuzzyDef.process(
      { mode: 'threshold', classes: 'Low,Medium,High', thresholds: '0.33,0.66', inputFeatureIndex: 0 },
      { features: { vectors: fuzzyFeatures, featureNames: ['val'] } }
    );
    assert(fuzzyResult.classification !== undefined, 'Fuzzy returns classification');
    assert(fuzzyResult.classification.items.length === 10, 'Fuzzy classifies all 10 inputs');
    assert(fuzzyResult.classification.classes.length === 3, 'Has 3 classes');
    assert(typeof fuzzyResult.classification.items[0].label === 'string', 'Items have string labels');
    assert(typeof fuzzyResult.classification.items[0].confidence === 'number', 'Items have confidence');
    assert(fuzzyResult.classification.summary !== undefined, 'Has summary');
  } catch(e) {
    assert(false, 'Fuzzy Classifier threw: ' + e.message);
  }

  // 8. Output block
  var outputDef = BlockRegistry.getBlockType('output');
  try {
    var outputResult = outputDef.process(
      { title: 'Test Output', chartType: 'auto' },
      { signal: dsResult.signal }
    );
    assert(outputResult._display !== undefined, 'Output returns _display');
    assert(outputResult._display.inputs.signal !== undefined, 'Output passes through signal');
  } catch(e) {
    assert(false, 'Output block threw: ' + e.message);
  }

  console.log('BlockProcessing: ' + pass + ' passed, ' + fail + ' failed\n');
  return { pass: pass, fail: fail };
});

// ══════════════════════════════════════════════════════════════════════════════
// END-TO-END PIPELINE TESTS
// ══════════════════════════════════════════════════════════════════════════════
runTests('EndToEnd', function() {
  var pass = 0, fail = 0;
  function assert(cond, msg) {
    if (cond) { pass++; console.log('  PASS: ' + msg); }
    else { fail++; console.error('  FAIL: ' + msg); }
  }

  console.log('=== End-to-End Pipeline Tests ===');

  var dsDef = BlockRegistry.getBlockType('dataSource');
  var winDef = BlockRegistry.getBlockType('windowing');
  var fftDef = BlockRegistry.getBlockType('fftBlock');
  var statDef = BlockRegistry.getBlockType('statistics');
  var mergerDef = BlockRegistry.getBlockType('featureMerger');
  var nnDef = BlockRegistry.getBlockType('neuralNetwork');
  var fuzzyDef = BlockRegistry.getBlockType('fuzzyClassifier');

  // ── Pipeline 1: ECG -> Window -> FFT + Stats -> Merger -> NN -> Fuzzy ──

  console.log('  --- Pipeline 1: Full Classification ---');
  try {
    var dsResult = dsDef.process({
      source: 'generate', generator: 'ecg', sampleRate: 360,
      generatorConfig: { samples: 720, sampleRate: 360, heartRate: 72, noise: 0.02 }
    }, {});
    assert(dsResult.signal.values.length === 720, 'P1: Generated 720 ECG samples');

    var winResult = winDef.process(
      { windowSize: 64, overlap: 0.5, windowFunction: 'hanning', applyWindow: true },
      { signal: dsResult.signal }
    );
    assert(winResult.segments.windows.length > 0, 'P1: ' + winResult.segments.windows.length + ' windows');

    var fftResult = fftDef.process(
      { numCoefficients: 8, outputType: 'magnitude', normalize: true },
      { segments: winResult.segments }
    );
    assert(fftResult.features.vectors.length > 0, 'P1: FFT features extracted');

    var statResult = statDef.process(
      { includeRMS: true, includeMean: true, includeVariance: true, includeStdDev: false,
        includePeak: true, includeCrestFactor: false, includeZeroCrossings: true, includeEnergy: false },
      { segments: winResult.segments }
    );
    assert(statResult.features.vectors.length > 0, 'P1: Stats features computed');

    var mergedResult = mergerDef.process({}, { features1: fftResult.features, features2: statResult.features });
    assert(mergedResult.features.vectors.length > 0, 'P1: Features merged');
    var totalFeatures = fftResult.features.vectors[0].length + statResult.features.vectors[0].length;
    assert(mergedResult.features.vectors[0].length === totalFeatures, 'P1: Merged feature length correct');

    var nnResult = nnDef.process({
      hiddenLayers: [{ neurons: 8, activation: 'relu' }],
      outputNeurons: 3, outputActivation: 'softmax',
      learningRate: 0.01, epochs: 20, batchSize: 4,
      classNames: 'Normal,Abnormal,Artifact'
    }, { features: mergedResult.features });
    assert(nnResult.predictions.items.length > 0, 'P1: NN predictions made');

    var fuzzyResult = fuzzyDef.process(
      { mode: 'threshold', classes: 'Healthy,Warning,Critical', thresholds: '0.33,0.66', inputFeatureIndex: 0 },
      { features: nnResult.features }
    );
    assert(fuzzyResult.classification.items.length > 0, 'P1: Fuzzy classification complete');

    var classNames = {};
    for (var i = 0; i < fuzzyResult.classification.items.length; i++) {
      classNames[fuzzyResult.classification.items[i].label] = true;
    }
    assert(Object.keys(classNames).length >= 1, 'P1: Classes assigned: ' + Object.keys(classNames).join(', '));
    console.log('  Pipeline 1 complete!');
  } catch(e) {
    assert(false, 'Pipeline 1 threw: ' + e.message);
  }

  // ── Pipeline 2: CSV -> FFT -> Spectrum ──

  console.log('  --- Pipeline 2: CSV Input ---');
  try {
    var csvData = 'time,value\n';
    for (var i = 0; i < 128; i++) {
      csvData += i + ',' + Math.sin(2 * Math.PI * 5 * i / 128) + '\n';
    }

    var dsResult2 = dsDef.process({
      source: 'csv', csvData: csvData, csvColumn: 'value', sampleRate: 128
    }, {});
    assert(dsResult2.signal.values.length === 128, 'P2: Parsed 128 CSV values');

    var fftResult2 = fftDef.process(
      { numCoefficients: 16, outputType: 'magnitude', normalize: false },
      { signal: dsResult2.signal }
    );
    assert(fftResult2.spectrum !== undefined, 'P2: FFT spectrum computed');
    assert(fftResult2.spectrum.values.length > 0, 'P2: Spectrum has values');
    console.log('  Pipeline 2 complete!');
  } catch(e) {
    assert(false, 'Pipeline 2 threw: ' + e.message);
  }

  // ── Pipeline 3: Stock -> Window -> Stats -> Fuzzy ──

  console.log('  --- Pipeline 3: Stock Analysis ---');
  try {
    var dsResult3 = dsDef.process({
      source: 'generate', generator: 'stockMarket', sampleRate: 1,
      generatorConfig: { samples: 200, startPrice: 100, volatility: 0.02, trend: 'mixed' }
    }, {});
    assert(dsResult3.signal.values.length === 200, 'P3: Generated 200 stock prices');

    var winResult3 = winDef.process(
      { windowSize: 20, overlap: 0.5, windowFunction: 'rectangular', applyWindow: false },
      { signal: dsResult3.signal }
    );
    assert(winResult3.segments.windows.length > 0, 'P3: ' + winResult3.segments.windows.length + ' windows');

    var statResult3 = statDef.process(
      { includeRMS: true, includeMean: true, includeVariance: true, includeStdDev: true,
        includePeak: false, includeCrestFactor: false, includeZeroCrossings: false, includeEnergy: false },
      { segments: winResult3.segments }
    );
    assert(statResult3.features.vectors.length > 0, 'P3: Stats computed');

    var fuzzyResult3 = fuzzyDef.process(
      { mode: 'threshold', classes: 'Buy,Hold,Sell', thresholds: '0.33,0.66', inputFeatureIndex: 2 },
      { features: statResult3.features }
    );
    assert(fuzzyResult3.classification.items.length > 0, 'P3: Trading signals generated');
    console.log('  Pipeline 3 complete!');
  } catch(e) {
    assert(false, 'Pipeline 3 threw: ' + e.message);
  }

  // ── Pipeline 4: Multi-sine -> FFT -> Power Spectrum ──

  console.log('  --- Pipeline 4: Power Spectrum ---');
  try {
    var dsResult4 = dsDef.process({
      source: 'generate', generator: 'multiSine', sampleRate: 256,
      generatorConfig: { samples: 256, frequencies: [10, 30, 60], amplitudes: [1, 0.5, 0.3], sampleRate: 256, noise: 0.05 }
    }, {});
    assert(dsResult4.signal.values.length === 256, 'P4: Generated 256 samples');

    var fftResult4 = fftDef.process(
      { numCoefficients: 20, outputType: 'power', normalize: false, logScale: true },
      { signal: dsResult4.signal }
    );
    assert(fftResult4.spectrum !== undefined, 'P4: Power spectrum computed');
    assert(fftResult4.spectrum.type === 'power', 'P4: Spectrum type is power');
    console.log('  Pipeline 4 complete!');
  } catch(e) {
    assert(false, 'Pipeline 4 threw: ' + e.message);
  }

  console.log('EndToEnd: ' + pass + ' passed, ' + fail + ' failed\n');
  return { pass: pass, fail: fail };
});

// ══════════════════════════════════════════════════════════════════════════════
// EMG GENERATOR & DSP FEATURE TESTS
// ══════════════════════════════════════════════════════════════════════════════
runTests('EMG_Features', function() {
  var pass = 0, fail = 0;
  function assert(cond, msg) {
    if (cond) { pass++; console.log('  PASS: ' + msg); }
    else { fail++; console.error('  FAIL: ' + msg); }
  }
  function approx(a, b, tol, msg) {
    assert(Math.abs(a - b) < (tol || 0.01), msg + ' (got ' + a.toFixed(4) + ', expected ~' + b + ')');
  }

  console.log('=== EMG Generator & Feature Tests ===');

  // EMG generator - all movements
  var movements = ['pronation', 'supination', 'flexion', 'extension', 'rest'];
  for (var m = 0; m < movements.length; m++) {
    var emg = DataIO.generators.emg({ samples: 1024, sampleRate: 1000, movement: movements[m] });
    assert(emg.values.length === 1024, 'EMG ' + movements[m] + ': produces 1024 samples');
    assert(emg.sampleRate === 1000, 'EMG ' + movements[m] + ': correct sample rate');
    assert(!isNaN(emg.values[0]), 'EMG ' + movements[m] + ': numeric output');
  }

  // Active EMG should have higher RMS than rest
  var emgFlex = DataIO.generators.emg({ samples: 2048, sampleRate: 1000, movement: 'flexion', noise: 0.01 });
  var emgRest = DataIO.generators.emg({ samples: 2048, sampleRate: 1000, movement: 'rest', noise: 0.01 });
  var rmsFlex = DSP.rms(emgFlex.values);
  var rmsRest = DSP.rms(emgRest.values);
  assert(rmsFlex > rmsRest, 'EMG flexion RMS (' + rmsFlex.toFixed(4) + ') > rest RMS (' + rmsRest.toFixed(4) + ')');

  // EMG-specific DSP features
  var testSig = [];
  for (var i = 0; i < 128; i++) testSig.push(Math.sin(2 * Math.PI * 10 * i / 128) + 0.1 * Math.sin(2 * Math.PI * 40 * i / 128));

  var mav = DSP.meanAbsoluteValue(testSig);
  assert(mav > 0, 'MAV is positive: ' + mav.toFixed(4));

  var wl = DSP.waveformLength(testSig);
  assert(wl > 0, 'Waveform length is positive: ' + wl.toFixed(4));

  var ssc = DSP.slopeSignChanges(testSig);
  assert(ssc > 0, 'Slope sign changes detected: ' + ssc);

  var wa = DSP.willsonAmplitude(testSig, 0.01);
  assert(wa > 0, 'Willson amplitude count: ' + wa);

  var mdf = DSP.medianFrequency(testSig, 128);
  assert(mdf > 0, 'Median frequency > 0: ' + mdf.toFixed(2) + ' Hz');

  var mnf = DSP.meanFrequency(testSig, 128);
  assert(mnf > 0, 'Mean frequency > 0: ' + mnf.toFixed(2) + ' Hz');

  // extractEMGFeatures returns all features
  var emgFeats = DSP.extractEMGFeatures(testSig, 128);
  assert(emgFeats.mav > 0, 'extractEMGFeatures.mav > 0');
  assert(emgFeats.rms > 0, 'extractEMGFeatures.rms > 0');
  assert(emgFeats.wl > 0, 'extractEMGFeatures.wl > 0');
  assert(typeof emgFeats.zc === 'number', 'extractEMGFeatures.zc is number');
  assert(typeof emgFeats.ssc === 'number', 'extractEMGFeatures.ssc is number');
  assert(emgFeats['var'] >= 0, 'extractEMGFeatures.var >= 0');
  assert(typeof emgFeats.wa === 'number', 'extractEMGFeatures.wa is number');
  assert(emgFeats.mdf >= 0, 'extractEMGFeatures.mdf >= 0');
  assert(emgFeats.mnf >= 0, 'extractEMGFeatures.mnf >= 0');

  console.log('EMG_Features: ' + pass + ' passed, ' + fail + ' failed\n');
  return { pass: pass, fail: fail };
});

// ══════════════════════════════════════════════════════════════════════════════
// AUDIO SIGNAL GENERATOR TESTS
// ══════════════════════════════════════════════════════════════════════════════
runTests('AudioSignal', function() {
  var pass = 0, fail = 0;
  function assert(cond, msg) {
    if (cond) { pass++; console.log('  PASS: ' + msg); }
    else { fail++; console.error('  FAIL: ' + msg); }
  }

  console.log('=== Audio Signal Generator Tests ===');

  var types = ['vowel_a', 'vowel_e', 'vowel_i', 'tone', 'silence'];
  for (var t = 0; t < types.length; t++) {
    var audio = DataIO.generators.audioSignal({ samples: 2048, sampleRate: 8000, signalType: types[t] });
    assert(audio.values.length === 2048, 'Audio ' + types[t] + ': produces 2048 samples');
    assert(audio.sampleRate === 8000, 'Audio ' + types[t] + ': correct sample rate');
    assert(!isNaN(audio.values[0]), 'Audio ' + types[t] + ': numeric output');
  }

  // Vowel should have more energy than silence
  var vowelA = DataIO.generators.audioSignal({ samples: 4096, sampleRate: 8000, signalType: 'vowel_a', noise: 0 });
  var silence = DataIO.generators.audioSignal({ samples: 4096, sampleRate: 8000, signalType: 'silence', noise: 0 });
  var energyA = DSP.energy(vowelA.values);
  var energyS = DSP.energy(silence.values);
  assert(energyA > energyS, 'Vowel energy (' + energyA.toFixed(2) + ') > silence energy (' + energyS.toFixed(6) + ')');

  // Tone at 440Hz should have peak near 440Hz in FFT
  var tone = DataIO.generators.audioSignal({ samples: 8192, sampleRate: 8000, signalType: 'tone', noise: 0 });
  var fftResult = DSP.fft(tone.values);
  var mags = DSP.magnitude(fftResult.real, fftResult.imag);
  var peakBin = 0, peakVal = 0;
  var halfLen = Math.floor(mags.length / 2);
  for (var i = 0; i < halfLen; i++) {
    if (mags[i] > peakVal) { peakVal = mags[i]; peakBin = i; }
  }
  var peakFreq = peakBin * 8000 / mags.length;
  assert(Math.abs(peakFreq - 440) < 10, 'Tone peak at ~440Hz (got ' + peakFreq.toFixed(1) + 'Hz)');

  console.log('AudioSignal: ' + pass + ' passed, ' + fail + ' failed\n');
  return { pass: pass, fail: fail };
});

// ══════════════════════════════════════════════════════════════════════════════
// EXCEL FILE PIPELINE TESTS (using real .xlsx files)
// ══════════════════════════════════════════════════════════════════════════════
runTests('ExcelPipeline', function() {
  var pass = 0, fail = 0;
  function assert(cond, msg) {
    if (cond) { pass++; console.log('  PASS: ' + msg); }
    else { fail++; console.error('  FAIL: ' + msg); }
  }

  console.log('=== Excel File Pipeline Tests ===');

  // We test the pipeline with CSV data (Excel parsing needs SheetJS in browser)
  // but we verify the full CSV-based pipeline which mirrors Excel input

  // Stock data from CSV
  var dsDef = BlockRegistry.getBlockType('dataSource');
  var winDef = BlockRegistry.getBlockType('windowing');
  var fftDef = BlockRegistry.getBlockType('fftBlock');
  var statDef = BlockRegistry.getBlockType('statistics');
  var mergerDef = BlockRegistry.getBlockType('featureMerger');
  var nnDef = BlockRegistry.getBlockType('neuralNetwork');
  var fuzzyDef = BlockRegistry.getBlockType('fuzzyClassifier');

  // Build CSV mimicking stock_data.xlsx BullMarket sheet
  var stockCSV = 'Day,Close,Volume\n';
  var price = 100;
  for (var i = 0; i < 200; i++) {
    price *= (1 + 0.002 + 0.015 * (Math.random() * 2 - 1));
    stockCSV += (i+1) + ',' + price.toFixed(2) + ',' + Math.floor(1000000 + Math.random()*500000) + '\n';
  }

  try {
    var stockResult = dsDef.process({ source: 'csv', csvData: stockCSV, csvColumn: 'Close', sampleRate: 1 }, {});
    assert(stockResult.signal.values.length === 200, 'Excel/CSV stock: 200 price values loaded');

    var stockWin = winDef.process(
      { windowSize: 20, overlap: 0.5, windowFunction: 'rectangular', applyWindow: false },
      { signal: stockResult.signal }
    );
    assert(stockWin.segments.windows.length > 0, 'Excel/CSV stock: segmented into ' + stockWin.segments.windows.length + ' windows');

    var stockFFT = fftDef.process(
      { numCoefficients: 10, outputType: 'magnitude', normalize: true },
      { segments: stockWin.segments }
    );
    assert(stockFFT.features.vectors.length > 0, 'Excel/CSV stock: FFT features extracted');

    var stockStats = statDef.process(
      { includeRMS: true, includeMean: true, includeVariance: true, includeStdDev: true,
        includePeak: false, includeCrestFactor: false, includeZeroCrossings: false, includeEnergy: false },
      { segments: stockWin.segments }
    );
    assert(stockStats.features.vectors.length > 0, 'Excel/CSV stock: stats features computed');

    var stockMerged = mergerDef.process({}, { features1: stockFFT.features, features2: stockStats.features });
    assert(stockMerged.features.vectors[0].length === 14, 'Excel/CSV stock: merged features = 10 FFT + 4 stats = 14');

    var stockNN = nnDef.process({
      hiddenLayers: [{ neurons: 8, activation: 'relu' }],
      outputNeurons: 3, outputActivation: 'softmax',
      learningRate: 0.01, epochs: 30, batchSize: 4,
      classNames: 'Likely Rising,Likely Falling,Steady'
    }, { features: stockMerged.features });
    assert(stockNN.predictions.items.length > 0, 'Excel/CSV stock: NN classified ' + stockNN.predictions.items.length + ' windows');

    var validClasses = ['Likely Rising', 'Likely Falling', 'Steady'];
    var allValid = true;
    for (var i = 0; i < stockNN.predictions.items.length; i++) {
      if (validClasses.indexOf(stockNN.predictions.items[i].className) < 0) { allValid = false; break; }
    }
    assert(allValid, 'Excel/CSV stock: all predictions are valid class names');

    console.log('  Stock pipeline: ' + stockNN.predictions.items.length + ' windows classified');
    var classCounts = {};
    for (var i = 0; i < stockNN.predictions.items.length; i++) {
      var cn = stockNN.predictions.items[i].className;
      classCounts[cn] = (classCounts[cn] || 0) + 1;
    }
    console.log('  Distribution: ' + JSON.stringify(classCounts));
  } catch(e) {
    assert(false, 'Excel/CSV stock pipeline threw: ' + e.message);
  }

  console.log('ExcelPipeline: ' + pass + ' passed, ' + fail + ' failed\n');
  return { pass: pass, fail: fail };
});

// ══════════════════════════════════════════════════════════════════════════════
// EMG END-TO-END PIPELINE TESTS
// ══════════════════════════════════════════════════════════════════════════════
runTests('EMGPipeline', function() {
  var pass = 0, fail = 0;
  function assert(cond, msg) {
    if (cond) { pass++; console.log('  PASS: ' + msg); }
    else { fail++; console.error('  FAIL: ' + msg); }
  }

  console.log('=== EMG End-to-End Pipeline Tests ===');

  var dsDef = BlockRegistry.getBlockType('dataSource');
  var winDef = BlockRegistry.getBlockType('windowing');
  var statDef = BlockRegistry.getBlockType('statistics');
  var fftDef = BlockRegistry.getBlockType('fftBlock');
  var mergerDef = BlockRegistry.getBlockType('featureMerger');
  var nnDef = BlockRegistry.getBlockType('neuralNetwork');

  // Generate EMG training data for 4 movements
  var movements = ['pronation', 'supination', 'flexion', 'extension'];
  var allFeatures = [];
  var allLabels = [];

  for (var m = 0; m < movements.length; m++) {
    for (var trial = 0; trial < 5; trial++) {
      var emgData = DataIO.generators.emg({
        samples: 1024, sampleRate: 1000, movement: movements[m], noise: 0.02
      });

      // Segment into windows
      var segments = DSP.segmentSignal(emgData.values, 256, 0.5);

      for (var s = 0; s < segments.length; s++) {
        var feats = DSP.extractEMGFeatures(segments[s], 1000);
        allFeatures.push([feats.mav, feats.rms, feats.wl, feats.zc, feats.ssc, feats['var']]);
        allLabels.push(m);
      }
    }
  }

  assert(allFeatures.length > 0, 'EMG pipeline: extracted ' + allFeatures.length + ' feature vectors');
  assert(allFeatures[0].length === 6, 'EMG pipeline: 6 features per vector');
  assert(allLabels.length === allFeatures.length, 'EMG pipeline: labels match feature count');

  // Normalize features
  var numFeats = allFeatures[0].length;
  var mins = new Array(numFeats).fill(Infinity);
  var maxs = new Array(numFeats).fill(-Infinity);
  for (var i = 0; i < allFeatures.length; i++) {
    for (var j = 0; j < numFeats; j++) {
      if (allFeatures[i][j] < mins[j]) mins[j] = allFeatures[i][j];
      if (allFeatures[i][j] > maxs[j]) maxs[j] = allFeatures[i][j];
    }
  }
  for (var i = 0; i < allFeatures.length; i++) {
    for (var j = 0; j < numFeats; j++) {
      var range = maxs[j] - mins[j];
      allFeatures[i][j] = range > 0 ? (allFeatures[i][j] - mins[j]) / range : 0;
    }
  }

  // Train neural network
  var nn = NeuralNetwork.createNetwork({
    inputSize: 6,
    layers: [
      { neurons: 16, activation: 'relu' },
      { neurons: 8, activation: 'relu' },
      { neurons: 4, activation: 'softmax' }
    ],
    learningRate: 0.02,
    momentum: 0.9
  });

  // Prepare one-hot targets
  var targets = [];
  for (var i = 0; i < allLabels.length; i++) {
    var target = [0, 0, 0, 0];
    target[allLabels[i]] = 1;
    targets.push(target);
  }

  var history = NeuralNetwork.train(nn, allFeatures, targets, 200, 8);
  assert(history.length === 200, 'EMG pipeline: trained for 200 epochs');
  // Check loss trend over training (compare first 10 avg to last 10 avg for stability)
  var earlyLoss = 0, lateLoss = 0;
  for (var i = 0; i < 10; i++) earlyLoss += history[i].loss;
  for (var i = 190; i < 200; i++) lateLoss += history[i].loss;
  earlyLoss /= 10; lateLoss /= 10;
  assert(lateLoss <= earlyLoss + 0.01, 'EMG pipeline: avg loss stable or decreased (early=' + earlyLoss.toFixed(4) + ', late=' + lateLoss.toFixed(4) + ')');

  // Test classification
  var correct = 0;
  for (var i = 0; i < allFeatures.length; i++) {
    var pred = NeuralNetwork.classify(nn, allFeatures[i]);
    if (pred.classIndex === allLabels[i]) correct++;
  }
  var accuracy = correct / allFeatures.length;
  assert(accuracy >= 0.20, 'EMG pipeline: accuracy ' + (accuracy * 100).toFixed(1) + '% (>= 20%)');
  console.log('  EMG accuracy: ' + (accuracy * 100).toFixed(1) + '% on ' + allFeatures.length + ' samples');

  // Verify movement detection output
  var testEmg = DataIO.generators.emg({ samples: 1024, sampleRate: 1000, movement: 'flexion', noise: 0.01 });
  var testSegs = DSP.segmentSignal(testEmg.values, 256, 0.5);
  var detectedMovements = [];
  for (var s = 0; s < testSegs.length; s++) {
    var f = DSP.extractEMGFeatures(testSegs[s], 1000);
    var normalized = [f.mav, f.rms, f.wl, f.zc, f.ssc, f['var']];
    for (var j = 0; j < numFeats; j++) {
      var range = maxs[j] - mins[j];
      normalized[j] = range > 0 ? (normalized[j] - mins[j]) / range : 0;
    }
    var result = NeuralNetwork.classify(nn, normalized);
    detectedMovements.push(movements[result.classIndex]);
  }
  assert(detectedMovements.length > 0, 'EMG pipeline: detected movements: ' + detectedMovements.join(', '));

  console.log('EMGPipeline: ' + pass + ' passed, ' + fail + ' failed\n');
  return { pass: pass, fail: fail };
});

// ══════════════════════════════════════════════════════════════════════════════
// AUDIO SIGNAL PIPELINE TESTS
// ══════════════════════════════════════════════════════════════════════════════
runTests('AudioPipeline', function() {
  var pass = 0, fail = 0;
  function assert(cond, msg) {
    if (cond) { pass++; console.log('  PASS: ' + msg); }
    else { fail++; console.error('  FAIL: ' + msg); }
  }

  console.log('=== Audio Signal Pipeline Tests ===');

  var dsDef = BlockRegistry.getBlockType('dataSource');
  var winDef = BlockRegistry.getBlockType('windowing');
  var fftDef = BlockRegistry.getBlockType('fftBlock');
  var nnDef = BlockRegistry.getBlockType('neuralNetwork');

  // Generate training data for audio classification (vowel vs silence vs tone)
  var audioTypes = ['vowel_a', 'vowel_e', 'vowel_i', 'silence'];
  var audioFeatures = [];
  var audioLabels = [];

  for (var a = 0; a < audioTypes.length; a++) {
    for (var trial = 0; trial < 5; trial++) {
      var audio = DataIO.generators.audioSignal({
        samples: 2048, sampleRate: 8000, signalType: audioTypes[a]
      });

      var segments = DSP.segmentSignal(audio.values, 512, 0.5);
      for (var s = 0; s < Math.min(segments.length, 3); s++) {
        var fftCoeffs = DSP.extractFFTCoefficients(segments[s], 16, 'hanning');
        var r = DSP.rms(segments[s]);
        var zc = DSP.zeroCrossings(segments[s]);
        var feat = fftCoeffs.concat([r, zc / 512]);
        audioFeatures.push(feat);
        audioLabels.push(a);
      }
    }
  }

  assert(audioFeatures.length > 0, 'Audio pipeline: ' + audioFeatures.length + ' feature vectors');
  assert(audioFeatures[0].length === 18, 'Audio pipeline: 18 features (16 FFT + RMS + ZC)');

  // Train classifier
  var nn = NeuralNetwork.createNetwork({
    inputSize: 18,
    layers: [
      { neurons: 12, activation: 'relu' },
      { neurons: 4, activation: 'softmax' }
    ],
    learningRate: 0.02
  });

  var targets = [];
  for (var i = 0; i < audioLabels.length; i++) {
    var t = [0, 0, 0, 0];
    t[audioLabels[i]] = 1;
    targets.push(t);
  }

  var history = NeuralNetwork.train(nn, audioFeatures, targets, 80, 8);
  assert(history[79].loss < history[0].loss, 'Audio pipeline: loss decreased');

  var correct = 0;
  for (var i = 0; i < audioFeatures.length; i++) {
    var pred = NeuralNetwork.classify(nn, audioFeatures[i]);
    if (pred.classIndex === audioLabels[i]) correct++;
  }
  var accuracy = correct / audioFeatures.length;
  assert(accuracy > 0.3, 'Audio pipeline: accuracy ' + (accuracy * 100).toFixed(1) + '%');
  console.log('  Audio accuracy: ' + (accuracy * 100).toFixed(1) + '%');

  console.log('AudioPipeline: ' + pass + ' passed, ' + fail + ' failed\n');
  return { pass: pass, fail: fail };
});

// ══════════════════════════════════════════════════════════════════════════════
// VIBRATION SENSOR PIPELINE TESTS
// ══════════════════════════════════════════════════════════════════════════════
runTests('VibrationPipeline', function() {
  var pass = 0, fail = 0;
  function assert(cond, msg) {
    if (cond) { pass++; console.log('  PASS: ' + msg); }
    else { fail++; console.error('  FAIL: ' + msg); }
  }

  console.log('=== Vibration Sensor Pipeline Tests ===');

  var dsDef = BlockRegistry.getBlockType('dataSource');
  var winDef = BlockRegistry.getBlockType('windowing');
  var fftDef = BlockRegistry.getBlockType('fftBlock');
  var statDef = BlockRegistry.getBlockType('statistics');
  var mergerDef = BlockRegistry.getBlockType('featureMerger');
  var fuzzyDef = BlockRegistry.getBlockType('fuzzyClassifier');

  // Normal vs high-harmonic vibration
  try {
    var vibNormal = dsDef.process({
      source: 'generate', generator: 'vibration', sampleRate: 1024,
      generatorConfig: { samples: 1024, sampleRate: 1024, fundamentalFreq: 25, harmonics: 2, noise: 0.05 }
    }, {});
    assert(vibNormal.signal.values.length === 1024, 'Vibration normal: 1024 samples');

    var vibFaulty = dsDef.process({
      source: 'generate', generator: 'vibration', sampleRate: 1024,
      generatorConfig: { samples: 1024, sampleRate: 1024, fundamentalFreq: 25, harmonics: 6, noise: 0.15 }
    }, {});
    assert(vibFaulty.signal.values.length === 1024, 'Vibration faulty: 1024 samples');

    // Process normal
    var winN = winDef.process({ windowSize: 256, overlap: 0.5, windowFunction: 'hanning', applyWindow: true },
      { signal: vibNormal.signal });
    var fftN = fftDef.process({ numCoefficients: 16, outputType: 'magnitude', normalize: true },
      { segments: winN.segments });
    var statN = statDef.process(
      { includeRMS: true, includeMean: true, includeVariance: true, includeStdDev: false,
        includePeak: true, includeCrestFactor: true, includeZeroCrossings: false, includeEnergy: true },
      { segments: winN.segments });
    var mergedN = mergerDef.process({}, { features1: fftN.features, features2: statN.features });

    // Process faulty
    var winF = winDef.process({ windowSize: 256, overlap: 0.5, windowFunction: 'hanning', applyWindow: true },
      { signal: vibFaulty.signal });
    var fftF = fftDef.process({ numCoefficients: 16, outputType: 'magnitude', normalize: true },
      { segments: winF.segments });
    var statF = statDef.process(
      { includeRMS: true, includeMean: true, includeVariance: true, includeStdDev: false,
        includePeak: true, includeCrestFactor: true, includeZeroCrossings: false, includeEnergy: true },
      { segments: winF.segments });
    var mergedF = mergerDef.process({}, { features1: fftF.features, features2: statF.features });

    assert(mergedN.features.vectors.length > 0, 'Vibration: normal features extracted');
    assert(mergedF.features.vectors.length > 0, 'Vibration: faulty features extracted');

    // Faulty should have higher variance/energy
    var normalRMS = DSP.rms(vibNormal.signal.values);
    var faultyRMS = DSP.rms(vibFaulty.signal.values);
    assert(faultyRMS > normalRMS * 0.5, 'Vibration: faulty signal has substantial RMS (' + faultyRMS.toFixed(4) + ')');

    // Use fuzzy classifier on vibration features
    var fuzzyResult = fuzzyDef.process(
      { mode: 'threshold', classes: 'Normal,Warning,Critical', thresholds: '0.33,0.66', inputFeatureIndex: 0 },
      { features: mergedN.features }
    );
    assert(fuzzyResult.classification.items.length > 0, 'Vibration: fuzzy classified normal signal');
    console.log('  Normal signal classes: ' + fuzzyResult.classification.items.map(function(it) { return it.label; }).join(', '));

  } catch(e) {
    assert(false, 'Vibration pipeline threw: ' + e.message);
  }

  console.log('VibrationPipeline: ' + pass + ' passed, ' + fail + ' failed\n');
  return { pass: pass, fail: fail };
});

// ══════════════════════════════════════════════════════════════════════════════
// EDGE CASE TESTS
// ══════════════════════════════════════════════════════════════════════════════
runTests('EdgeCases', function() {
  var pass = 0, fail = 0;
  function assert(cond, msg) {
    if (cond) { pass++; console.log('  PASS: ' + msg); }
    else { fail++; console.error('  FAIL: ' + msg); }
  }

  console.log('=== Edge Case Tests ===');

  // Very short signal (16 samples)
  var shortSig = [];
  for (var i = 0; i < 16; i++) shortSig.push(Math.sin(2 * Math.PI * 2 * i / 16));
  var shortFFT = DSP.fft(shortSig);
  assert(shortFFT.real.length === 16, 'Short signal FFT: length 16');
  var shortMags = DSP.magnitude(shortFFT.real, shortFFT.imag);
  assert(shortMags.length === 16, 'Short signal magnitude: length 16');

  // Non-power-of-2 length (padded internally)
  var oddSig = [];
  for (var i = 0; i < 100; i++) oddSig.push(Math.sin(2 * Math.PI * 5 * i / 100));
  var oddFFT = DSP.fft(oddSig);
  assert(oddFFT.real.length === 128, 'Non-power-of-2 (100): padded to 128');

  // Very large signal (4096)
  var largeSig = [];
  for (var i = 0; i < 4096; i++) largeSig.push(Math.sin(2 * Math.PI * 50 * i / 4096));
  var largeFFT = DSP.fft(largeSig);
  assert(largeFFT.real.length === 4096, 'Large signal (4096) FFT works');
  var largeMags = DSP.magnitude(largeFFT.real, largeFFT.imag);
  var peakBin = 0, peakVal = 0;
  for (var i = 0; i < 2048; i++) {
    if (largeMags[i] > peakVal) { peakVal = largeMags[i]; peakBin = i; }
  }
  assert(peakBin === 50, 'Large signal peak at bin 50 (50Hz)');

  // Constant signal (zero variance)
  var constSig = new Array(64).fill(5.0);
  assert(DSP.variance(constSig) === 0, 'Constant signal: variance = 0');
  assert(DSP.stddev(constSig) === 0, 'Constant signal: stddev = 0');
  assert(DSP.rms(constSig) === 5.0, 'Constant signal: RMS = 5.0');
  assert(DSP.zeroCrossings(constSig) === 0, 'Constant signal: 0 zero crossings');
  var normConst = DSP.standardize(constSig);
  assert(normConst[0] === 0, 'Constant signal standardize: all zeros');

  // All zeros signal
  var zeroSig = new Array(64).fill(0);
  assert(DSP.rms(zeroSig) === 0, 'Zero signal: RMS = 0');
  assert(DSP.energy(zeroSig) === 0, 'Zero signal: energy = 0');
  assert(DSP.meanAbsoluteValue(zeroSig) === 0, 'Zero signal: MAV = 0');

  // Single sample
  var singleSig = [42];
  assert(DSP.mean(singleSig) === 42, 'Single sample: mean = 42');
  assert(DSP.rms(singleSig) === 42, 'Single sample: RMS = 42');

  // Different sampling rates
  var rates = [100, 500, 1000, 8000, 44100];
  for (var r = 0; r < rates.length; r++) {
    var sr = rates[r];
    var sig = [];
    var numSamples = Math.min(sr, 4096);
    for (var i = 0; i < numSamples; i++) sig.push(Math.sin(2 * Math.PI * 10 * i / sr));
    var segs = DSP.segmentSignal(sig, Math.min(64, numSamples), 0.5);
    assert(segs.length >= 1, 'SampleRate ' + sr + ': segmentation works (' + segs.length + ' segments)');
  }

  // Noisy signal feature extraction
  var noisySig = [];
  for (var i = 0; i < 256; i++) noisySig.push((Math.random() * 2 - 1) * 10);
  var noisyFeats = DSP.extractFeatures(noisySig, {
    includeRMS: true, includeMean: true, includeVariance: true,
    includeZeroCrossings: true, includePeak: true, includeCrestFactor: true,
    includeEnergy: true, includeFFT: true, fftCoefficients: 8
  });
  assert(noisyFeats.length === 15, 'Noisy signal: 7 stats + 8 FFT = 15 features');
  for (var i = 0; i < noisyFeats.length; i++) {
    assert(!isNaN(noisyFeats[i]), 'Noisy feature[' + i + '] is not NaN');
  }

  // EMG features on very small window
  var smallWin = [0.1, -0.2, 0.3, -0.1, 0.05, -0.15, 0.2, -0.05];
  var emgSmall = DSP.extractEMGFeatures(smallWin, 1000);
  assert(emgSmall.mav > 0, 'Small EMG window: MAV > 0');
  assert(typeof emgSmall.mdf === 'number', 'Small EMG window: MDF is number');

  // Segmentation with overlap 0 (no overlap)
  var sig100 = [];
  for (var i = 0; i < 100; i++) sig100.push(i);
  var segsNoOverlap = DSP.segmentSignal(sig100, 10, 0);
  assert(segsNoOverlap.length === 10, 'No overlap: 100/10 = 10 segments');
  assert(segsNoOverlap[0][0] === 0, 'No overlap: first segment starts at 0');
  assert(segsNoOverlap[1][0] === 10, 'No overlap: second segment starts at 10');

  // Segmentation with high overlap (0.9)
  var segsHighOverlap = DSP.segmentSignal(sig100, 10, 0.9);
  assert(segsHighOverlap.length > 50, 'High overlap (0.9): many segments (' + segsHighOverlap.length + ')');

  // Window too large for signal
  var segsTooBig = DSP.segmentSignal(sig100, 200, 0);
  assert(segsTooBig.length === 0, 'Window > signal length: 0 segments');

  console.log('EdgeCases: ' + pass + ' passed, ' + fail + ' failed\n');
  return { pass: pass, fail: fail };
});

// ══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE & ACCURACY FEEDBACK TESTS
// ══════════════════════════════════════════════════════════════════════════════
runTests('PerformanceAccuracy', function() {
  var pass = 0, fail = 0;
  function assert(cond, msg) {
    if (cond) { pass++; console.log('  PASS: ' + msg); }
    else { fail++; console.error('  FAIL: ' + msg); }
  }

  console.log('=== Performance & Accuracy Feedback Tests ===');

  // Test different window sizes affect feature quality
  var testSig = [];
  for (var i = 0; i < 1024; i++) {
    testSig.push(Math.sin(2 * Math.PI * 10 * i / 256) + 0.5 * Math.sin(2 * Math.PI * 30 * i / 256));
  }

  var windowSizes = [32, 64, 128, 256];
  console.log('  --- Window Size Analysis ---');
  for (var w = 0; w < windowSizes.length; w++) {
    var ws = windowSizes[w];
    var segs = DSP.segmentSignal(testSig, ws, 0.5);
    var features = [];
    for (var s = 0; s < segs.length; s++) {
      features.push(DSP.extractFFTCoefficients(segs[s], 8, 'hanning'));
    }
    assert(features.length > 0, 'Window=' + ws + ': ' + features.length + ' segments, ' + features[0].length + ' features each');
    // Larger windows should resolve frequencies better
    var variance = 0;
    for (var f = 0; f < features.length; f++) {
      for (var j = 0; j < features[f].length; j++) {
        variance += (features[f][j] - 0.5) * (features[f][j] - 0.5);
      }
    }
    console.log('    Window ' + ws + ': ' + features.length + ' segments, feature variance=' + (variance / features.length).toFixed(4));
  }

  // Test different network architectures on same data
  console.log('  --- Network Architecture Comparison ---');
  var trainX = [], trainY = [];
  for (var i = 0; i < 100; i++) {
    if (i < 50) {
      trainX.push([Math.random() * 0.4, Math.random() * 0.4, Math.random() * 0.4]);
      trainY.push([1, 0]);
    } else {
      trainX.push([0.6 + Math.random() * 0.4, 0.6 + Math.random() * 0.4, 0.6 + Math.random() * 0.4]);
      trainY.push([0, 1]);
    }
  }

  var architectures = [
    { name: 'Small (4)', layers: [{ neurons: 4, activation: 'sigmoid' }, { neurons: 2, activation: 'softmax' }] },
    { name: 'Medium (8-4)', layers: [{ neurons: 8, activation: 'relu' }, { neurons: 4, activation: 'relu' }, { neurons: 2, activation: 'softmax' }] },
    { name: 'Large (16-8)', layers: [{ neurons: 16, activation: 'relu' }, { neurons: 8, activation: 'relu' }, { neurons: 2, activation: 'softmax' }] }
  ];

  for (var a = 0; a < architectures.length; a++) {
    var arch = architectures[a];
    var nn = NeuralNetwork.createNetwork({
      inputSize: 3,
      layers: arch.layers,
      learningRate: 0.02
    });
    var history = NeuralNetwork.train(nn, trainX, trainY, 100, 10);
    var finalLoss = history[99].loss;
    var correct = 0;
    for (var i = 0; i < trainX.length; i++) {
      var pred = NeuralNetwork.classify(nn, trainX[i]);
      var expected = trainY[i][0] > trainY[i][1] ? 0 : 1;
      if (pred.classIndex === expected) correct++;
    }
    var acc = correct / trainX.length * 100;
    assert(finalLoss < history[0].loss, arch.name + ': loss decreased (final=' + finalLoss.toFixed(4) + ')');
    console.log('    ' + arch.name + ': accuracy=' + acc.toFixed(1) + '%, loss=' + finalLoss.toFixed(4));
  }

  // Test learning rates
  console.log('  --- Learning Rate Comparison ---');
  var lrs = [0.001, 0.01, 0.05];
  for (var l = 0; l < lrs.length; l++) {
    var nn = NeuralNetwork.createNetwork({
      inputSize: 3,
      layers: [{ neurons: 8, activation: 'relu' }, { neurons: 2, activation: 'softmax' }],
      learningRate: lrs[l]
    });
    var history = NeuralNetwork.train(nn, trainX, trainY, 50, 10);
    assert(history.length === 50, 'LR=' + lrs[l] + ': trained 50 epochs');
    console.log('    LR=' + lrs[l] + ': start_loss=' + history[0].loss.toFixed(4) + ', end_loss=' + history[49].loss.toFixed(4));
  }

  console.log('PerformanceAccuracy: ' + pass + ' passed, ' + fail + ' failed\n');
  return { pass: pass, fail: fail };
});

// ══════════════════════════════════════════════════════════════════════════════
// EXCEL FILE READING TESTS (Node.js with XLSX)
// ══════════════════════════════════════════════════════════════════════════════
var fs2 = require('fs');
var XLSX2;
try { XLSX2 = require('xlsx'); } catch(e) { XLSX2 = null; }

if (XLSX2 && fs2.existsSync('test_data/stock_data.xlsx')) {
  (function() {
    var localPass = 0, localFail = 0;
    function assert(cond, msg) {
      if (cond) { localPass++; console.log('  PASS: ' + msg); }
      else { localFail++; console.error('  FAIL: ' + msg); }
    }

    console.log('=== Excel File Reading Tests ===');

    // Read stock_data.xlsx
    var wb = XLSX2.readFile('test_data/stock_data.xlsx');
    assert(wb.SheetNames.length === 4, 'stock_data.xlsx has 4 sheets');
    assert(wb.SheetNames.indexOf('BullMarket') >= 0, 'Has BullMarket sheet');
    assert(wb.SheetNames.indexOf('BearMarket') >= 0, 'Has BearMarket sheet');
    assert(wb.SheetNames.indexOf('Sideways') >= 0, 'Has Sideways sheet');
    assert(wb.SheetNames.indexOf('Volatile') >= 0, 'Has Volatile sheet');

    var bullCSV = XLSX2.utils.sheet_to_csv(wb.Sheets['BullMarket']);
    var parsed = vm.runInContext(
      '(function() { return DataIO.parseCSV(' + JSON.stringify(bullCSV) + '); })()',
      context
    );
    assert(parsed.headers.indexOf('Close') >= 0, 'BullMarket has Close column');
    assert(parsed.columns['Close'].length === 200, 'BullMarket has 200 rows');

    // Bull market should trend up
    var firstPrice = parsed.columns['Close'][0];
    var lastPrice = parsed.columns['Close'][199];
    console.log('  BullMarket: first=' + firstPrice + ', last=' + lastPrice);

    // Read EMG file
    var emgWb = XLSX2.readFile('test_data/emg_hand_movements.xlsx');
    assert(emgWb.SheetNames.length === 5, 'emg_hand_movements.xlsx has 5 sheets');
    assert(emgWb.SheetNames.indexOf('pronation') >= 0, 'Has pronation sheet');
    assert(emgWb.SheetNames.indexOf('flexion') >= 0, 'Has flexion sheet');

    var flexCSV = XLSX2.utils.sheet_to_csv(emgWb.Sheets['flexion']);
    var emgParsed = vm.runInContext(
      '(function() { return DataIO.parseCSV(' + JSON.stringify(flexCSV) + '); })()',
      context
    );
    assert(emgParsed.headers.indexOf('Trial_1') >= 0, 'EMG flexion has Trial_1 column');
    assert(emgParsed.columns['Trial_1'].length === 2000, 'EMG flexion has 2000 samples');

    // Read audio file
    var audioWb = XLSX2.readFile('test_data/audio_signals.xlsx');
    assert(audioWb.SheetNames.length === 4, 'audio_signals.xlsx has 4 sheets');
    assert(audioWb.SheetNames.indexOf('vowel_a') >= 0, 'Has vowel_a sheet');

    // Read vibration file
    var vibWb = XLSX2.readFile('test_data/vibration_data.xlsx');
    assert(vibWb.SheetNames.length === 4, 'vibration_data.xlsx has 4 sheets');
    assert(vibWb.SheetNames.indexOf('normal') >= 0, 'Has normal sheet');
    assert(vibWb.SheetNames.indexOf('bearing_fault') >= 0, 'Has bearing_fault sheet');

    // CSV files
    assert(fs2.existsSync('test_data/stock_simple.csv'), 'stock_simple.csv exists');
    assert(fs2.existsSync('test_data/emg_flexion.csv'), 'emg_flexion.csv exists');
    assert(fs2.existsSync('test_data/sine_composite.csv'), 'sine_composite.csv exists');

    // Process stock Excel data through full pipeline in context
    var pipelineResult = vm.runInContext('(function() {' +
      'var csvData = ' + JSON.stringify(bullCSV) + ';' +
      'var dsDef = BlockRegistry.getBlockType("dataSource");' +
      'var ds = dsDef.process({ source: "csv", csvData: csvData, csvColumn: "Close", sampleRate: 1 }, {});' +
      'var winDef = BlockRegistry.getBlockType("windowing");' +
      'var win = winDef.process({ windowSize: 20, overlap: 0.5, windowFunction: "rectangular", applyWindow: false }, { signal: ds.signal });' +
      'var fftDef = BlockRegistry.getBlockType("fftBlock");' +
      'var fftR = fftDef.process({ numCoefficients: 8, outputType: "magnitude", normalize: true }, { segments: win.segments });' +
      'var nnDef = BlockRegistry.getBlockType("neuralNetwork");' +
      'var nnR = nnDef.process({ hiddenLayers: [{ neurons: 8, activation: "relu" }], outputNeurons: 3, outputActivation: "softmax", learningRate: 0.01, epochs: 20, batchSize: 4, classNames: "Likely Rising,Likely Falling,Steady" }, { features: fftR.features });' +
      'return { windowCount: win.segments.windows.length, predCount: nnR.predictions.items.length, firstClass: nnR.predictions.items[0].className };' +
      '})()', context);

    assert(pipelineResult.windowCount > 0, 'Excel stock E2E: ' + pipelineResult.windowCount + ' windows processed');
    assert(pipelineResult.predCount > 0, 'Excel stock E2E: ' + pipelineResult.predCount + ' predictions made');
    assert(typeof pipelineResult.firstClass === 'string', 'Excel stock E2E: first prediction = ' + pipelineResult.firstClass);

    console.log('ExcelFileReading: ' + localPass + ' passed, ' + localFail + ' failed\n');
    totalPass += localPass;
    totalFail += localFail;
  })();
} else {
  console.log('=== Excel File Reading Tests === SKIPPED (xlsx not available or test_data missing)\n');
}

// ══════════════════════════════════════════════════════════════════════════════
// TRAIN / INFERENCE MODE TESTS
// Tests the two-mode pipeline workflow required for the S&P 500 use case:
//   1. Train on historical data → model persists in config
//   2. Swap data source → Infer uses saved model, no retraining
// ══════════════════════════════════════════════════════════════════════════════
runTests('TrainInferMode', function() {
  var pass = 0, fail = 0;
  function assert(cond, msg) {
    if (cond) { pass++; console.log('  PASS: ' + msg); }
    else { fail++; console.error('  FAIL: ' + msg); }
  }

  console.log('=== Train / Inference Mode Tests ===');

  var nnDef  = BlockRegistry.getBlockType('neuralNetwork');
  var knnDef = BlockRegistry.getBlockType('knnClassifier');

  function makeFeatures(n, dim) {
    var vecs = [];
    for (var i = 0; i < n; i++) {
      var row = [];
      for (var d = 0; d < dim; d++) row.push(Math.sin(i * 0.3 + d) * 0.5 + 0.5);
      vecs.push(row);
    }
    return { vectors: vecs, labels: [], featureNames: ['f1','f2','f3'] };
  }

  // T1: NN train mode stores trainedNetwork
  console.log('  --- T1: NN train mode ---');
  var nnCfg = {
    hiddenLayers: [{ neurons: 8, activation: 'relu' }],
    outputNeurons: 2, outputActivation: 'softmax',
    learningRate: 0.01, momentum: 0.9, epochs: 20, batchSize: 4,
    classNames: 'Rise,Fall', trainedNetwork: null
  };
  try {
    var r1 = nnDef.process(nnCfg, { features: makeFeatures(30, 3) });
    assert(r1.predictions !== undefined, 'T1: NN train returns predictions');
    assert(r1.predictions.items.length === 30, 'T1: 30 predictions for 30 samples');
    assert(nnCfg.trainedNetwork !== null, 'T1: trainedNetwork stored in config after train');
    assert(nnCfg._isTrained === true, 'T1: _isTrained flag set to true');
    assert(!r1.predictions.error, 'T1: no error in train mode');
  } catch(e) { assert(false, 'T1 threw: ' + e.message); }

  // T2: NN infer mode reuses saved model, no retraining
  console.log('  --- T2: NN infer mode uses saved model ---');
  var savedNetwork = nnCfg.trainedNetwork;
  try {
    nnCfg._runMode = 'infer';
    var r2 = nnDef.process(nnCfg, { features: makeFeatures(15, 3) });
    assert(r2.predictions !== undefined, 'T2: NN infer returns predictions');
    assert(r2.predictions.items.length === 15, 'T2: 15 predictions on new data');
    assert(nnCfg.trainedNetwork === savedNetwork, 'T2: same trainedNetwork — no retrain');
    assert(!r2.predictions.error, 'T2: no error when model exists');
    delete nnCfg._runMode;
  } catch(e) { assert(false, 'T2 threw: ' + e.message); }

  // T3: NN infer with no model returns error
  console.log('  --- T3: NN infer with no saved model ---');
  var nnCfgEmpty = {
    hiddenLayers: [{ neurons: 4, activation: 'relu' }],
    outputNeurons: 2, outputActivation: 'softmax',
    learningRate: 0.01, momentum: 0.9, epochs: 10, batchSize: 4,
    classNames: 'Rise,Fall', trainedNetwork: null, _runMode: 'infer'
  };
  try {
    var r3 = nnDef.process(nnCfgEmpty, { features: makeFeatures(10, 3) });
    assert(r3.predictions !== undefined, 'T3: returns predictions object');
    assert(typeof r3.predictions.error === 'string', 'T3: error string present');
    assert(r3.predictions.items.length === 0, 'T3: items array is empty');
    assert(nnCfgEmpty._isTrained === false, 'T3: _isTrained is false');
  } catch(e) { assert(false, 'T3 threw: ' + e.message); }

  // T4: forceRetrain flag causes retrain even with existing model
  console.log('  --- T4: NN forceRetrain flag ---');
  var nnCfgRetrain = {
    hiddenLayers: [{ neurons: 8, activation: 'relu' }],
    outputNeurons: 2, outputActivation: 'softmax',
    learningRate: 0.01, momentum: 0.9, epochs: 20, batchSize: 4,
    classNames: 'Rise,Fall', trainedNetwork: savedNetwork, forceRetrain: true
  };
  try {
    var r4 = nnDef.process(nnCfgRetrain, { features: makeFeatures(20, 3) });
    assert(r4.predictions.items.length === 20, 'T4: predictions after forceRetrain');
    assert(nnCfgRetrain.forceRetrain === false, 'T4: forceRetrain reset to false');
    assert(nnCfgRetrain.trainedNetwork !== null, 'T4: new model stored');
  } catch(e) { assert(false, 'T4 threw: ' + e.message); }

  // T5: kNN train mode stores _trainData
  console.log('  --- T5: kNN train mode ---');
  var knnCfg = { k: 3, numClasses: 2, classNames: 'Rise,Fall' };
  try {
    var r5 = knnDef.process(knnCfg, { features: makeFeatures(40, 3) });
    assert(r5.predictions !== undefined, 'T5: kNN train returns predictions');
    assert(r5.predictions.items.length === 40, 'T5: 40 predictions');
    assert(knnCfg._trainData !== undefined && knnCfg._trainData !== null, 'T5: _trainData stored in config');
    assert(Array.isArray(knnCfg._trainData.vectors), 'T5: _trainData.vectors is array');
    assert(Array.isArray(knnCfg._trainData.labels), 'T5: _trainData.labels is array');
    assert(knnCfg._isTrained === true, 'T5: _isTrained flag set');
  } catch(e) { assert(false, 'T5 threw: ' + e.message); }

  // T6: kNN infer mode classifies new data against stored training data
  console.log('  --- T6: kNN infer mode ---');
  var storedTrainData = knnCfg._trainData;
  try {
    knnCfg._runMode = 'infer';
    var r6 = knnDef.process(knnCfg, { features: makeFeatures(20, 3) });
    assert(r6.predictions !== undefined, 'T6: kNN infer returns predictions');
    assert(r6.predictions.items.length === 20, 'T6: 20 predictions on new data');
    assert(knnCfg._trainData === storedTrainData, 'T6: _trainData unchanged — no re-labeling');
    assert(!r6.predictions.error, 'T6: no error when trainData exists');
    delete knnCfg._runMode;
  } catch(e) { assert(false, 'T6 threw: ' + e.message); }

  // T7: kNN infer with no _trainData returns error
  console.log('  --- T7: kNN infer with no training data ---');
  var knnCfgEmpty = { k: 3, numClasses: 2, classNames: 'Rise,Fall', _runMode: 'infer' };
  try {
    var r7 = knnDef.process(knnCfgEmpty, { features: makeFeatures(10, 3) });
    assert(r7.predictions !== undefined, 'T7: returns predictions object');
    assert(typeof r7.predictions.error === 'string', 'T7: error string present');
    assert(knnCfgEmpty._isTrained === false, 'T7: _isTrained is false');
  } catch(e) { assert(false, 'T7 threw: ' + e.message); }

  // T8: NN defaults to train mode when _runMode absent (backward compat)
  console.log('  --- T8: NN backward-compat — defaults to train when _runMode absent ---');
  var nnCfg8 = {
    hiddenLayers: [{ neurons: 4, activation: 'relu' }],
    outputNeurons: 2, outputActivation: 'softmax',
    learningRate: 0.01, momentum: 0.9, epochs: 10, batchSize: 4,
    classNames: 'A,B', trainedNetwork: null
  };
  try {
    var r8 = nnDef.process(nnCfg8, { features: makeFeatures(20, 3) });
    assert(r8.predictions.items.length === 20, 'T8: 20 predictions without explicit _runMode');
    assert(nnCfg8.trainedNetwork !== null, 'T8: model stored without explicit _runMode');
  } catch(e) { assert(false, 'T8 threw: ' + e.message); }

  // T9: Full S&P 500-style — train on historical CSV, infer on new period CSV
  console.log('  --- T9: S&P 500 simulation — train on historical, infer on new period ---');
  try {
    var dsDef9  = BlockRegistry.getBlockType('dataSource');
    var winDef9 = BlockRegistry.getBlockType('windowing');
    var staDef9 = BlockRegistry.getBlockType('statistics');

    function makeStockCSV(startPrice, trend, rows) {
      var csv = 'Day,Close\n';
      var p = startPrice;
      for (var i = 0; i < rows; i++) {
        p *= (1 + trend + 0.01 * (Math.random() * 2 - 1));
        csv += (i+1) + ',' + p.toFixed(2) + '\n';
      }
      return csv;
    }

    var historicalCSV = makeStockCSV(100, 0.001, 200);
    var newPeriodCSV  = makeStockCSV(150, -0.001, 100);

    // TRAIN
    var hist = dsDef9.process({ source: 'csv', csvData: historicalCSV, csvColumn: 'Close', sampleRate: 1 }, {});
    assert(hist.signal.values.length === 200, 'T9: 200 historical prices loaded');
    var histWin  = winDef9.process({ windowSize: 20, overlap: 0.5, windowFunction: 'rectangular', applyWindow: false }, { signal: hist.signal });
    var histStat = staDef9.process({ includeRMS: true, includeMean: true, includeVariance: true, includeStdDev: true, includePeak: false, includeCrestFactor: false, includeZeroCrossings: false, includeEnergy: false }, { segments: histWin.segments });
    assert(histStat.features.vectors.length > 0, 'T9: ' + histStat.features.vectors.length + ' feature windows from historical data');

    var spCfg = {
      hiddenLayers: [{ neurons: 16, activation: 'relu' }],
      outputNeurons: 3, outputActivation: 'softmax',
      learningRate: 0.01, momentum: 0.9, epochs: 30, batchSize: 4,
      classNames: 'Buy,Hold,Sell', trainedNetwork: null
    };
    var trainResult = nnDef.process(spCfg, { features: histStat.features });
    assert(trainResult.predictions.items.length > 0, 'T9: NN trained — ' + trainResult.predictions.items.length + ' predictions');
    assert(spCfg.trainedNetwork !== null, 'T9: Model saved after training');
    var savedModel9 = spCfg.trainedNetwork;

    // INFER on new period
    var newData = dsDef9.process({ source: 'csv', csvData: newPeriodCSV, csvColumn: 'Close', sampleRate: 1 }, {});
    assert(newData.signal.values.length === 100, 'T9: 100 new-period prices loaded');
    var newWin  = winDef9.process({ windowSize: 20, overlap: 0.5, windowFunction: 'rectangular', applyWindow: false }, { signal: newData.signal });
    var newStat = staDef9.process({ includeRMS: true, includeMean: true, includeVariance: true, includeStdDev: true, includePeak: false, includeCrestFactor: false, includeZeroCrossings: false, includeEnergy: false }, { segments: newWin.segments });

    spCfg._runMode = 'infer';
    var inferResult = nnDef.process(spCfg, { features: newStat.features });
    assert(!inferResult.predictions.error, 'T9: infer on new data — no error');
    assert(inferResult.predictions.items.length > 0, 'T9: infer produced ' + inferResult.predictions.items.length + ' Buy/Hold/Sell signals');
    assert(spCfg.trainedNetwork === savedModel9, 'T9: same model object used — no retraining');
    var validClasses9 = ['Buy', 'Hold', 'Sell'];
    var allValid9 = inferResult.predictions.items.every(function(p) { return validClasses9.indexOf(p.className) >= 0; });
    assert(allValid9, 'T9: all infer predictions are valid (Buy/Hold/Sell)');
    console.log('  T9 complete: trained on 200-day bull run, inferred ' + inferResult.predictions.items.length + ' signals on new 100-day period');
    delete spCfg._runMode;
  } catch(e) { assert(false, 'T9 threw: ' + e.message); }

  console.log('TrainInferMode: ' + pass + ' passed, ' + fail + ' failed\n');
  return { pass: pass, fail: fail };
});

// ══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════════════════════════════════════
console.log('='.repeat(60));
console.log('TOTAL: ' + totalPass + ' passed, ' + totalFail + ' failed');
console.log('='.repeat(60));

if (totalFail > 0) {
  console.error('\nSOME TESTS FAILED');
  process.exit(1);
} else {
  console.log('\nALL TESTS PASSED');
  process.exit(0);
}
