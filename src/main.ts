import { App } from './App';
import './styles/main.css';

const container = document.getElementById('app')!;
const app = new App(container);

window.addEventListener('resize', () => {
  app.onResize(window.innerWidth, window.innerHeight);
});
