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

  var expectedTypes = ['dataSource', 'windowing', 'fftBlock', 'statistics', 'featureMerger', 'neuralNetwork', 'fuzzyClassifier', 'output'];

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
