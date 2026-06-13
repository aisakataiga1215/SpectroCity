// Decimation: log-freq band merging + time frame reduction
// Operates on LINEAR POWER spectrogram (before dB conversion)

import { SpectrogramData } from './SpectrogramData';

export interface DecimatedData {
  data: Float32Array; // flat, row-major
  numTimeBins: number;
  numFreqBands: number;
}

export function decimateToLogBins(
  spectrogram: SpectrogramData,
  targetBands: number,
): DecimatedData {
  const { data, numFrames, numBins, sampleRate } = spectrogram;
  const nyquist = sampleRate / 2;

  // Generate log-spaced band edges from 20Hz to nyquist
  const minFreq = 20;
  const maxFreq = Math.min(nyquist, 20000);
  const bandEdges = new Float32Array(targetBands + 1);
  for (let i = 0; i <= targetBands; i++) {
    const t = i / targetBands;
    bandEdges[i] = minFreq * Math.pow(maxFreq / minFreq, t);
  }

  const decimated = new Float32Array(numFrames * targetBands);

  for (let frame = 0; frame < numFrames; frame++) {
    const srcRow = frame * numBins;
    const dstRow = frame * targetBands;

    for (let band = 0; band < targetBands; band++) {
      const fLow = bandEdges[band];
      const fHigh = bandEdges[band + 1];
      const binLow = Math.floor((fLow / nyquist) * (numBins - 1));
      const binHigh = Math.ceil((fHigh / nyquist) * (numBins - 1));
      const clampedLow = Math.max(0, Math.min(binLow, numBins - 1));
      const clampedHigh = Math.max(0, Math.min(binHigh, numBins - 1));

      let sum = 0;
      let count = 0;
      for (let b = clampedLow; b <= clampedHigh; b++) {
        sum += data[srcRow + b];
        count++;
      }
      decimated[dstRow + band] = count > 0 ? sum / count : 0;
    }
  }

  return {
    data: decimated,
    numTimeBins: numFrames,
    numFreqBands: targetBands,
  };
}

export function decimateTime(
  data: DecimatedData,
  targetFrames: number,
): DecimatedData {
  if (data.numTimeBins <= targetFrames) return data;

  const mergeRatio = Math.round(data.numTimeBins / targetFrames);
  if (mergeRatio <= 1) return data;

  const newFrames = Math.floor(data.numTimeBins / mergeRatio);
  const result = new Float32Array(newFrames * data.numFreqBands);

  for (let tf = 0; tf < newFrames; tf++) {
    const dstRow = tf * data.numFreqBands;

    // Average mergeRatio frames together (in linear power)
    for (let band = 0; band < data.numFreqBands; band++) {
      let sum = 0;
      for (let m = 0; m < mergeRatio; m++) {
        const srcRow = (tf * mergeRatio + m) * data.numFreqBands;
        sum += data.data[srcRow + band];
      }
      result[dstRow + band] = sum / mergeRatio;
    }
  }

  return {
    data: result,
    numTimeBins: newFrames,
    numFreqBands: data.numFreqBands,
  };
}
