import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import { TvKioskPage } from './pages/TvKioskPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <TvKioskPage />
    </BrowserRouter>
  </StrictMode>,
);
