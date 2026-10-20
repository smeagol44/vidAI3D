import {createRoot} from 'react-dom/client';
import App from './App';
import './styles.css';
import { initializePhysics } from './sim/physics';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}
const root = createRoot(rootElement);

rootElement.textContent = 'Loading VIDA 3D physics…';
initializePhysics().then(() => root.render(
  <div
    style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
    }}>
    <App />
  </div>,
)).catch((error: unknown) => {
  rootElement.textContent = `VIDA 3D could not initialize physics: ${error instanceof Error ? error.message : String(error)}`;
});
