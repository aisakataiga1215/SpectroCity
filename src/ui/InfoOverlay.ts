import { AudioData } from '../audio/AudioLoader';

export class InfoOverlay {
  private el: HTMLElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'info-overlay hidden';
    parent.appendChild(this.el);
  }

  show(audio: AudioData): void {
    const dur = audio.truncated
      ? `${formatTime(audio.durationSec)} (truncated from ${formatTime(audio.originalDurationSec)})`
      : formatTime(audio.durationSec);

    this.el.innerHTML = `
      <div class="info-overlay__filename"></div>
      <div>Duration: ${dur}</div>
      <div>Sample Rate: ${audio.sampleRate} Hz</div>
    `;
    this.el.classList.remove('hidden');
  }

  dispose(): void {
    this.el.remove();
  }
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
