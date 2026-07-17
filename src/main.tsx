import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// StrictMode is kept intentionally. In dev it double-invokes effects, so
// HassConnect may open → tear down → reopen the HA WebSocket once at startup
// (expected, dev-only; stripped from the production build). We keep it rather
// than remove it: if @hakit cleans the socket up correctly the churn is
// harmless, and if it does not, StrictMode is what surfaces the leak — removing
// it would only hide the signal.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
