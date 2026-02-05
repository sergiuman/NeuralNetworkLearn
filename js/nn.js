// =============================================================================
// NN.js - Feed-Forward Neural Network
// =============================================================================

const NeuralNetwork = (() => {

  // ─── Activation Functions ─────────────────────────────────────────────────

  const activations = {
    sigmoid: {
      fn: x => 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x)))),
      derivative: y => y * (1 - y)
    },
    tanh: {
      fn: x => Math.tanh(x),
      derivative: y => 1 - y * y
    },
    relu: {
      fn: x => Math.max(0, x),
      derivative: y => y > 0 ? 1 : 0
    },
    leakyRelu: {
      fn: x => x > 0 ? x : 0.01 * x,
      derivative: y => y > 0 ? 1 : 0.01
    },
    linear: {
      fn: x => x,
      derivative: () => 1
    },
    softplus: {
      fn: x => Math.log(1 + Math.exp(Math.min(500, x))),
      derivative: y => 1 - Math.exp(-y)
    }
  };

  function softmax(values) {
    const maxVal = Math.max(...values);
    const exps = values.map(v => Math.exp(v - maxVal));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(e => e / sum);
  }

  // ─── Network Creation ────────────────────────────────────────────────────

  function createNetwork(config) {
    const {
      inputSize,
      layers,        // Array of { neurons, activation }
      learningRate = 0.01,
      momentum = 0.9,
      weightDecay = 0.0001
    } = config;

    const network = {
      config: { ...config },
      layers: [],
      learningRate,
      momentum,
      weightDecay,
      epoch: 0,
      trainingHistory: []
    };

    let prevSize = inputSize;
    for (const layerConfig of layers) {
      const layer = {
        neurons: layerConfig.neurons,
        activation: layerConfig.activation || 'sigmoid',
        weights: [],
        biases: [],
        // For momentum
        weightMomentum: [],
        biasMomentum: []
      };

      // Xavier initialization
      const scale = Math.sqrt(2.0 / (prevSize + layerConfig.neurons));
      for (let j = 0; j < layerConfig.neurons; j++) {
        const w = [];
        const wm = [];
        for (let i = 0; i < prevSize; i++) {
          w.push((Math.random() * 2 - 1) * scale);
          wm.push(0);
        }
        layer.weights.push(w);
        layer.biases.push((Math.random() * 2 - 1) * 0.1);
        layer.weightMomentum.push(wm);
        layer.biasMomentum.push(0);
      }

      network.layers.push(layer);
      prevSize = layerConfig.neurons;
    }

    return network;
  }

  // ─── Forward Propagation ──────────────────────────────────────────────────

  function forward(network, input) {
    const layerOutputs = [input];
    let current = input;

    for (let l = 0; l < network.layers.length; l++) {
      const layer = network.layers[l];
      const isLastLayer = l === network.layers.length - 1;
      const output = [];

      for (let j = 0; j < layer.neurons; j++) {
        let sum = layer.biases[j];
        for (let i = 0; i < current.length; i++) {
          sum += current[i] * layer.weights[j][i];
        }
        output.push(sum);
      }

      // Apply activation
      if (isLastLayer && layer.activation === 'softmax') {
        current = softmax(output);
      } else {
        const actFn = activations[layer.activation] || activations.sigmoid;
        current = output.map(v => actFn.fn(v));
      }

      layerOutputs.push(current);
    }

    return { output: current, layerOutputs };
  }

  // ─── Backpropagation ──────────────────────────────────────────────────────

  function backward(network, input, target) {
    const { output, layerOutputs } = forward(network, input);

    // Calculate output layer error
    let errors = output.map((o, i) => target[i] - o);

    // Backpropagate through layers
    for (let l = network.layers.length - 1; l >= 0; l--) {
      const layer = network.layers[l];
      const layerInput = layerOutputs[l];
      const layerOutput = layerOutputs[l + 1];
      const actDeriv = activations[layer.activation]
        ? activations[layer.activation].derivative
        : activations.sigmoid.derivative;

      const gradients = errors.map((e, j) => {
        if (layer.activation === 'softmax') return e;
        return e * actDeriv(layerOutput[j]);
      });

      // Calculate errors for previous layer
      if (l > 0) {
        const prevErrors = new Array(layerInput.length).fill(0);
        for (let j = 0; j < layer.neurons; j++) {
          for (let i = 0; i < layerInput.length; i++) {
            prevErrors[i] += gradients[j] * layer.weights[j][i];
          }
        }
        errors = prevErrors;
      }

      // Update weights and biases
      for (let j = 0; j < layer.neurons; j++) {
        for (let i = 0; i < layerInput.length; i++) {
          const grad = gradients[j] * layerInput[i];
          layer.weightMomentum[j][i] = network.momentum * layer.weightMomentum[j][i]
            + network.learningRate * grad;
          layer.weights[j][i] += layer.weightMomentum[j][i]
            - network.weightDecay * layer.weights[j][i];
        }
        layer.biasMomentum[j] = network.momentum * layer.biasMomentum[j]
          + network.learningRate * gradients[j];
        layer.biases[j] += layer.biasMomentum[j];
      }
    }

    // Return loss (MSE)
    const loss = target.reduce((s, t, i) => s + (t - output[i]) ** 2, 0) / target.length;
    return { output, loss };
  }

  // ─── Training ─────────────────────────────────────────────────────────────

  function train(network, inputs, targets, epochs, batchSize, onProgress) {
    batchSize = batchSize || inputs.length;
    const history = [];

    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalLoss = 0;

      // Shuffle training data
      const indices = Array.from({ length: inputs.length }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      // Mini-batch training
      for (let b = 0; b < inputs.length; b += batchSize) {
        const batchEnd = Math.min(b + batchSize, inputs.length);
        for (let idx = b; idx < batchEnd; idx++) {
          const i = indices[idx];
          const result = backward(network, inputs[i], targets[i]);
          totalLoss += result.loss;
        }
      }

      const avgLoss = totalLoss / inputs.length;
      network.epoch++;
      history.push({ epoch: network.epoch, loss: avgLoss });

      if (onProgress && epoch % Math.max(1, Math.floor(epochs / 100)) === 0) {
        onProgress({ epoch: network.epoch, loss: avgLoss, progress: (epoch + 1) / epochs });
      }
    }

    network.trainingHistory.push(...history);
    return history;
  }

  // ─── Prediction ───────────────────────────────────────────────────────────

  function predict(network, input) {
    return forward(network, input).output;
  }

  function predictBatch(network, inputs) {
    return inputs.map(input => predict(network, input));
  }

  function classify(network, input) {
    const output = predict(network, input);
    const maxIdx = output.indexOf(Math.max(...output));
    return { output, classIndex: maxIdx, confidence: output[maxIdx] };
  }

  // ─── Serialization ────────────────────────────────────────────────────────

  function serialize(network) {
    return JSON.parse(JSON.stringify({
      config: network.config,
      layers: network.layers.map(l => ({
        neurons: l.neurons,
        activation: l.activation,
        weights: l.weights,
        biases: l.biases
      })),
      learningRate: network.learningRate,
      momentum: network.momentum,
      weightDecay: network.weightDecay,
      epoch: network.epoch,
      trainingHistory: network.trainingHistory
    }));
  }

  function deserialize(data) {
    const network = createNetwork(data.config);
    for (let l = 0; l < data.layers.length; l++) {
      network.layers[l].weights = data.layers[l].weights;
      network.layers[l].biases = data.layers[l].biases;
    }
    network.epoch = data.epoch || 0;
    network.trainingHistory = data.trainingHistory || [];
    return network;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  return {
    createNetwork,
    forward,
    backward,
    train,
    predict,
    predictBatch,
    classify,
    softmax,
    serialize,
    deserialize,
    activations: Object.keys(activations).concat(['softmax'])
  };

})();
