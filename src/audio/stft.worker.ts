// Web Worker: computes STFT spectrogram from PCM samples
// Uses fft.js for FFT, stores power (magnitude²) in linear scale
// Data flow: samples → windowed FFT → power → spectrogram (linear power)

import { hannWindow } from './windowFunctions';

// FFT.js imported dynamically inside the worker
let FFTClass: any = null;

async function loadFFT(): Promise<any> {
  if (FFTClass) return FFTClass;
  // In Vite workers, dynamic import resolves modules
  const mod = await import('fft.js');
  FFTClass = mod.default;
  return FFTClass;
}

interface ComputeMessage {
  type: 'compute';
  samples: Float32Array; // transferred
  sampleRate: number;
  windowSize: number; // power of 2 (e.g., 4096)
  targetFrames: number;
  progressInterval: number;
}

interface ProgressMessage {
  type: 'progress';
  frame: number;
  numFrames: number;
}

interface CompleteMessage {
  type: 'complete';
  spectrogram: Float32Array; // transferred back, linear power
  numFrames: number;
  numBins: number;
  sampleRate: number;
  durationSec: number;
  windowSize: number;
  hopSize: number;
}

type OutMessage = ProgressMessage | CompleteMessage;

self.onmessage = async (e: MessageEvent<ComputeMessage>) => {
  const { samples, sampleRate, windowSize, targetFrames, progressInterval } = e.data;

  const FFT = await loadFFT();
  const fft = new FFT(windowSize);
  const windowCoeffs = hannWindow(windowSize);

  const totalSamples = samples.length;
  const hopSize = Math.max(1, Math.floor((totalSamples - windowSize) / targetFrames));
  const numFrames = Math.floor((totalSamples - windowSize) / hopSize) + 1;
  const numBins = windowSize / 2 + 1;

  const spectrogram = new Float32Array(numFrames * numBins);
  const complex = fft.createComplexArray();
  const out = fft.createComplexArray();

  for (let frame = 0; frame < numFrames; frame++) {
    const offset = frame * hopSize;

    // Build complex array: re = windowed sample, im = 0
    for (let i = 0; i < windowSize; i++) {
      complex[i * 2] = samples[offset + i] * windowCoeffs[i];
      complex[i * 2 + 1] = 0;
    }

    fft.transform(out, complex);

    // Store power (magnitude²) for positive frequencies
    const rowOffset = frame * numBins;
    for (let bin = 0; bin < numBins; bin++) {
      const re = out[bin * 2];
      const im = out[bin * 2 + 1];
      spectrogram[rowOffset + bin] = re * re + im * im;
    }

    if (frame % progressInterval === 0) {
      self.postMessage({ type: 'progress', frame, numFrames } satisfies ProgressMessage);
    }
  }

  const msg: CompleteMessage = {
    type: 'complete',
    spectrogram,
    numFrames,
    numBins,
    sampleRate,
    durationSec: totalSamples / sampleRate,
    windowSize,
    hopSize,
  };
  self.postMessage(msg, { transfer: [spectrogram.buffer] });
};
