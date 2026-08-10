import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import App from "./App";
import { GalleryPage } from "./pages/GalleryPage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
