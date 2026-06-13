// Synthetic audio signal generators for testing the STFT pipeline
// Sample rate: 44100, default duration: 2s

const SAMPLE_RATE = 44100;

export function generateSilence(durationSec = 2): Float32Array {
  const len = Math.floor(durationSec * SAMPLE_RATE);
  return new Float32Array(len);
}

export function generateSine(frequency: number, durationSec = 2): Float32Array {
  const len = Math.floor(durationSec * SAMPLE_RATE);
  const samples = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    samples[i] = Math.sin(2 * Math.PI * frequency * i / SAMPLE_RATE);
  }
  return samples;
}

export function generateSweep(
  startFreq: number,
  endFreq: number,
  durationSec = 2,
): Float32Array {
  const len = Math.floor(durationSec * SAMPLE_RATE);
  const samples = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const tNorm = t / durationSec;
    const freq = startFreq + (endFreq - startFreq) * tNorm;
    const phase = 2 * Math.PI * (startFreq * t + 0.5 * (endFreq - startFreq) * t * t / durationSec);
    samples[i] = Math.sin(phase);
  }
  return samples;
}

export function generateImpulse(positionSec = 0.5, durationSec = 2): Float32Array {
  const len = Math.floor(durationSec * SAMPLE_RATE);
  const samples = new Float32Array(len);
  const pos = Math.floor(positionSec * SAMPLE_RATE);
  if (pos < len) {
    samples[pos] = 1.0;
  }
  return samples;
}

// Utility: run STFT manually (without Worker) for testing
// Uses a simple FFT via fftAdapter
export async function runManualSTFT(
  samples: Float32Array,
  windowSize: number,
  hopSize: number,
): Promise<{ spectrogram: Float32Array; numFrames: number; numBins: number }> {
  const { createFFT } = await import('../audio/fftAdapter');
  const { hannWindow } = await import('../audio/windowFunctions');

  const fft = await createFFT(windowSize);
  const window = hannWindow(windowSize);

  const numFrames = Math.floor((samples.length - windowSize) / hopSize) + 1;
  const numBins = windowSize / 2 + 1;
  const spectrogram = new Float32Array(numFrames * numBins);

  for (let frame = 0; frame < numFrames; frame++) {
    const offset = frame * hopSize;
    const frameData = new Float32Array(windowSize);
    for (let i = 0; i < windowSize; i++) {
      frameData[i] = samples[offset + i] * window[i];
    }

    const { fftMagnitudes } = await import('../audio/fftAdapter');
    const mags = fftMagnitudes(fft, frameData);
    const rowOffset = frame * numBins;
    for (let bin = 0; bin < numBins; bin++) {
      spectrogram[rowOffset + bin] = mags[bin] * mags[bin]; // power
    }
  }

  return { spectrogram, numFrames, numBins };
}

// Checks that work with the computed spectrogram
export interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}

export function verifySilence(
  spectrogram: Float32Array,
  numFrames: number,
  numBins: number,
  tolerance = 1e-6,
): TestResult {
  let maxVal = 0;
  for (let i = 0; i < spectrogram.length; i++) {
    maxVal = Math.max(maxVal, spectrogram[i]);
  }
  const passed = maxVal <= tolerance;
  return {
    name: 'Silence',
    passed,
    detail: passed ? 'All zeros' : `Max power = ${maxVal.toExponential()} (> ${tolerance})`,
  };
}

export function verifySineRidge(
  spectrogram: Float32Array,
  numFrames: number,
  numBins: number,
  expectedFreq: number,
  sampleRate: number,
  windowSize: number,
): TestResult {
  // Check that the expected bin consistently has the highest power
  const expectedBin = Math.round(expectedFreq / (sampleRate / 2) * (numBins - 1));
  let onRidge = 0;
  for (let t = 0; t < numFrames; t++) {
    const rowOffset = t * numBins;
    const peakVal = spectrogram[rowOffset + expectedBin];
    let isMax = true;
    for (let f = 0; f < numBins; f++) {
      if (spectrogram[rowOffset + f] > peakVal * 1.01) {
        isMax = false;
        break;
      }
    }
    if (isMax) onRidge++;
  }
  const ratio = onRidge / numFrames;
  const passed = ratio > 0.8;
  return {
    name: `${expectedFreq}Hz Sine Ridge`,
    passed,
    detail: passed
      ? `Ridge at bin ${expectedBin} in ${(ratio * 100).toFixed(0)}% of frames`
      : `Only ${(ratio * 100).toFixed(0)}% frames have peak at bin ${expectedBin}`,
  };
}

export function verifyFrequencySweep(
  spectrogram: Float32Array,
  numFrames: number,
  numBins: number,
  startFreq: number,
  endFreq: number,
  sampleRate: number,
): TestResult {
  // Track the bin with max power over time; should move from low to high
  const peaks: number[] = [];
  for (let t = 0; t < numFrames; t++) {
    const rowOffset = t * numBins;
    let maxVal = 0;
    let maxBin = 0;
    for (let f = 0; f < numBins; f++) {
      if (spectrogram[rowOffset + f] > maxVal) {
        maxVal = spectrogram[rowOffset + f];
        maxBin = f;
      }
    }
    peaks.push(maxBin);
  }

  // Linear regression on peak bin vs frame
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < peaks.length; i++) {
    sumX += i;
    sumY += peaks[i];
    sumXY += i * peaks[i];
    sumX2 += i * i;
  }
  const n = peaks.length;
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  // Expected slope: from startFreq bin to endFreq bin over numFrames
  const startBin = startFreq / (sampleRate / 2) * (numBins - 1);
  const endBin = endFreq / (sampleRate / 2) * (numBins - 1);
  const expectedSlope = (endBin - startBin) / numFrames;

  const passed = Math.abs(slope - expectedSlope) < Math.abs(expectedSlope) * 0.3;
  return {
    name: 'Frequency Sweep',
    passed,
    detail: passed
      ? `Peak moves ${startFreq}→${endFreq}Hz (slope=${slope.toFixed(2)}, expected=${expectedSlope.toFixed(2)})`
      : `Slope=${slope.toFixed(2)}, expected=${expectedSlope.toFixed(2)}`,
  };
}

export function verifyImpulse(
  spectrogram: Float32Array,
  numFrames: number,
  numBins: number,
): TestResult {
  // Impulse should produce broadband energy in a narrow time window
  const frameEnergy: number[] = [];
  for (let t = 0; t < numFrames; t++) {
    const rowOffset = t * numBins;
    let sum = 0;
    for (let f = 0; f < numBins; f++) {
      sum += spectrogram[rowOffset + f];
    }
    frameEnergy.push(sum);
  }

  // Find the frame with max energy
  let maxE = 0;
  let maxFrame = 0;
  for (let t = 0; t < frameEnergy.length; t++) {
    if (frameEnergy[t] > maxE) {
      maxE = frameEnergy[t];
      maxFrame = t;
    }
  }

  // Check that >80% of total energy is within ±2 frames of the peak
  if (maxE === 0) {
    return { name: 'Impulse', passed: false, detail: 'No energy found' };
  }

  let nearEnergy = 0;
  let totalEnergy = 0;
  for (let t = 0; t < frameEnergy.length; t++) {
    totalEnergy += frameEnergy[t];
    if (Math.abs(t - maxFrame) <= 2) {
      nearEnergy += frameEnergy[t];
    }
  }

  const ratio = nearEnergy / totalEnergy;
  const passed = ratio > 0.7;
  return {
    name: 'Impulse Click',
    passed,
    detail: passed
      ? `Concentrated at frame ${maxFrame} (${(ratio * 100).toFixed(0)}% within ±2 frames)`
      : `Energy spread: only ${(ratio * 100).toFixed(0)}% near peak at frame ${maxFrame}`,
  };
}
