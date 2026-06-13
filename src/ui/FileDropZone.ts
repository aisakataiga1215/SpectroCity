import { bus } from '../utils/EventBus';

export class FileDropZone {
  private el: HTMLElement;
  private input: HTMLInputElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'drop-zone idle';
    this.el.innerHTML = `
      <div class="drop-zone__icon">🎧</div>
      <div>Drop an audio file here</div>
      <div class="drop-zone__text">.mp3 .wav .ogg .flac .m4a</div>
    `;
    parent.appendChild(this.el);

    this.input = document.createElement('input');
    this.input.type = 'file';
    this.input.accept = 'audio/*';
    this.input.style.display = 'none';
    parent.appendChild(this.input);

    this.el.addEventListener('click', () => this.input.click());
    this.input.addEventListener('change', () => {
      const file = this.input.files?.[0];
      if (file) bus.emit('file:selected', file);
    });

    this.el.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.el.classList.remove('idle');
      this.el.classList.add('active');
    });

    this.el.addEventListener('dragleave', () => {
      this.el.classList.remove('active');
      this.el.classList.add('idle');
    });

    this.el.addEventListener('drop', (e) => {
      e.preventDefault();
      this.el.classList.remove('active');
      this.el.classList.add('idle');
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('audio/')) {
        bus.emit('file:selected', file);
      }
    });
  }

  show(): void {
    this.el.classList.remove('hidden');
  }

  hide(): void {
    this.el.classList.add('hidden');
  }

  dispose(): void {
    this.el.remove();
    this.input.remove();
  }
}
