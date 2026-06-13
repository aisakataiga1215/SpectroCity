export interface SpectrogramData {
  data: Float32Array; // flat, row-major: [frame * numBins + bin]
  numFrames: number;
  numBins: number;
  sampleRate: number;
  durationSec: number;
  windowSize: number;
  hopSize: number;
}
