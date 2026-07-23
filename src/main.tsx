import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.tsx";

// PWA (AD-9): reload the app-shell as soon as a freshly deployed service worker
// activates. Without this the SW precaches the new build in the background but
// never refreshes the open page, so an always-on kiosk stays one deploy behind
// (worse on iOS, where a standalone PWA suspends/resumes instead of relaunching).
registerSW({ immediate: true });

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
