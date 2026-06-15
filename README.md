# SpectroCity

Turn audio into a 3D city. Drop an audio file, get an interactive cityscape where buildings represent frequency energy over time.

## Quick Start

```bash
npm install
npm run dev
```

Open the URL in the terminal, drag an audio file into the browser.

## Build

```bash
npm run build
```

Produces a static site in `dist/` — deploy anywhere (GitHub Pages, Vercel, nginx).

## Run Tests

```bash
node scripts/test-signals.mjs
```

## How It Works

| Step | What |
|------|------|
| Drop file | Browser decodes .mp3/.wav/.flac/.ogg |
| STFT | Web Worker computes spectrogram (linear power) |
| Decimate | Merges FFT bins into log-spaced frequency bands |
| Normalize | Power → dB → dynamic range → [0, 1] |
| Layout | Adds streets, blocks, landmark towers |
| Render | Three.js InstancedMesh — single draw call |
| Export | GLTFExporter → download .glb |

## Axes

| Axis | Meaning |
|------|---------|
| X | Time |
| Y | Energy / amplitude (building height) |
| Z | Frequency / pitch band |

## Controls

**Real-time** (instant): Height Scale, Threshold, Color Mode

**Reprocess** (debounced): Time Resolution, Frequency Bands, dB Floor

## Export

Click "Export GLB" to download a `.glb` file. Opens in Blender, Windows 3D Viewer, etc.
