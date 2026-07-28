import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StudyProvider } from './state/StudyProvider';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StudyProvider>
      <App />
    </StudyProvider>
  </StrictMode>,
);
