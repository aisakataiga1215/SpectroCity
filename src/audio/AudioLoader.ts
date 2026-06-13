import { MAX_DURATION_SEC } from '../utils/constants';

export interface AudioData {
  samples: Float32Array;
  sampleRate: number;
  durationSec: number;
  originalDurationSec: number;
  truncated: boolean;
}

export async function loadAudioFile(file: File): Promise<AudioData> {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const audioCtx = createAudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const originalDuration = audioBuffer.duration;

  // Downmix to mono: average all channels
  const channelData: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channelData.push(audioBuffer.getChannelData(c));
  }

  const totalSamples = originalDuration * sampleRate;
  const maxSamples = Math.min(totalSamples, MAX_DURATION_SEC * sampleRate);
  const cappedSamples = Math.floor(maxSamples);

  const monoSamples = new Float32Array(cappedSamples);
  for (let i = 0; i < cappedSamples; i++) {
    let sum = 0;
    for (let c = 0; c < numChannels; c++) {
      sum += channelData[c][i];
    }
    monoSamples[i] = sum / numChannels;
  }

  // Close the non-lazy AudioContext to free resources
  audioCtx.close();

  return {
    samples: monoSamples,
    sampleRate,
    durationSec: Math.min(originalDuration, MAX_DURATION_SEC),
    originalDurationSec: originalDuration,
    truncated: originalDuration > MAX_DURATION_SEC,
  };
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

function createAudioContext(): AudioContext {
  return new AudioContext();
}
