// Thin wrapper around fft.js to provide a TypedArray-friendly interface
// fft.js uses regular JS arrays internally, so we convert at the boundary

let FFTClass: any = null;

async function ensureFFT(): Promise<any> {
  if (FFTClass) return FFTClass;
  // Vite bundles CJS modules; the default export is the FFT constructor
  const mod = await import('fft.js');
  FFTClass = mod.default;
  return FFTClass;
}

export interface FFTInstance {
  transform(output: number[], input: number[]): void;
  createComplexArray(): number[];
  fromComplexArray(complex: number[], storage?: number[]): number[];
  completeSpectrum(spectrum: number[]): void;
}

export async function createFFT(size: number): Promise<FFTInstance> {
  const Ctor = await ensureFFT();
  return new Ctor(size);
}

export function fftMagnitudes(fft: FFTInstance, real: Float32Array): Float32Array {
  const complex = fft.createComplexArray();
  // Populate interleaved complex array: [re, im, re, im, ...]
  for (let i = 0; i < real.length; i++) {
    complex[i * 2] = real[i];
    complex[i * 2 + 1] = 0;
  }
  const out = fft.createComplexArray();
  fft.transform(out, complex);

  const numBins = real.length / 2 + 1;
  const mags = new Float32Array(numBins);
  for (let i = 0; i < numBins; i++) {
    const re = out[i * 2];
    const im = out[i * 2 + 1];
    mags[i] = Math.sqrt(re * re + im * im);
  }
  return mags;
}
