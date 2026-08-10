import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import { GalleryPage } from './pages/GalleryPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <GalleryPage />
    </BrowserRouter>
  </StrictMode>,
);
