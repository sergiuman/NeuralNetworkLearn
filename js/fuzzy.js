// =============================================================================
// Fuzzy.js - Fuzzy Logic Classifier
// =============================================================================

const FuzzyLogic = (() => {

  // ─── Membership Functions ─────────────────────────────────────────────────

  const membershipFunctions = {
    triangular(x, a, b, c) {
      if (x <= a || x >= c) return 0;
      if (x <= b) return (x - a) / (b - a);
      return (c - x) / (c - b);
    },

    trapezoidal(x, a, b, c, d) {
      if (x <= a || x >= d) return 0;
      if (x >= b && x <= c) return 1;
      if (x < b) return (x - a) / (b - a);
      return (d - x) / (d - c);
    },

    gaussian(x, center, sigma) {
      return Math.exp(-0.5 * ((x - center) / sigma) ** 2);
    },

    bell(x, a, b, c) {
      return 1 / (1 + Math.abs((x - c) / a) ** (2 * b));
    },

    sigmoid(x, a, c) {
      return 1 / (1 + Math.exp(-a * (x - c)));
    },

    leftShoulder(x, a, b) {
      if (x <= a) return 1;
      if (x >= b) return 0;
      return (b - x) / (b - a);
    },

    rightShoulder(x, a, b) {
      if (x <= a) return 0;
      if (x >= b) return 1;
      return (x - a) / (b - a);
    }
  };

  // ─── Fuzzy Set ────────────────────────────────────────────────────────────

  function createFuzzySet(name, mfType, params) {
    return {
      name,
      mfType,
      params,
      evaluate(x) {
        const fn = membershipFunctions[mfType];
        if (!fn) return 0;
        return fn(x, ...params);
      }
    };
  }

  // ─── Fuzzy Variable ──────────────────────────────────────────────────────

  function createFuzzyVariable(name, range, sets) {
    return {
      name,
      range, // [min, max]
      sets,  // Array of fuzzy sets
      fuzzify(value) {
        const result = {};
        for (const set of sets) {
          result[set.name] = set.evaluate(value);
        }
        return result;
      }
    };
  }

  // ─── Fuzzy Rule ───────────────────────────────────────────────────────────

  function createRule(conditions, output, weight) {
    return {
      conditions, // Array of { variable, set } or { variable, set, not: true }
      output,     // { variable, set }
      weight: weight || 1.0
    };
  }

  // ─── Fuzzy Inference System ───────────────────────────────────────────────

  function createFIS(config) {
    const {
      name = 'FIS',
      type = 'mamdani', // or 'sugeno'
      andMethod = 'min',  // or 'product'
      orMethod = 'max',   // or 'probor'
      defuzzMethod = 'centroid', // or 'bisector', 'mom', 'som', 'lom'
      inputVariables = [],
      outputVariables = [],
      rules = []
    } = config;

    const fis = {
      name, type, andMethod, orMethod, defuzzMethod,
      inputVariables, outputVariables, rules
    };

    return fis;
  }

  // ─── Fuzzy Operations ────────────────────────────────────────────────────

  function fuzzyAnd(values, method) {
    if (method === 'product') {
      return values.reduce((a, b) => a * b, 1);
    }
    return Math.min(...values); // min
  }

  function fuzzyOr(values, method) {
    if (method === 'probor') {
      return values.reduce((a, b) => a + b - a * b, 0);
    }
    return Math.max(...values); // max
  }

  function fuzzyNot(value) {
    return 1 - value;
  }

  // ─── Evaluate FIS ────────────────────────────────────────────────────────

  function evaluate(fis, inputs) {
    // Step 1: Fuzzify inputs
    const fuzzified = {};
    for (const variable of fis.inputVariables) {
      const value = inputs[variable.name];
      if (value !== undefined) {
        fuzzified[variable.name] = variable.fuzzify(value);
      }
    }

    // Step 2: Evaluate rules
    const ruleOutputs = [];
    for (const rule of fis.rules) {
      // Evaluate antecedent
      const membershipValues = [];
      for (const cond of rule.conditions) {
        const varFuzz = fuzzified[cond.variable];
        if (!varFuzz) continue;
        let mv = varFuzz[cond.set] || 0;
        if (cond.not) mv = fuzzyNot(mv);
        membershipValues.push(mv);
      }

      if (membershipValues.length === 0) continue;

      const strength = fuzzyAnd(membershipValues, fis.andMethod) * rule.weight;
      if (strength > 0) {
        ruleOutputs.push({
          output: rule.output,
          strength
        });
      }
    }

    // Step 3: Aggregate and defuzzify
    const results = {};
    for (const outVar of fis.outputVariables) {
      const relevantRules = ruleOutputs.filter(r => r.output.variable === outVar.name);

      if (fis.type === 'sugeno') {
        results[outVar.name] = defuzzifySugeno(relevantRules, outVar);
      } else {
        results[outVar.name] = defuzzifyMamdani(relevantRules, outVar, fis.defuzzMethod);
      }
    }

    return results;
  }

  // ─── Defuzzification ─────────────────────────────────────────────────────

  function defuzzifyMamdani(ruleOutputs, outputVar, method) {
    const [min, max] = outputVar.range;
    const resolution = 100;
    const step = (max - min) / resolution;

    // Build aggregated output membership function
    const aggregated = [];
    for (let i = 0; i <= resolution; i++) {
      const x = min + i * step;
      let maxMembership = 0;

      for (const rule of ruleOutputs) {
        const set = outputVar.sets.find(s => s.name === rule.output.set);
        if (!set) continue;
        const clipped = Math.min(rule.strength, set.evaluate(x));
        maxMembership = Math.max(maxMembership, clipped);
      }

      aggregated.push({ x, membership: maxMembership });
    }

    // Defuzzify
    switch (method) {
      case 'centroid':
        return defuzzCentroid(aggregated);
      case 'bisector':
        return defuzzBisector(aggregated);
      case 'mom': // Mean of Maximum
        return defuzzMOM(aggregated);
      case 'som': // Smallest of Maximum
        return defuzzSOM(aggregated);
      case 'lom': // Largest of Maximum
        return defuzzLOM(aggregated);
      default:
        return defuzzCentroid(aggregated);
    }
  }

  function defuzzCentroid(aggregated) {
    let num = 0, den = 0;
    for (const p of aggregated) {
      num += p.x * p.membership;
      den += p.membership;
    }
    return den === 0 ? 0 : num / den;
  }

  function defuzzBisector(aggregated) {
    const totalArea = aggregated.reduce((s, p) => s + p.membership, 0);
    let cumArea = 0;
    for (const p of aggregated) {
      cumArea += p.membership;
      if (cumArea >= totalArea / 2) return p.x;
    }
    return aggregated[aggregated.length - 1]?.x || 0;
  }

  function defuzzMOM(aggregated) {
    const maxMem = Math.max(...aggregated.map(p => p.membership));
    if (maxMem === 0) return 0;
    const maxPoints = aggregated.filter(p => Math.abs(p.membership - maxMem) < 1e-10);
    return maxPoints.reduce((s, p) => s + p.x, 0) / maxPoints.length;
  }

  function defuzzSOM(aggregated) {
    const maxMem = Math.max(...aggregated.map(p => p.membership));
    if (maxMem === 0) return 0;
    const first = aggregated.find(p => Math.abs(p.membership - maxMem) < 1e-10);
    return first ? first.x : 0;
  }

  function defuzzLOM(aggregated) {
    const maxMem = Math.max(...aggregated.map(p => p.membership));
    if (maxMem === 0) return 0;
    const maxPoints = aggregated.filter(p => Math.abs(p.membership - maxMem) < 1e-10);
    return maxPoints[maxPoints.length - 1]?.x || 0;
  }

  function defuzzifySugeno(ruleOutputs, outputVar) {
    let num = 0, den = 0;
    for (const rule of ruleOutputs) {
      const set = outputVar.sets.find(s => s.name === rule.output.set);
      const value = set ? set.params[0] : 0; // Sugeno: constant or linear output
      num += rule.strength * value;
      den += rule.strength;
    }
    return den === 0 ? 0 : num / den;
  }

  // ─── Preset Classifiers ──────────────────────────────────────────────────

  function createThresholdClassifier(config) {
    const {
      inputName = 'input',
      outputName = 'class',
      classes = [],
      thresholds = []
    } = config;

    // Auto-generate fuzzy sets from thresholds
    const inputSets = [];
    const outputSets = [];
    const rules = [];
    const inputRange = [
      Math.min(...thresholds, 0),
      Math.max(...thresholds, 1)
    ];
    const margin = (inputRange[1] - inputRange[0]) * 0.3;
    inputRange[0] -= margin;
    inputRange[1] += margin;

    for (let i = 0; i < classes.length; i++) {
      const className = classes[i];

      // Create input fuzzy sets
      if (i === 0) {
        inputSets.push(createFuzzySet(className, 'leftShoulder', [
          inputRange[0], thresholds[0] || inputRange[1]
        ]));
      } else if (i === classes.length - 1) {
        inputSets.push(createFuzzySet(className, 'rightShoulder', [
          thresholds[i - 1] || inputRange[0], inputRange[1]
        ]));
      } else {
        const center = thresholds[i - 1] || 0;
        const width = (thresholds[i] - thresholds[i - 1]) / 2 || 0.5;
        inputSets.push(createFuzzySet(className, 'triangular', [
          center - width, center + width / 2, center + width * 2
        ]));
      }

      // Create output fuzzy sets (evenly distributed)
      const outStep = 1 / (classes.length - 1 || 1);
      const outCenter = i * outStep;
      outputSets.push(createFuzzySet(className, 'triangular', [
        outCenter - outStep, outCenter, outCenter + outStep
      ]));

      // Create rule
      rules.push(createRule(
        [{ variable: inputName, set: className }],
        { variable: outputName, set: className }
      ));
    }

    const inputVar = createFuzzyVariable(inputName, inputRange, inputSets);
    const outputVar = createFuzzyVariable(outputName, [0, 1], outputSets);

    return createFIS({
      name: 'ThresholdClassifier',
      inputVariables: [inputVar],
      outputVariables: [outputVar],
      rules
    });
  }

  // ─── Multi-input classifier helper ────────────────────────────────────────

  function createMultiInputClassifier(config) {
    const {
      inputs = [],    // [{ name, range, sets: [{ name, type, params }] }]
      outputs = [],   // [{ name, range, sets: [{ name, type, params }] }]
      rules = []      // [{ conditions: [{ variable, set }], output: { variable, set }, weight }]
    } = config;

    const inputVariables = inputs.map(inp =>
      createFuzzyVariable(inp.name, inp.range,
        inp.sets.map(s => createFuzzySet(s.name, s.type, s.params))
      )
    );

    const outputVariables = outputs.map(out =>
      createFuzzyVariable(out.name, out.range,
        out.sets.map(s => createFuzzySet(s.name, s.type, s.params))
      )
    );

    return createFIS({
      name: config.name || 'MultiInputClassifier',
      inputVariables,
      outputVariables,
      rules: rules.map(r => createRule(r.conditions, r.output, r.weight))
    });
  }

  // ─── Classify with label output ───────────────────────────────────────────

  function classifyWithLabels(fis, inputs, classLabels) {
    const results = evaluate(fis, inputs);
    const output = {};

    for (const [varName, value] of Object.entries(results)) {
      const outVar = fis.outputVariables.find(v => v.name === varName);
      if (!outVar) continue;

      // Find which fuzzy set has highest membership for this output value
      let bestSet = null;
      let bestMembership = -1;
      for (const set of outVar.sets) {
        const m = set.evaluate(value);
        if (m > bestMembership) {
          bestMembership = m;
          bestSet = set.name;
        }
      }

      output[varName] = {
        value,
        label: classLabels ? (classLabels[bestSet] || bestSet) : bestSet,
        confidence: bestMembership,
        allMemberships: Object.fromEntries(
          outVar.sets.map(s => [s.name, s.evaluate(value)])
        )
      };
    }

    return output;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  return {
    membershipFunctions,
    createFuzzySet,
    createFuzzyVariable,
    createRule,
    createFIS,
    evaluate,
    fuzzyAnd,
    fuzzyOr,
    fuzzyNot,
    createThresholdClassifier,
    createMultiInputClassifier,
    classifyWithLabels,
    membershipTypes: Object.keys(membershipFunctions)
  };

})();
