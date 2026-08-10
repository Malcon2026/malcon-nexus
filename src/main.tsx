import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { GalleryPage } from "./pages/GalleryPage";

function isGalleryPath(): boolean {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return path === "/gallery";
}

function Root() {
  if (isGalleryPath()) {
    return (
      <BrowserRouter>
        <GalleryPage />
      </BrowserRouter>
    );
  }
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
