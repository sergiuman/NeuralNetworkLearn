/**
 * microphone.js
 * Web Audio API wrapper for real-time microphone input capture.
 *
 * Exposes a global `MicrophoneInput` object with methods for starting/stopping
 * capture, querying state, and collecting buffered samples.
 *
 * Browser compatibility:
 *   - Chrome, Firefox, Edge (modern)
 *   - Safari (via webkitAudioContext fallback)
 *   - Uses ScriptProcessorNode (deprecated but widely supported)
 */

(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // AudioContext cross-browser shim
  // ---------------------------------------------------------------------------
  const AudioContext = window.AudioContext || window.webkitAudioContext;

  // ---------------------------------------------------------------------------
  // Internal state
  // ---------------------------------------------------------------------------

  /**
   * Singleton state object. All fields are reset on stop().
   * @type {Object}
   */
  let state = {
    active: false,          // Whether capture is currently running
    audioContext: null,     // The Web Audio AudioContext instance
    stream: null,           // MediaStream from getUserMedia
    source: null,           // MediaStreamAudioSourceNode
    processor: null,        // ScriptProcessorNode that receives raw PCM data
    sampleRate: 44100,      // Detected sample rate (populated after start())
    accumulator: [],        // Ring buffer accumulating incoming samples
    targetSize: 4096,       // Number of samples to collect before calling onData
    onData: null,           // Callback: (Float32Array) => void
    onError: null           // Callback: (Error) => void
  };

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Safely invokes the onError callback (if set) with a given error.
   * Also resets active state so callers know capture has stopped.
   *
   * @param {Error|string} err
   */
  function _reportError(err) {
    const error = err instanceof Error ? err : new Error(String(err));
    state.active = false;
    if (typeof state.onError === 'function') {
      state.onError(error);
    } else {
      // Surface silently to the console when no handler is registered.
      console.error('[MicrophoneInput]', error);
    }
  }

  /**
   * Resets all mutable state back to initial values.
   * Does NOT close the AudioContext here — that is done by stop() explicitly
   * so that consumers can call stop() from within an onData callback safely.
   */
  function _resetState() {
    state.active     = false;
    state.stream     = null;
    state.source     = null;
    state.processor  = null;
    state.accumulator = [];
    state.onData     = null;
    state.onError    = null;
    // Keep sampleRate: useful to read via getSampleRate() even after stop().
  }

  /**
   * Disconnects and tears down all Audio nodes, stops media tracks, and
   * closes the AudioContext. Called internally by stop().
   */
  function _teardown() {
    // Disconnect the ScriptProcessorNode first to stop onaudioprocess events.
    if (state.processor) {
      try { state.processor.disconnect(); } catch (_) {}
      state.processor.onaudioprocess = null;
    }

    // Disconnect the source node from the graph.
    if (state.source) {
      try { state.source.disconnect(); } catch (_) {}
    }

    // Stop all media tracks to release the microphone hardware.
    if (state.stream) {
      try {
        state.stream.getTracks().forEach(function (track) { track.stop(); });
      } catch (_) {}
    }

    // Close the AudioContext to release system audio resources.
    if (state.audioContext) {
      try {
        // close() returns a Promise; we fire-and-forget here.
        state.audioContext.close();
      } catch (_) {}
      state.audioContext = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Starts microphone capture.
   *
   * @param {Object}   [options]
   * @param {number}   [options.bufferSize=4096] - Number of samples to collect
   *                    before invoking onData. This is the logical window size,
   *                    independent of the ScriptProcessorNode's internal buffer.
   * @param {Function} [options.onData]  - Called with a Float32Array of
   *                    `bufferSize` samples each time the window fills.
   * @param {Function} [options.onError] - Called with an Error on any failure.
   */
  function start(options) {
    options = options || {};

    // Prevent double-start.
    if (state.active) {
      console.warn('[MicrophoneInput] Already active. Call stop() first.');
      return;
    }

    // Store callbacks before async work so _reportError can use them.
    state.onData   = typeof options.onData  === 'function' ? options.onData  : null;
    state.onError  = typeof options.onError === 'function' ? options.onError : null;
    state.targetSize = (typeof options.bufferSize === 'number' && options.bufferSize > 0)
      ? Math.floor(options.bufferSize)
      : 4096;

    // Guard: getUserMedia must be available.
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      _reportError(new Error(
        'navigator.mediaDevices.getUserMedia is not available. ' +
        'Ensure the page is served over HTTPS and the browser supports the Media Devices API.'
      ));
      return;
    }

    // Guard: AudioContext must be available.
    if (!AudioContext) {
      _reportError(new Error('Web Audio API (AudioContext) is not supported in this browser.'));
      return;
    }

    // Request microphone access, then wire up the audio graph.
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(function (stream) {
        try {
          // ----------------------------------------------------------------
          // 1. Create AudioContext
          // ----------------------------------------------------------------
          state.audioContext = new AudioContext();
          state.sampleRate   = state.audioContext.sampleRate;

          // ----------------------------------------------------------------
          // 2. Create MediaStreamSource from the live microphone stream
          // ----------------------------------------------------------------
          state.stream = stream;
          state.source = state.audioContext.createMediaStreamSource(stream);

          // ----------------------------------------------------------------
          // 3. Create ScriptProcessorNode
          //
          //    bufferSize argument: 4096 samples per onaudioprocess callback.
          //    This is the Web Audio internal chunk size and is separate from
          //    the logical window size (state.targetSize) that the caller
          //    requested.  We accumulate chunks until targetSize is reached.
          //
          //    inputChannels=1 (mono mic), outputChannels=1 (passthrough).
          // ----------------------------------------------------------------
          const processorBufferSize = 4096;
          state.processor = state.audioContext.createScriptProcessor(
            processorBufferSize, // internal buffer size
            1,                   // input channels
            1                    // output channels
          );

          // ----------------------------------------------------------------
          // 4. onaudioprocess — the hot path for PCM sample accumulation
          // ----------------------------------------------------------------
          state.processor.onaudioprocess = function (event) {
            if (!state.active) return;

            // getChannelData(0) gives us a Float32Array of the mono channel.
            const channelData = event.inputBuffer.getChannelData(0);

            // Push all incoming samples into the accumulator.
            for (let i = 0; i < channelData.length; i++) {
              state.accumulator.push(channelData[i]);
            }

            // While we have at least targetSize samples, emit windows.
            while (state.accumulator.length >= state.targetSize) {
              // Slice exactly targetSize samples off the front.
              const window = state.accumulator.splice(0, state.targetSize);
              const buffer = new Float32Array(window);

              // Snapshot the latest buffer for getLatestBuffer().
              MicrophoneInput._latestBuffer = buffer;

              if (typeof state.onData === 'function') {
                try {
                  state.onData(buffer);
                } catch (cbErr) {
                  // Don't let a user callback crash the audio thread.
                  console.error('[MicrophoneInput] onData callback threw:', cbErr);
                }
              }
            }
          };

          // ----------------------------------------------------------------
          // 5. Connect the audio graph:
          //    source -> processor -> destination
          //
          //    The processor must be connected to the destination for
          //    onaudioprocess to fire in all browsers (Chrome quirk).
          // ----------------------------------------------------------------
          state.source.connect(state.processor);
          state.processor.connect(state.audioContext.destination);

          state.active = true;

        } catch (setupErr) {
          // Clean up any partially constructed resources.
          _teardown();
          _resetState();
          _reportError(setupErr);
        }
      })
      .catch(function (getUserMediaErr) {
        // getUserMedia was denied or failed (e.g. NotAllowedError).
        _resetState();
        _reportError(getUserMediaErr);
      });
  }

  /**
   * Stops microphone capture, disconnects all nodes, releases the microphone,
   * and closes the AudioContext.
   */
  function stop() {
    if (!state.active && !state.audioContext) {
      // Nothing is running; nothing to do.
      return;
    }

    _teardown();
    _resetState();
  }

  /**
   * Returns whether microphone capture is currently active.
   *
   * @returns {boolean}
   */
  function isActive() {
    return state.active === true;
  }

  /**
   * Returns the sample rate detected from the AudioContext after start().
   * Falls back to 44100 if capture has not been started yet.
   *
   * @returns {number}
   */
  function getSampleRate() {
    return state.sampleRate || 44100;
  }

  /**
   * Returns the most recent Float32Array of samples delivered to onData,
   * or null if no data has been captured yet.
   *
   * @returns {Float32Array|null}
   */
  function getLatestBuffer() {
    return MicrophoneInput._latestBuffer || null;
  }

  /**
   * Captures exactly `size` samples from the microphone and resolves with
   * a Float32Array containing those samples.
   *
   * Internally calls start() and stop() automatically.
   *
   * @param {number} size - Number of samples to capture.
   * @returns {Promise<Float32Array>}
   */
  function captureBuffer(size) {
    return new Promise(function (resolve, reject) {
      if (typeof size !== 'number' || size <= 0) {
        return reject(new Error('captureBuffer: `size` must be a positive number.'));
      }

      // Prevent capturing while already active.
      if (state.active) {
        return reject(new Error(
          'captureBuffer: MicrophoneInput is already active. Call stop() before captureBuffer().'
        ));
      }

      start({
        bufferSize: Math.floor(size),

        onData: function (buffer) {
          // Received the requested number of samples — stop and resolve.
          stop();
          resolve(buffer);
        },

        onError: function (err) {
          // Propagate any capture error as a rejection.
          reject(err);
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Module export
  // ---------------------------------------------------------------------------

  /**
   * @namespace MicrophoneInput
   */
  const MicrophoneInput = {
    start:           start,
    stop:            stop,
    isActive:        isActive,
    getSampleRate:   getSampleRate,
    getLatestBuffer: getLatestBuffer,
    captureBuffer:   captureBuffer,

    // Internal: stores the most recent buffer for getLatestBuffer().
    // Prefixed with underscore to signal it is not part of the public API.
    _latestBuffer: null
  };

  // Attach to the global scope (window in browsers).
  global.MicrophoneInput = MicrophoneInput;

}(typeof window !== 'undefined' ? window : this));
