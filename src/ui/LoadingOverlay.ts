export class LoadingOverlay {
  private el: HTMLElement;
  private textEl: HTMLElement;
  private barEl: HTMLElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'loading-overlay hidden';
    this.el.innerHTML = `
      <div class="loading-overlay__spinner"></div>
      <div class="loading-overlay__text">Processing audio...</div>
      <div class="loading-overlay__progress">
        <div class="loading-overlay__progress-bar"></div>
      </div>
    `;
    parent.appendChild(this.el);
    this.textEl = this.el.querySelector('.loading-overlay__text')!;
    this.barEl = this.el.querySelector('.loading-overlay__progress-bar')!;
  }

  setProgress(frac: number): void {
    this.barEl.style.width = `${Math.round(frac * 100)}%`;
  }

  setText(text: string): void {
    this.textEl.textContent = text;
  }

  show(): void {
    this.el.classList.remove('hidden');
  }

  hide(): void {
    this.el.classList.add('hidden');
    this.barEl.style.width = '0%';
  }

  showError(message: string): void {
    this.textEl.textContent = message;
    this.textEl.style.color = '#ff6b6b';
    this.el.querySelector('.loading-overlay__spinner')?.classList.add('hidden');
    this.barEl.classList.add('hidden');
    setTimeout(() => {
      this.hide();
      this.textEl.style.color = '';
      this.el.querySelector('.loading-overlay__spinner')?.classList.remove('hidden');
      this.barEl.classList.remove('hidden');
    }, 3000);
  }

  dispose(): void {
    this.el.remove();
  }
}
