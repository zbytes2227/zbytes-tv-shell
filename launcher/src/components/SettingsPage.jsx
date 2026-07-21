import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bluetooth, ChevronRight, Monitor, RefreshCcw, Volume2, Wifi } from "lucide-react";
import OnScreenKeyboard from "./OnScreenKeyboard.jsx";

const SETTINGS = window.zbytes?.settings;

const sections = [
  { id: "display", title: "Display", subtitle: "Connected panels and default output", icon: Monitor },
  { id: "wifi", title: "Wi-Fi", subtitle: "Networks, connect, disconnect, forget", icon: Wifi },
  { id: "bluetooth", title: "Bluetooth", subtitle: "Paired and nearby devices", icon: Bluetooth },
  { id: "audio", title: "Audio", subtitle: "Output device and volume", icon: Volume2 },
];

function safeList(value) {
  return Array.isArray(value) ? value : [];
}

function useRemoteNav(sectionCount, itemCounts) {
  const [sectionIndex, setSectionIndex] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);

  const clampItem = (nextSection, nextItem) => {
    const max = Math.max(0, (itemCounts[nextSection] || 1) - 1);
    return Math.max(0, Math.min(max, nextItem));
  };

  const move = (dir) => {
    if (dir === "up") {
      if (itemIndex > 0) return setItemIndex((v) => v - 1);
      setSectionIndex((s) => Math.max(0, s - 1));
      setItemIndex(0);
      return;
    }
    if (dir === "down") {
      const max = Math.max(0, (itemCounts[sectionIndex] || 1) - 1);
      if (itemIndex < max) return setItemIndex((v) => v + 1);
      setSectionIndex((s) => Math.min(sectionCount - 1, s + 1));
      setItemIndex(0);
      return;
    }
    if (dir === "left") {
      setSectionIndex((s) => Math.max(0, s - 1));
      setItemIndex((i) => clampItem(Math.max(0, sectionIndex - 1), i));
      return;
    }
    if (dir === "right") {
      setSectionIndex((s) => Math.min(sectionCount - 1, s + 1));
      setItemIndex((i) => clampItem(Math.min(sectionCount - 1, sectionIndex + 1), i));
    }
  };

  return { sectionIndex, itemIndex, setSectionIndex, setItemIndex, move };
}

function SectionCard({ section, active, onClick }) {
  const Icon = section.icon;
  return (
    <button className={`settings-nav__card ${active ? "settings-nav__card--active" : ""}`} onClick={onClick} type="button">
      <span className="settings-nav__icon"><Icon size={20} /></span>
      <span className="settings-nav__copy">
        <strong>{section.title}</strong>
        <span>{section.subtitle}</span>
      </span>
      <ChevronRight size={16} className="settings-nav__chev" />
    </button>
  );
}

function ListButton({ label, meta, active, danger, onClick, ...rest }) {
  return (
    <button
      type="button"
      className={`settings-list__item ${active ? "settings-list__item--active" : ""} ${danger ? "settings-list__item--danger" : ""}`}
      onClick={onClick}
      {...rest}
    >
      <span className="settings-list__label">{label}</span>
      {meta ? <span className="settings-list__meta">{meta}</span> : null}
    </button>
  );
}

export default function SettingsPage({ onNavigateHome, onToast }) {
  const [data, setData] = useState({
    display: { displays: [], defaultDisplay: null },
    wifi: { wifiEnabled: false, availableNetworks: [], devices: [], activeConnection: null },
    bluetooth: { bluetoothEnabled: false, pairedDevices: [], nearbyDevices: [] },
    audio: { devices: [], defaultOutput: null, volume: null },
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [keyboard, setKeyboard] = useState(null);
  const [headerFocus, setHeaderFocus] = useState(false);
  const backButtonRef = useRef(null);

  const itemCounts = useMemo(() => ({
    0: Math.max(1, safeList(data.display?.displays).length + 2),
    1: Math.max(1, safeList(data.wifi?.availableNetworks).length + 3),
    2: Math.max(1, safeList(data.bluetooth?.pairedDevices).length + safeList(data.bluetooth?.nearbyDevices).length + 2),
    3: Math.max(1, safeList(data.audio?.devices).length + 1),
  }), [data]);

  const { sectionIndex, itemIndex, setSectionIndex, setItemIndex, move } = useRemoteNav(sections.length, itemCounts);

  const refresh = async () => {
    setBusy(true);
    setActionStatus("Refreshing settings...");
    try {
      const [display, wifi, bluetooth, audio] = await Promise.all([
        SETTINGS.getDisplays(),
        SETTINGS.getWifi(),
        SETTINGS.getBluetooth(),
        SETTINGS.getAudioDevices(),
      ]);
      setData({ display, wifi, bluetooth, audio });
      setStatus("Settings refreshed");
      setActionStatus("");
    } catch (error) {
      const message = error?.message || "Unable to refresh settings";
      setStatus(message);
      setActionStatus(message);
      onToast?.(message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { refresh(); }, []); // eslint-disable-line

  useEffect(() => {
    const onKeyDown = async (event) => {
      if (keyboard) return;
      const keyMap = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
      if (event.key === "Escape" || event.key === "Backspace") {
        event.preventDefault();
        onNavigateHome?.();
        return;
      }
      if (event.key in keyMap) {
        event.preventDefault();
        if (headerFocus) {
          if (event.key === "ArrowDown") {
            setHeaderFocus(false);
            backButtonRef.current?.blur();
            setSectionIndex(0);
            setItemIndex(0);
          }
          return;
        }
        if (event.key === "ArrowUp" && sectionIndex === 0 && itemIndex === 0) {
          setHeaderFocus(true);
          return;
        }
        move(keyMap[event.key]);
        return;
      }
      if (headerFocus && event.key === "Enter") {
        event.preventDefault();
        onNavigateHome?.();
        return;
      }
      if (event.key !== "Enter") return;
      event.preventDefault();

      const section = sections[sectionIndex]?.id;
      try {
        if (section === "display") {
          const displays = safeList(data.display?.displays);
          if (itemIndex === 0) {
            setActionStatus("Refreshing displays...");
            await refresh();
            return;
          }
          if (itemIndex === 1) {
            setActionStatus("Turning on connected displays...");
            await Promise.all(displays.filter((d) => d.connected).map((d) => SETTINGS.toggleDisplay(d.id, true)));
            await refresh();
            return;
          }
          const display = displays[itemIndex - 2];
          if (!display) return;
          setActionStatus(`Setting ${display.id} as default...`);
          await SETTINGS.setDisplay(display.id);
          await refresh();
          return;
        }

        if (section === "wifi") {
          const networks = safeList(data.wifi?.availableNetworks);
          if (itemIndex === 0) {
            setActionStatus(`${data.wifi?.wifiEnabled ? "Turning Wi-Fi off" : "Turning Wi-Fi on"}...`);
            await SETTINGS.toggleWifi(!data.wifi?.wifiEnabled);
            await refresh();
            return;
          }
          if (itemIndex === 1) {
            setActionStatus("Scanning Wi-Fi networks...");
            await SETTINGS.scanWifi();
            await refresh();
            return;
          }
          if (itemIndex === 2) {
            setActionStatus("Disconnecting Wi-Fi...");
            await SETTINGS.disconnectWifi();
            await refresh();
            return;
          }

          const network = networks[itemIndex - 3];
          if (!network) return;
          setKeyboard({
            mode: "wifi-password",
            title: network.ssid || "Wi-Fi password",
            subtitle: "Type the network password",
            value: "",
            secure: true,
            onSubmit: async (password) => {
              setKeyboard(null);
              setActionStatus(`Connecting to ${network.ssid || "network"}...`);
              await SETTINGS.connectWifi(network.ssid, password);
              await refresh();
            },
          });
          return;
        }

        if (section === "bluetooth") {
          const paired = safeList(data.bluetooth?.pairedDevices);
          const nearby = safeList(data.bluetooth?.nearbyDevices);
          if (itemIndex === 0) {
            setActionStatus(`${data.bluetooth?.bluetoothEnabled ? "Turning Bluetooth off" : "Turning Bluetooth on"}...`);
            await SETTINGS.toggleBluetooth(!data.bluetooth?.bluetoothEnabled);
            await refresh();
            return;
          }
          if (itemIndex === 1) {
            setActionStatus("Scanning for Bluetooth devices...");
            await SETTINGS.scanBluetooth();
            await refresh();
            return;
          }

          const pairedStart = 2;
          const nearbyStart = pairedStart + paired.length;
          if (itemIndex >= pairedStart && itemIndex < nearbyStart) {
            const device = paired[itemIndex - pairedStart];
            if (!device) return;
            setActionStatus(`${device.connected ? "Disconnecting" : "Connecting"} ${device.name}...`);
            if (device.connected) await SETTINGS.disconnectBluetooth(device.mac);
            else await SETTINGS.connectBluetooth(device.mac);
            await refresh();
            return;
          }

          const device = nearby[itemIndex - nearbyStart];
          if (!device) return;
          setActionStatus(`Pairing with ${device.name}...`);
          await SETTINGS.pairBluetooth(device.mac);
          await refresh();
          return;
        }

        if (section === "audio") {
          const devices = safeList(data.audio?.devices);
          if (itemIndex === 0) {
            setActionStatus("Refreshing audio devices...");
            await refresh();
            return;
          }
          const device = devices[itemIndex - 1];
          if (!device) return;
          setActionStatus(`Switching to ${device.name}...`);
          await SETTINGS.setAudioDevice(device.id);
          await refresh();
        }
      } catch (error) {
        const message = error?.message || "Action failed";
        setStatus(message);
        setActionStatus(message);
        onToast?.(message);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [data, headerFocus, itemIndex, move, onNavigateHome, onToast, refresh, sectionIndex, keyboard]);

  useEffect(() => {
    if (headerFocus) backButtonRef.current?.focus({ preventScroll: true });
  }, [headerFocus]);

  useEffect(() => {
    setItemIndex(0);
  }, [sectionIndex, setItemIndex]);

  useEffect(() => {
    const root = document.querySelector(".settings-panel__scroll");
    const active = root?.querySelector(".settings-list__item--active");
    active?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [sectionIndex, itemIndex, keyboard, data]);

  const renderDetails = () => {
    const section = sections[sectionIndex]?.id;
    if (section === "display") {
      const displays = safeList(data.display?.displays);
      return (
        <div className="settings-detail">
          <div className="settings-stat-grid">
            <Stat label="Connected" value={displays.filter((d) => d.connected).length} />
            <Stat label="Default" value={data.display?.defaultDisplay || "Unknown"} />
          </div>
          <div className="settings-list">
            <ListButton label="Refresh display list" meta={busy ? "Working..." : "Enter"} active={itemIndex === 0} onClick={refresh} />
            <ListButton label="Enable all connected displays" meta="optional" active={itemIndex === 1} onClick={() => Promise.all(displays.filter((d) => d.connected).map((d) => SETTINGS.toggleDisplay(d.id, true))).then(refresh)} />
            {displays.map((display, index) => (
              <ListButton
                key={display.id}
                label={`${display.id}${display.primary ? " (default)" : ""}`}
                meta={display.connected ? (display.currentMode || "connected") : "disconnected"}
                active={itemIndex === index + 2}
                data-settings-active={itemIndex === index + 2 ? "true" : "false"}
                onClick={() => SETTINGS.setDisplay(display.id).then(refresh)}
              />
            ))}
          </div>
        </div>
      );
    }

    if (section === "wifi") {
      const networks = safeList(data.wifi?.availableNetworks);
      return (
        <div className="settings-detail">
          <div className="settings-stat-grid">
            <Stat label="Wi-Fi" value={data.wifi?.wifiEnabled ? "On" : "Off"} />
            <Stat label="Connected" value={data.wifi?.activeConnection || "None"} />
          </div>
          <div className="settings-list">
            <ListButton label={data.wifi?.wifiEnabled ? "Turn Wi-Fi off" : "Turn Wi-Fi on"} active={itemIndex === 0} onClick={() => SETTINGS.toggleWifi(!data.wifi?.wifiEnabled).then(refresh)} />
            <ListButton label="Scan nearby networks" meta="refresh list" active={itemIndex === 1} onClick={() => SETTINGS.scanWifi().then(refresh)} />
            <ListButton label="Disconnect current network" active={itemIndex === 2} onClick={() => SETTINGS.disconnectWifi().then(refresh)} />
            {networks.map((network, index) => (
              <ListButton
                key={`${network.ssid}-${network.bssid}`}
                label={network.ssid || "Hidden network"}
                meta={`${network.signal || 0}% ${network.security || ""}`.trim()}
                active={itemIndex === index + 3}
                data-settings-active={itemIndex === index + 3 ? "true" : "false"}
                onClick={() => setKeyboard({
                  mode: "wifi-password",
                  title: network.ssid || "Wi-Fi password",
                  subtitle: "Type the network password",
                  value: "",
                  secure: true,
                  onSubmit: async (password) => {
                    setKeyboard(null);
                    await SETTINGS.connectWifi(network.ssid, password);
                    await refresh();
                  },
                })}
              />
            ))}
          </div>
        </div>
      );
    }

    if (section === "bluetooth") {
      const paired = safeList(data.bluetooth?.pairedDevices);
      const nearby = safeList(data.bluetooth?.nearbyDevices);
      return (
        <div className="settings-detail">
          <div className="settings-stat-grid">
            <Stat label="Bluetooth" value={data.bluetooth?.bluetoothEnabled ? "On" : "Off"} />
            <Stat label="Paired" value={paired.length} />
          </div>
          <div className="settings-list">
            <ListButton label={data.bluetooth?.bluetoothEnabled ? "Turn Bluetooth off" : "Turn Bluetooth on"} active={itemIndex === 0} onClick={() => SETTINGS.toggleBluetooth(!data.bluetooth?.bluetoothEnabled).then(refresh)} />
            <ListButton label="Scan nearby devices" active={itemIndex === 1} onClick={() => SETTINGS.scanBluetooth().then(refresh)} />
            {paired.map((device, index) => (
              <ListButton
                key={device.mac}
                label={device.name}
                meta={`${device.mac} ${device.connected ? "connected" : ""}`.trim()}
                active={itemIndex === index + 2}
                data-settings-active={itemIndex === index + 2 ? "true" : "false"}
                onClick={async () => {
                  await (device.connected ? SETTINGS.disconnectBluetooth(device.mac) : SETTINGS.connectBluetooth(device.mac));
                  await refresh();
                }}
              />
            ))}
            {nearby.map((device, index) => (
              <ListButton
                key={device.mac}
                label={device.name}
                meta={`${device.mac} nearby`}
                active={itemIndex === index + 2 + paired.length}
                data-settings-active={itemIndex === index + 2 + paired.length ? "true" : "false"}
                onClick={() => SETTINGS.pairBluetooth(device.mac).then(refresh)}
              />
            ))}
          </div>
        </div>
      );
    }

    const devices = safeList(data.audio?.devices);
    return (
      <div className="settings-detail">
        <div className="settings-stat-grid">
          <Stat label="Default output" value={data.audio?.defaultOutput || "Unknown"} />
          <Stat label="Volume" value={data.audio?.volume === null ? "Unknown" : `${data.audio?.volume}%`} />
        </div>
        <div className="settings-list">
          <ListButton label="Refresh audio devices" active={itemIndex === 0} onClick={refresh} />
          {devices.map((device, index) => (
            <ListButton
              key={device.id}
              label={device.name}
              meta={device.id === data.audio?.defaultOutput ? "current default" : device.description}
              active={itemIndex === index + 1}
              data-settings-active={itemIndex === index + 1 ? "true" : "false"}
              onClick={() => SETTINGS.setAudioDevice(device.id).then(refresh)}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="settings-shell">
      <div className="settings-shell__bg" aria-hidden="true" />
      <header className="settings-shell__header">
        <div className="settings-shell__title-block">
          <button
            ref={backButtonRef}
            type="button"
            className={`settings-shell__back ${headerFocus ? "settings-shell__back--active" : ""}`}
            onClick={onNavigateHome}
            onFocus={() => setHeaderFocus(true)}
            aria-label="Back to launcher"
          >
            <ArrowLeft size={18} />
            <span>Launcher</span>
          </button>
          <div>
            <p className="settings-shell__eyebrow">ZBYTES OS</p>
            <h1>Settings</h1>
          </div>
        </div>
        <button type="button" className="settings-shell__refresh" onClick={refresh} disabled={busy}>
          <RefreshCcw size={16} className={busy ? "spin" : ""} />
          Refresh
        </button>
      </header>

      <main className="settings-shell__body" onFocusCapture={() => setHeaderFocus(false)}>
        <nav className="settings-nav">
          {sections.map((section, index) => (
            <SectionCard key={section.id} section={section} active={sectionIndex === index} onClick={() => setSectionIndex(index)} />
          ))}
        </nav>

        <section className="settings-panel">
          <div className="settings-panel__head">
            <p>{sections[sectionIndex]?.subtitle}</p>
            <h2>{sections[sectionIndex]?.title}</h2>
          </div>
          {actionStatus ? <div className="settings-banner settings-banner--live">{actionStatus}</div> : null}
          {status ? <div className="settings-banner">{status}</div> : null}
          <div className="settings-panel__scroll">
            {renderDetails()}
          </div>
        </section>
      </main>

      {keyboard && (
        <OnScreenKeyboard
          value={keyboard.value}
          secure={keyboard.secure}
          title={keyboard.title}
          subtitle={keyboard.subtitle}
          onChange={(value) => setKeyboard((current) => (current ? { ...current, value } : current))}
          onCancel={() => setKeyboard(null)}
          onSubmit={async () => {
            try {
              await keyboard.onSubmit(keyboard.value);
            } catch (error) {
              const message = error?.message || "Unable to connect to the network";
              setStatus(message);
              setActionStatus(message);
              onToast?.(message);
            }
          }}
        />
      )}

      <footer className="settings-shell__footer">
        <span>Arrow Keys navigate</span>
        <span>Enter select</span>
        <span>Back return</span>
      </footer>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="settings-stat">
      <span>{label}</span>
      <strong>{value ?? "Unknown"}</strong>
    </div>
  );
}
