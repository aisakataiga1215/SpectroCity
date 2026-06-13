// Node.js test script: validates signal generators + FFT pipeline
// Run with: node scripts/test-signals.mjs

import FFT from 'fft.js';

const SR = 44100;
const DUR = 2;
const WINDOW = 2048;

// --- Signal generators ---
function generateSilence(dur) {
  return new Float32Array(Math.floor(dur * SR));
}

function generateSine(freq, dur) {
  const len = Math.floor(dur * SR);
  const s = new Float32Array(len);
  for (let i = 0; i < len; i++) s[i] = Math.sin(2 * Math.PI * freq * i / SR);
  return s;
}

function generateSweep(startFreq, endFreq, dur) {
  const len = Math.floor(dur * SR);
  const s = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const tNorm = t / dur;
    const phase = 2 * Math.PI * (startFreq * t + 0.5 * (endFreq - startFreq) * t * t / dur);
    s[i] = Math.sin(phase);
  }
  return s;
}

function generateImpulse(posSec, dur) {
  const len = Math.floor(dur * SR);
  const s = new Float32Array(len);
  const pos = Math.floor(posSec * SR);
  if (pos < len) s[pos] = 1.0;
  return s;
}

// --- Hann window ---
function hann(len) {
  const w = new Float32Array(len);
  for (let i = 0; i < len; i++) w[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (len - 1)));
  return w;
}

// --- STFT ---
function computeSTFT(samples, windowSize, hopSize) {
  const fft = new FFT(windowSize);
  const win = hann(windowSize);
  const numFrames = Math.floor((samples.length - windowSize) / hopSize) + 1;
  const numBins = windowSize / 2 + 1;
  const spec = new Float32Array(numFrames * numBins);

  for (let frame = 0; frame < numFrames; frame++) {
    const offset = frame * hopSize;
    const complex = fft.createComplexArray();
    for (let i = 0; i < windowSize; i++) {
      complex[i * 2] = samples[offset + i] * win[i];
    }
    const out = fft.createComplexArray();
    fft.transform(out, complex);

    const row = frame * numBins;
    for (let bin = 0; bin < numBins; bin++) {
      const re = out[bin * 2];
      const im = out[bin * 2 + 1];
      spec[row + bin] = re * re + im * im;
    }
  }
  return { spectrogram: spec, numFrames, numBins };
}

// --- Verifiers ---
function verifySilence(spec, numFrames, numBins) {
  let max = 0;
  for (let i = 0; i < spec.length; i++) max = Math.max(max, spec[i]);
  return { name: 'Silence', passed: max < 1e-6, detail: `Max power = ${max.toExponential()}` };
}

function verifySineRidge(spec, numFrames, numBins, expectedFreq) {
  const expectedBin = Math.round(expectedFreq / (SR / 2) * (numBins - 1));
  let onRidge = 0;
  for (let t = 0; t < numFrames; t++) {
    const row = t * numBins;
    const peakVal = spec[row + expectedBin];
    let isMax = true;
    for (let f = 0; f < numBins; f++) {
      if (spec[row + f] > peakVal * 1.01) { isMax = false; break; }
    }
    if (isMax) onRidge++;
  }
  const ratio = onRidge / numFrames;
  return {
    name: '440Hz Sine Ridge',
    passed: ratio > 0.8,
    detail: `Ridge at bin ${expectedBin} in ${(ratio * 100).toFixed(0)}% of frames`,
  };
}

function verifySweep(spec, numFrames, numBins) {
  const peaks = [];
  for (let t = 0; t < numFrames; t++) {
    const row = t * numBins;
    let maxV = 0, maxB = 0;
    for (let f = 0; f < numBins; f++) {
      if (spec[row + f] > maxV) { maxV = spec[row + f]; maxB = f; }
    }
    peaks.push(maxB);
  }
  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (let i = 0; i < peaks.length; i++) {
    sx += i; sy += peaks[i]; sxy += i * peaks[i]; sx2 += i * i;
  }
  const n = peaks.length;
  const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
  const startBin = 100 / (SR / 2) * (numBins - 1);
  const endBin = 8000 / (SR / 2) * (numBins - 1);
  const expected = (endBin - startBin) / numFrames;
  return {
    name: 'Frequency Sweep',
    passed: Math.abs(slope - expected) < Math.abs(expected) * 0.3,
    detail: `Slope=${slope.toFixed(2)} expected≈${expected.toFixed(2)}`,
  };
}

function verifyImpulse(spec, numFrames, numBins) {
  const fe = [];
  for (let t = 0; t < numFrames; t++) {
    const row = t * numBins;
    let sum = 0;
    for (let f = 0; f < numBins; f++) sum += spec[row + f];
    fe.push(sum);
  }
  let maxE = 0, maxF = 0;
  for (let t = 0; t < fe.length; t++) {
    if (fe[t] > maxE) { maxE = fe[t]; maxF = t; }
  }
  if (maxE === 0) return { name: 'Impulse', passed: false, detail: 'No energy' };
  let near = 0, total = 0;
  for (let t = 0; t < fe.length; t++) {
    total += fe[t];
    if (Math.abs(t - maxF) <= 2) near += fe[t];
  }
  const ratio = near / total;
  return {
    name: 'Impulse Click',
    passed: ratio > 0.7,
    detail: `${(ratio * 100).toFixed(0)}% energy within ±2 frames of peak at frame ${maxF}`,
  };
}

// --- Run ---
const hopSize = WINDOW / 4;
let passed = 0, total = 0;

const signals = [
  { name: 'silence', data: generateSilence(DUR), verify: (s, nf, nb) => verifySilence(s, nf, nb) },
  { name: '440Hz sine', data: generateSine(440, DUR), verify: (s, nf, nb) => verifySineRidge(s, nf, nb, 440) },
  { name: 'sweep', data: generateSweep(100, 8000, DUR), verify: (s, nf, nb) => verifySweep(s, nf, nb) },
  { name: 'impulse', data: generateImpulse(0.5, DUR), verify: (s, nf, nb) => verifyImpulse(s, nf, nb) },
];

for (const sig of signals) {
  process.stdout.write(`${sig.name}... `);
  const { spectrogram, numFrames, numBins } = computeSTFT(sig.data, WINDOW, hopSize);
  const result = sig.verify(spectrogram, numFrames, numBins);
  total++;
  if (result.passed) passed++;
  console.log(result.passed ? 'PASS' : 'FAIL', '-', result.detail);
}

console.log(`\n${passed}/${total} tests passed`);
if (passed === total) {
  console.log('All tests passed!');
} else {
  process.exit(1);
}
