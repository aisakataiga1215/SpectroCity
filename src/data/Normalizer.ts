// Normalizer: linear power → dB → dynamic percentile range → normalize [0,1]

import { DecimatedData } from './Decimator';

function toDecibels(data: Float32Array): Float32Array {
  const result = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const power = Math.max(data[i], 1e-12);
    result[i] = 10 * Math.log10(power);
  }
  return result;
}

function percentile(sorted: Float32Array, p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.round((sorted.length - 1) * p);
  return sorted[idx];
}

export function processNorm(
  decimated: DecimatedData,
  minDb: number,
  _maxDb: number,
): DecimatedData {
  const dbValues = toDecibels(decimated.data);

  const sorted = new Float32Array(dbValues);
  sorted.sort();

  const ceiling = percentile(sorted, 0.98);  // top 2% clipped, not a fixed 0
  const floor = Math.max(minDb, percentile(sorted, 0.01));

  const range = ceiling - floor;
  if (range <= 0) {
    return {
      data: new Float32Array(decimated.data.length),
      numTimeBins: decimated.numTimeBins,
      numFreqBands: decimated.numFreqBands,
    };
  }

  const normalized = new Float32Array(dbValues.length);
  for (let i = 0; i < normalized.length; i++) {
    normalized[i] = Math.max(0, Math.min(1, (dbValues[i] - floor) / range));
  }

  return {
    data: normalized,
    numTimeBins: decimated.numTimeBins,
    numFreqBands: decimated.numFreqBands,
  };
}
