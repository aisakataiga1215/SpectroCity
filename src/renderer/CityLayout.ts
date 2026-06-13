// CityLayout: transforms a normalized spectrogram into a city-like layout
// 1. Street gaps every N time bins (X direction)
// 2. Block/avenue gaps every N freq bands (Z direction)
// 3. Landmark towers at local energy peaks (>3σ)

import { NormalizedGrid } from './CityMesh';
import { STREET_INTERVAL, BLOCK_INTERVAL, LANDMARK_SIGMA } from '../utils/constants';

export interface LayoutParams {
  streetInterval: number;  // gap every N time bins
  blockInterval: number;   // gap every N freq bands
  landmarkSigma: number;   // sigma threshold for landmark towers
  landmarkHeight: number;  // multiplier for landmark buildings (e.g., 2.0)
}

const DEFAULT_LAYOUT: LayoutParams = {
  streetInterval: STREET_INTERVAL,
  blockInterval: BLOCK_INTERVAL,
  landmarkSigma: LANDMARK_SIGMA,
  landmarkHeight: 2.0,
};

export function applyCityLayout(
  grid: NormalizedGrid,
  params: Partial<LayoutParams> = {},
): NormalizedGrid {
  const p = { ...DEFAULT_LAYOUT, ...params };

  // Create a copy to avoid mutating source
  const intensities = new Float32Array(grid.intensities);

  // Step 1: Find landmarks (before inserting gaps, so peaks are detected correctly)
  const landmarks = findLandmarks(grid, p.landmarkSigma);

  // Step 2: Insert street gaps (X direction, every streetInterval time bins)
  for (let t = p.streetInterval; t < grid.numTimeBins; t += p.streetInterval) {
    for (let f = 0; f < grid.numFreqBands; f++) {
      intensities[t * grid.numFreqBands + f] = 0;
    }
  }

  // Step 3: Insert block gaps (Z direction, every blockInterval freq bands)
  for (let t = 0; t < grid.numTimeBins; t++) {
    for (let f = p.blockInterval; f < grid.numFreqBands; f += p.blockInterval) {
      intensities[t * grid.numFreqBands + f] = 0;
    }
  }

  // Step 4: Boost landmark towers
  const placed = new Set<number>();
  for (const { t, f } of landmarks) {
    // Avoid placing landmarks in gap zones
    if (t % p.streetInterval === 0) continue;
    if (f % p.blockInterval === 0) continue;
    const idx = t * grid.numFreqBands + f;
    if (placed.has(idx)) continue;
    placed.add(idx);
    intensities[idx] = Math.min(1, grid.intensities[idx] * p.landmarkHeight);
  }

  return {
    intensities,
    numTimeBins: grid.numTimeBins,
    numFreqBands: grid.numFreqBands,
  };
}

interface Cell {
  t: number;
  f: number;
  value: number;
}

function findLandmarks(grid: NormalizedGrid, sigma: number): Cell[] {
  const { intensities, numTimeBins, numFreqBands } = grid;

  // Compute mean and std of non-zero intensities
  let sum = 0;
  let count = 0;
  for (let i = 0; i < intensities.length; i++) {
    if (intensities[i] > 0) {
      sum += intensities[i];
      count++;
    }
  }
  if (count === 0) return [];
  const mean = sum / count;

  let variance = 0;
  for (let i = 0; i < intensities.length; i++) {
    if (intensities[i] > 0) {
      const d = intensities[i] - mean;
      variance += d * d;
    }
  }
  const std = Math.sqrt(variance / count);
  const threshold = mean + sigma * std;

  // Find local maxima above threshold
  const landmarks: Cell[] = [];
  for (let t = 0; t < numTimeBins; t++) {
    for (let f = 0; f < numFreqBands; f++) {
      const val = intensities[t * numFreqBands + f];
      if (val < threshold) continue;

      // Check local neighborhood (1 bin radius)
      const isPeak = isLocalPeak(grid, t, f, 1, val);
      if (isPeak) {
        landmarks.push({ t, f, value: val });
        // Skip neighbors to avoid clustering
        t++; // skip next time bin
        break;
      }
    }
  }

  return landmarks;
}

function isLocalPeak(
  grid: NormalizedGrid,
  t: number,
  f: number,
  radius: number,
  value: number,
): boolean {
  const { intensities, numTimeBins, numFreqBands } = grid;
  for (let dt = -radius; dt <= radius; dt++) {
    for (let df = -radius; df <= radius; df++) {
      if (dt === 0 && df === 0) continue;
      const nt = t + dt;
      const nf = f + df;
      if (nt < 0 || nt >= numTimeBins || nf < 0 || nf >= numFreqBands) continue;
      if (intensities[nt * numFreqBands + nf] >= value) return false;
    }
  }
  return true;
}
