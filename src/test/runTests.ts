// Browser test runner: generates synthetic audio, runs STFT, verifies results
// Run in dev mode: import and call runAllTests() from console

import {
  generateSilence,
  generateSine,
  generateSweep,
  generateImpulse,
  runManualSTFT,
  TestResult,
  verifySilence,
  verifySineRidge,
  verifyFrequencySweep,
  verifyImpulse,
} from './signals';

const WINDOW = 2048;
const SR = 44100;
const DUR = 2;

export async function runAllTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test 1: Silence
  console.log('Test 1/4: Silence...');
  const silence = generateSilence(DUR);
  const { spectrogram: spec1, numFrames: nf1, numBins: nb1 } = await runManualSTFT(silence, WINDOW, WINDOW / 4);
  results.push(verifySilence(spec1, nf1, nb1));

  // Test 2: 440Hz sine
  console.log('Test 2/4: 440Hz Sine...');
  const sine = generateSine(440, DUR);
  const { spectrogram: spec2, numFrames: nf2, numBins: nb2 } = await runManualSTFT(sine, WINDOW, WINDOW / 4);
  results.push(verifySineRidge(spec2, nf2, nb2, 440, SR, WINDOW));

  // Test 3: Frequency sweep
  console.log('Test 3/4: Frequency Sweep 100Hz→8kHz...');
  const sweep = generateSweep(100, 8000, DUR);
  const { spectrogram: spec3, numFrames: nf3, numBins: nb3 } = await runManualSTFT(sweep, WINDOW, WINDOW / 4);
  results.push(verifyFrequencySweep(spec3, nf3, nb3, 100, 8000, SR));

  // Test 4: Impulse click
  console.log('Test 4/4: Impulse Click...');
  const impulse = generateImpulse(0.5, DUR);
  const { spectrogram: spec4, numFrames: nf4, numBins: nb4 } = await runManualSTFT(impulse, WINDOW, WINDOW / 4);
  results.push(verifyImpulse(spec4, nf4, nb4));

  // Summary
  const passed = results.filter(r => r.passed).length;
  console.log(`\n=== Results: ${passed}/${results.length} passed ===`);
  for (const r of results) {
    const icon = r.passed ? 'PASS' : 'FAIL';
    console.log(`  ${icon}  ${r.name}: ${r.detail}`);
  }

  return results;
}
