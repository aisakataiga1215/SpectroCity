// Normalizer: linear power → dB → clamp → normalize [0,1]
// Operates on DECIMATED data (already log-binned and time-decimated)

import { DecimatedData } from './Decimator';

export function toDecibels(data: Float32Array, minDb: number, maxDb: number): void {
  for (let i = 0; i < data.length; i++) {
    const power = Math.max(data[i], 1e-12);
    const db = 10 * Math.log10(power);
    data[i] = Math.max(minDb, Math.min(maxDb, db));
  }
}

export function normalizeToRange(data: Float32Array, minDb: number, maxDb: number): void {
  const range = maxDb - minDb;
  for (let i = 0; i < data.length; i++) {
    data[i] = (data[i] - minDb) / range;
  }
}

export function processNorm(
  decimated: DecimatedData,
  minDb: number,
  maxDb: number,
): DecimatedData {
  // Operate on a copy to avoid mutating the source
  const data = new Float32Array(decimated.data);
  toDecibels(data, minDb, maxDb);
  normalizeToRange(data, minDb, maxDb);
  return {
    data,
    numTimeBins: decimated.numTimeBins,
    numFreqBands: decimated.numFreqBands,
  };
}
