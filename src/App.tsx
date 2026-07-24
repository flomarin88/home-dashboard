import { useEffect, useState } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { HakitProvider, isConfigured } from "./hakit";
import { TopBar } from "./ui/TopBar";
import { TopBarSlots } from "./ui/TopBarSlots";
import { UndoToast } from "./ui/UndoToast";
import { BinTile } from "./widgets/BinTile";
import { PlantTile } from "./widgets/PlantTile";
import { TopBarWeather } from "./widgets/TopBarWeather";
import { TurtleTile } from "./widgets/TurtleTile";
import { ElectricityTile } from "./widgets/ElectricityTile";
import { Skeleton } from "./ui/Skeleton";
import { Home } from "./pages/Home";
import { RoomDetail } from "./pages/RoomDetail";
import { VacuumDetail } from "./pages/VacuumDetail";
import { WeatherDetail } from "./pages/WeatherDetail";
import { ClimateDetail } from "./pages/ClimateDetail";
import { CoursesDetail } from "./pages/CoursesDetail";
import { ElectricityDetail } from "./pages/ElectricityDetail";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:roomId" element={<RoomDetail />} />
      <Route path="/aspirateur" element={<VacuumDetail />} />
      <Route path="/climatisation" element={<ClimateDetail />} />
      <Route path="/meteo" element={<WeatherDetail />} />
      <Route path="/courses" element={<CoursesDetail />} />
      <Route path="/electricite" element={<ElectricityDetail />} />
    </Routes>
  );
}

/**
 * Shown by `HakitProvider` while HA is connecting (data zones only). It mirrors
 * the home layout with skeletons so connecting→connected has no layout jump, and
 * — being outside the provider — uses no HA hooks. Never blank (NFR4/AD-6).
 */
function ConnectingZones() {
  // Skeleton tiles mirroring Home so connecting→connected has no layout jump.
  return (
    <div className="flex flex-col gap-grid-gap">
      <div className="grid grid-cols-2 gap-tile-gap md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-tile-h w-full rounded-md" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-tile-gap md:grid-cols-4">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-tile-h w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}

/**
 * KioskShell — the persistent kiosk chrome. The ground + `TopBar` (which runs
 * the Clock interval) live ABOVE the HA connection gate; only the data zones
 * (`children`) sit inside `HakitProvider`.
 *
 * Why (TD-1 fix): `HassConnect` renders its `loading` fallback until
 * authenticated and swaps back to it on every disconnect, remounting its
 * children — which used to reset the Clock and any component state. Keeping the
 * chrome outside the gate means a (re)connect only remounts the data zones (they
 * already degrade gracefully via `useEntityValue`), never the shell or Clock.
 *
 * Not configured (no HA URL) → render the zones with NO provider (Home gates its
 * HA widgets off internally); the shell still shows, never blank (AD-6/NFR4).
 */
// DIAGNOSTIC (temporary) — reads the real viewport heights on the iPad so the
// bottom-bar cause is measured, not guessed. Magenta strip is `fixed bottom:0`:
// if it floats above the dark bar, fixed positioning is short on this WebKit.
function DiagViewport() {
  const [s, setS] = useState("");
  useEffect(() => {
    const probe = (h: string) => {
      const d = document.createElement("div");
      d.style.cssText = `position:fixed;top:0;left:0;width:1px;height:${h};visibility:hidden;pointer-events:none`;
      document.body.appendChild(d);
      const v = d.offsetHeight;
      d.remove();
      return v;
    };
    const upd = () => {
      setS(
        `win ${window.innerHeight} vh ${probe("100vh")} svh ${probe("100svh")} lvh ${probe("100lvh")} dvh ${probe("100dvh")} sab ${probe("env(safe-area-inset-bottom)")} avail ${window.screen.availHeight}`,
      );
    };
    upd();
    window.addEventListener("resize", upd);
    window.visualViewport?.addEventListener("resize", upd);
    return () => {
      window.removeEventListener("resize", upd);
      window.visualViewport?.removeEventListener("resize", upd);
    };
  }, []);
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        background: "#ff00ff",
        color: "#fff",
        fontSize: 11,
        textAlign: "center",
        padding: "3px 0",
      }}
    >
      {s}
    </div>
  );
}

function KioskShell() {
  return (
    // Full-viewport ground. The kiosk content is a centered 1024×768 stage so it
    // renders the same everywhere: on the iPad the viewport IS 1024×768 → the
    // stage fills it, no surround; on a larger screen the ground fills around it.
    // `fixed` + EXPLICIT offsets (top/right/bottom/left-0), not `h-dvh`/`inset-0`:
    // the 2016 iPad's old WebKit ignores `dvh` (Safari 15.4+) and the `inset`
    // shorthand (< iOS 14.5). See memory: target-device-and-layout.
    <main
      className="fixed top-0 right-0 bottom-0 left-0 flex items-center justify-center overflow-hidden"
      style={{ outline: "3px solid #22ff22", outlineOffset: "-3px" }}
    >
      {/* Width-capped stage (max 1024px, centered) so it isn't oversized on a
          desktop window; height FILLS the viewport (`h-full`, no max-height) —
          the iPad's PWA viewport is slightly taller than 768, so a 768 cap left
          a dark surround bar at the bottom. `overflow-hidden` = NEVER-scroll. */}
      <div className="bg-ground relative flex h-full w-full max-w-[1024px] flex-col gap-grid-gap overflow-hidden p-6 text-text">
        <TopBar />
        {isConfigured ? (
          <HakitProvider loading={<ConnectingZones />}>
            <AppRoutes />
            {/* HA-backed top-bar widgets — they need HA, so (unlike TopBar/Clock,
              which stay above the connection gate, TD-1) they live UNDER the
              provider. TopBarSlots (TD-4) is the composition layer that flows
              them instead of each tile hand-placing itself; new tiles just get
              added as children. */}
            <TopBarSlots>
              <TopBarWeather />
              <ElectricityTile />
              <TurtleTile />
              <PlantTile />
              <BinTile />
            </TopBarSlots>
          </HakitProvider>
        ) : (
          <AppRoutes />
        )}

        {/* Undo safety-net toast (NFR6) — chrome, above the connection gate so it
          persists across (re)connect; the undo closure (built under the provider)
          is what reaches HA. */}
        <UndoToast />
      </div>
      <DiagViewport />
    </main>
  );
}

// HashRouter (not BrowserRouter): under HA's `/local/` static hosting the app is
// entered at `…/index.html` (the bare directory 403s — HA serves no directory
// index), and reloads/PWA-relaunch must hit a real 200 file. Hash routing keeps
// the file path pinned to `index.html` and carries the route in the fragment
// (`…/index.html#/meteo`), so entry, reload and relaunch always match a route
// and never 403. No basename needed — the subpath lives before the `#`.
function App() {
  return (
    <HashRouter>
      <KioskShell />
    </HashRouter>
  );
}

export default App;
