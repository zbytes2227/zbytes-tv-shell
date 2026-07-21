import React, { useEffect, useState, useCallback, useRef } from "react";
import AppGrid from "./components/AppGrid.jsx";
import { WifiOff, LayoutGrid } from "lucide-react";
import SettingsPage from "./components/SettingsPage.jsx";
import SplashScreen from "./components/SplashScreen.jsx";

const INTERNET_CHECK_URL = "https://www.gstatic.com/generate_204";
const INTERNET_CHECK_INTERVAL_MS = 10000;
const INTERNET_CHECK_TIMEOUT_MS = 2500;
const ELECTRON_API = window.zbytes;

export default function App() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [overlay, setOverlay] = useState(null);
  const [clock, setClock] = useState(new Date());
  const [route, setRoute] = useState(window.location.pathname);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Splash Screen Logic
  const [showSplash, setShowSplash] = useState(() => {
    return !sessionStorage.getItem("zbytes_booted");
  });

  // Remember which card was last focused in the grid so we can restore on return
  const savedGridIndex = useRef(0);
  const internetCheckTimer = useRef(null);
  const connectivityProbe = useRef(null);

  const handleNavigateHome = useCallback(() => {
    if (window.location.pathname !== "/") {
      window.history.pushState({}, "", "/");
      setRoute("/");
    }
    if (ELECTRON_API?.showLauncher) {
      ELECTRON_API.showLauncher().catch((error) => console.error(error));
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => setRoute(window.location.pathname);
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    const checkInternet = async () => {
      if (!navigator.onLine) {
        handleOffline();
        return;
      }

      const controller = new AbortController();
      connectivityProbe.current = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), INTERNET_CHECK_TIMEOUT_MS);

      try {
        await fetch(INTERNET_CHECK_URL, {
          mode: "no-cors",
          cache: "no-store",
          signal: controller.signal,
        });
        handleOnline();
      } catch {
        handleOffline();
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    const handleKeyDown = (e) => {
      if ((e.key === "Escape" || e.key === "Backspace") && window.location.pathname === "/settings") {
        e.preventDefault();
        handleNavigateHome();
      }
    };

    fetchApps();
    const clockTimer = setInterval(() => setClock(new Date()), 1000);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("keydown", handleKeyDown);

    const unsubscribeOverlay = ELECTRON_API?.onOverlay?.((event) => {
      if (event?.type === "hide") {
        setOverlay(null);
        return;
      }

      if (event?.type === "show") {
        setOverlay(event.payload || null);
      }
    });

    checkInternet();
    internetCheckTimer.current = window.setInterval(checkInternet, INTERNET_CHECK_INTERVAL_MS);

    return () => {
      clearInterval(clockTimer);
      if (internetCheckTimer.current) window.clearInterval(internetCheckTimer.current);
      if (connectivityProbe.current) connectivityProbe.current.abort();
      if (typeof unsubscribeOverlay === "function") unsubscribeOverlay();
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleNavigateHome]);

  async function fetchApps() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/apps");
      if (!res.ok) throw new Error("Failed to fetch apps");
      const data = await res.json();
      setApps(data);
    } catch (err) {
      console.error(err);
      setError("Could not load apps from the backend.");
    } finally {
      setLoading(false);
    }
  }

  const handleLaunch = useCallback(async (app) => {
    try {
      if (!ELECTRON_API?.openApp) {
        throw new Error("Electron bridge unavailable");
      }

      await ELECTRON_API.openApp(app.id);
    } catch (err) {
      console.error(err);
      setToast(`Unable to open ${app.name}.`);
    }
  }, []);

  const handleOpenSettings = useCallback(() => {
    if (window.location.pathname === "/settings") return;
    window.history.pushState({}, "", "/settings");
    setRoute("/settings");
  }, []);

  const handleSplashComplete = useCallback(() => {
    sessionStorage.setItem("zbytes_booted", "1");
    setShowSplash(false);
  }, []);

  // Clock formatting — no seconds on TV display (less jitter)
  const timeString = clock.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateString = clock.toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const isSettingsRoute = route === "/settings";

  const overlayStyles = {
    shell: {
      position: "fixed",
      inset: 0,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
      pointerEvents: "none",
      zIndex: 1200,
      padding: "32px",
    },
    card: {
      minWidth: "320px",
      maxWidth: "540px",
      width: "100%",
      borderRadius: "24px",
      background: "rgba(10, 15, 30, 0.92)",
      border: "1px solid rgba(255,255,255,0.10)",
      boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
      backdropFilter: "blur(22px)",
      color: "white",
      pointerEvents: "auto",
      overflow: "hidden",
    },
    header: {
      padding: "18px 22px 10px",
      fontSize: "14px",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "rgba(255,255,255,0.72)",
    },
    body: {
      padding: "0 22px 22px",
      fontSize: "18px",
      lineHeight: 1.45,
    },
    bar: {
      height: "10px",
      marginTop: "14px",
      borderRadius: "999px",
      background: "rgba(255,255,255,0.10)",
      overflow: "hidden",
    },
    fill: {
      height: "100%",
      borderRadius: "999px",
      background: "linear-gradient(90deg, #4f7eff, #22d3ee)",
    },
    actions: {
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: "10px",
      padding: "0 22px 22px",
    },
    button: {
      border: 0,
      borderRadius: "14px",
      padding: "14px 12px",
      background: "rgba(255,255,255,0.08)",
      color: "#fff",
      fontWeight: 600,
      cursor: "pointer",
    },
  };

  return (
    <div className="app-shell">
      {/* Ambient background — static radial composition */}
      <div className="app-shell__bg" aria-hidden="true" />

      {showSplash ? (
        <SplashScreen onComplete={handleSplashComplete} />
      ) : (
        <>
          {/* Floating transparent header */}
          <header className="app-header">
            <div className="app-header__brand">
              <span className="app-header__wordmark">ZBYTES</span>
              <span className="app-header__os">OS</span>
            </div>

            <div className="app-header__right">
              {isSettingsRoute && (
                <button
                  className="header-nav-btn"
                  onClick={handleNavigateHome}
                  aria-label="Back to Launcher"
                >
                  <LayoutGrid size={15} aria-hidden="true" />
                  <span>Launcher</span>
                </button>
              )}
              <div className="app-header__clock">
                <span className="app-header__time">{timeString}</span>
                <span className="app-header__date">{dateString}</span>
              </div>
            </div>
          </header>

          {/* Main content */}
          <main className="app-main">
            <div
              className="page-enter"
              key={isSettingsRoute ? "settings" : "launcher"}
              style={{ width: "100%", display: "flex", justifyContent: "center" }}
            >
              {isSettingsRoute ? (
                <SettingsPage
                  onNavigateHome={handleNavigateHome}
                  onToast={setToast}
                />
              ) : loading ? (
                <div className="state-message" role="status" aria-live="polite">
                  <div className="loader-wordmark">ZBYTES</div>
                  <div className="loader-dots" aria-label="Loading">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              ) : error ? (
                <div className="state-message" role="alert">
                  <WifiOff size={44} className="state-message__icon" aria-hidden="true" />
                  <p className="state-message__text">{error}</p>
                  <button className="retry-btn" onClick={fetchApps} autoFocus>
                    Retry Connection
                  </button>
                </div>
              ) : (
                <AppGrid
                  apps={apps}
                  onLaunch={handleLaunch}
                  onOpenSettings={handleOpenSettings}
                  savedIndex={savedGridIndex.current}
                  onSaveIndex={(idx) => {
                    savedGridIndex.current = idx;
                  }}
                />
              )}
            </div>
          </main>

          {/* Toast notification */}
          {toast && (
            <div className="toast" role="status" aria-live="polite">
              {toast}
            </div>
          )}

          {/* Offline notification */}
          {!isOnline && (
            <div className="offline-notice" role="alert" aria-live="assertive">
              <WifiOff size={18} aria-hidden="true" />
              <span>No internet connection. Please connect to the internet.</span>
            </div>
          )}

          {/* Footer hint */}
          <footer className="app-footer">
            <div className="app-footer__hint">
              {isSettingsRoute ? (
                <span>
                  <kbd>↑↓</kbd> Navigate &nbsp;&middot;&nbsp; <kbd>Enter</kbd> Select &nbsp;&middot;&nbsp; <kbd>Esc</kbd> Back
                </span>
              ) : (
                <span>
                  <kbd>↑↓←→</kbd> Navigate &nbsp;&middot;&nbsp; <kbd>Enter</kbd> Open
                </span>
              )}
            </div>
          </footer>
        </>
      )}

      {overlay && (
        <div style={overlayStyles.shell} aria-live="polite">
          {overlay.type === "power" ? (
            <div style={overlayStyles.card}>
              <div style={overlayStyles.header}>Power Menu</div>
              <div style={overlayStyles.body}>
                Choose a system action for the TV.
              </div>
              <div style={overlayStyles.actions}>
                <button
                  style={overlayStyles.button}
                  onClick={() => ELECTRON_API?.systemAction?.("sleep")}
                >
                  Sleep
                </button>
                <button
                  style={overlayStyles.button}
                  onClick={() => ELECTRON_API?.systemAction?.("restart")}
                >
                  Restart
                </button>
                <button
                  style={{ ...overlayStyles.button, background: "rgba(248,113,113,0.20)" }}
                  onClick={() => ELECTRON_API?.systemAction?.("power-off")}
                >
                  Power Off
                </button>
              </div>
            </div>
          ) : overlay.type === "mute" ? (
            <div style={overlayStyles.card}>
              <div style={overlayStyles.header}>Mute</div>
              <div style={overlayStyles.body}>
                {overlay.muted ? "Audio is muted." : "Audio is unmuted."}
              </div>
            </div>
          ) : overlay.type === "volume" ? (
            <div style={overlayStyles.card}>
              <div style={overlayStyles.header}>Volume</div>
              <div style={overlayStyles.body}>
                <div>{Number.isFinite(overlay.volume) ? `${overlay.volume}%` : "Adjusting volume"}</div>
                <div style={overlayStyles.bar}>
                  <div
                    style={{
                      ...overlayStyles.fill,
                      width: `${Math.max(0, Math.min(100, overlay.volume ?? 50))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : overlay.type === "notification" ? (
            <div style={overlayStyles.card}>
              <div style={overlayStyles.header}>{overlay.title || "Notification"}</div>
              <div style={overlayStyles.body}>{overlay.message || "New system notification."}</div>
            </div>
          ) : (
            <div style={overlayStyles.card}>
              <div style={overlayStyles.header}>
                {overlay.type.replace("-", " ")}
              </div>
              <div style={overlayStyles.body}>
                {overlay.message || overlay.deviceName || "Status updated."}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
