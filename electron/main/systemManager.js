const { execFile } = require("child_process");

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { maxBuffer: 1024 * 1024, ...options }, (error, stdout, stderr) => {
      if (error) {
        const err = new Error(
          `${command} ${args.join(" ")} failed${stderr ? `: ${String(stderr).trim()}` : ""}`
        );
        err.cause = error;
        err.stdout = stdout?.toString?.() ?? String(stdout || "");
        err.stderr = stderr?.toString?.() ?? String(stderr || "");
        return reject(err);
      }

      resolve({
        stdout: stdout?.toString?.() ?? String(stdout || ""),
        stderr: stderr?.toString?.() ?? String(stderr || ""),
      });
    });
  });
}

function splitLines(output) {
  return String(output || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function tryCommands(commands) {
  let lastError = null;
  for (const [command, args] of commands) {
    try {
      return await run(command, args);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No command succeeded");
}

async function runBestEffort(commands) {
  for (const [command, args] of commands) {
    try {
      return await run(command, args);
    } catch {
      // keep trying
    }
  }
  return null;
}

class SystemManager {
  log(level, message, details = null) {
    const suffix = details ? ` ${typeof details === "string" ? details : JSON.stringify(details)}` : "";
    console.log(`[${new Date().toISOString()}] [${level}] ${message}${suffix}`);
  }

  async getDisplays() {
    const { stdout } = await run("xrandr", ["--query"]);
    const displays = [];
    let defaultDisplay = null;

    for (const line of splitLines(stdout)) {
      const connected = line.match(/^(\S+)\s+(connected|disconnected)\b(.*)$/);
      if (!connected) continue;

      const [, id, state, rest] = connected;
      const modes = [];
      const primary = /\bprimary\b/.test(rest);
      const resolutionMatch = rest.match(/(\d+)x(\d+)\+(\d+)\+(\d+)/);
      const activeModeMatch = rest.match(/(\d+x\d+)\+(\d+)\+(\d+)/);

      if (state === "connected") {
        const modeParts = rest.split(" ").filter(Boolean);
        for (const part of modeParts) {
          if (/^\d+x\d+/.test(part)) {
            const m = part.match(/^(\d+x\d+)/);
            if (m) modes.push(m[1]);
          }
        }
      }

      if (primary || (rest.includes("*") && !defaultDisplay)) {
        defaultDisplay = id;
      }

      displays.push({
        id,
        connected: state === "connected",
        enabled: state === "connected",
        primary,
        currentMode: resolutionMatch ? `${resolutionMatch[1]}+${resolutionMatch[3]}+${resolutionMatch[4]}` : activeModeMatch?.[1] || null,
        modes,
      });
    }

    return { displays, defaultDisplay };
  }

  async setDisplay(id) {
    this.log("INFO", "Set default display", { id });
    if (!id) throw new Error("Missing display id");
    await run("xrandr", ["--output", id, "--primary", "--auto"]);
    return this.getDisplays();
  }

  async toggleDisplay(id, enabled) {
    this.log("INFO", "Toggle display", { id, enabled });
    if (!id) throw new Error("Missing display id");
    await run("xrandr", ["--output", id, enabled ? "--auto" : "--off"]);
    return this.getDisplays();
  }

  async getWifi() {
    const [deviceResult, networkResult] = await Promise.allSettled([
      run("nmcli", ["-t", "-f", "DEVICE,TYPE,STATE,CONNECTION", "device"]),
      run("nmcli", ["-t", "-f", "ACTIVE,SSID,BSSID,MODE,CHAN,RATE,SIGNAL,SECURITY", "dev", "wifi", "list", "--rescan", "no"]),
    ]);

    const devices = deviceResult.status === "fulfilled"
      ? splitLines(deviceResult.value.stdout).map((line) => {
          const [device, type, state, connection] = line.split(":");
          return { device, type, state, connection: connection || null };
        })
      : [];

    const availableNetworks = networkResult.status === "fulfilled"
      ? splitLines(networkResult.value.stdout).map((line) => {
          const [active, ssid, bssid, mode, chan, rate, signal, security] = line.split(":");
          return {
            active: active === "yes",
            ssid: ssid || "",
            bssid: bssid || "",
            mode: mode || "",
            channel: chan || "",
            rate: rate || "",
            signal: Number(signal || 0),
            security: security || "",
          };
        })
      : [];

    const wifiDevice = devices.find((item) => item.type === "wifi") || null;
    const wifiEnabled = wifiDevice ? wifiDevice.state !== "unavailable" && wifiDevice.state !== "disabled" : false;
    const activeConnection = devices.find((item) => item.type === "wifi" && item.connection && item.state === "connected")?.connection || null;

    return { wifiEnabled, devices, availableNetworks, activeConnection };
  }

  async scanWifi() {
    await run("nmcli", ["dev", "wifi", "rescan"]);
    return this.getWifi();
  }

  async toggleWifi(enabled) {
    this.log("INFO", "Toggle wifi", { enabled });
    await run("nmcli", ["radio", "wifi", enabled ? "on" : "off"]);
    return this.getWifi();
  }

  async connectWifi(ssid, password = "") {
    if (!ssid) throw new Error("Missing SSID");
    this.log("INFO", "Connect wifi", { ssid });
    const args = ["dev", "wifi", "connect", ssid];
    if (password) {
      args.push("password", password);
    }
    await run("nmcli", args);
    return this.getWifi();
  }

  async disconnectWifi() {
    const wifi = await this.getWifi();
    const device = wifi.devices.find((item) => item.type === "wifi" && item.state === "connected");
    if (!device?.device) throw new Error("No connected Wi-Fi device found");
    await run("nmcli", ["device", "disconnect", device.device]);
    return this.getWifi();
  }

  async forgetWifi(ssid) {
    if (!ssid) throw new Error("Missing SSID");
    await run("nmcli", ["connection", "delete", "id", ssid]);
    return this.getWifi();
  }

  async getBluetooth() {
    const [showResult, pairedResult, adaptersResult] = await Promise.allSettled([
      run("bluetoothctl", ["show"]),
      run("bluetoothctl", ["devices", "Paired"]),
      run("bluetoothctl", ["list"]),
    ]);
    const bluetoothEnabled =
      showResult.status === "fulfilled" ? !/\bPowered:\s+no\b/i.test(showResult.value.stdout) : false;

    const adapters = adaptersResult.status === "fulfilled"
      ? splitLines(adaptersResult.value.stdout).map((line) => {
          const match = line.match(/^Controller\s+([0-9A-F:]+)\s+(.+)$/i);
          return match ? { mac: match[1], name: match[2] } : null;
        }).filter(Boolean)
      : [];

    const { stdout } = pairedResult.status === "fulfilled" ? pairedResult.value : { stdout: "" };
    const pairedDevices = splitLines(stdout).map((line) => {
      const match = line.match(/^Device\s+([0-9A-F:]+)\s+(.+)$/i);
      return match
        ? { mac: match[1], name: match[2], paired: true, connected: false }
        : null;
    }).filter(Boolean);

    const infoOutputs = await Promise.allSettled(pairedDevices.map((device) => run("bluetoothctl", ["info", device.mac])));
    const paired = pairedDevices.map((device, index) => {
      const info = infoOutputs[index].status === "fulfilled" ? infoOutputs[index].value.stdout : "";
      return {
        ...device,
        connected: /\bConnected:\s+yes\b/i.test(info),
        trusted: /\bTrusted:\s+yes\b/i.test(info),
      };
    });

    return { bluetoothEnabled, adapters, pairedDevices: paired, nearbyDevices: [] };
  }

  async ensureBluetoothReady() {
    await runBestEffort([
      ["systemctl", ["start", "bluetooth.service"]],
      ["service", ["bluetooth", "start"]],
    ]);

    await runBestEffort([
      ["rfkill", ["unblock", "bluetooth"]],
    ]);

    const adaptersState = await this.getBluetooth();
    for (const adapter of adaptersState.adapters || []) {
      await runBestEffort([
        ["bluetoothctl", ["select", adapter.mac]],
        ["btmgmt", ["-i", adapter.mac, "power", "on"]],
        ["bluetoothctl", ["power", "on"]],
      ]);
    }

    const refreshed = await this.getBluetooth();
    if (!refreshed.bluetoothEnabled) {
      await runBestEffort([
        ["bluetoothctl", ["power", "on"]],
        ["btmgmt", ["power", "on"]],
      ]);
    }
    return this.getBluetooth();
  }

  async scanBluetooth() {
    await this.ensureBluetoothReady();
    const adapters = (await this.getBluetooth()).adapters || [];
    if (!adapters.length) {
      await run("bluetoothctl", ["scan", "on"]);
    } else {
      for (const adapter of adapters) {
        await runBestEffort([
          ["bluetoothctl", ["select", adapter.mac]],
          ["bluetoothctl", ["scan", "on"]],
        ]);
      }
    }

    const { stdout } = await run("bluetoothctl", ["devices"]);
    const devices = splitLines(stdout)
      .map((line) => {
        const match = line.match(/^Device\s+([0-9A-F:]+)\s+(.+)$/i);
        return match ? { mac: match[1], name: match[2] } : null;
      })
      .filter(Boolean);
    return { ...(await this.getBluetooth()), nearbyDevices: devices };
  }

  async pairBluetooth(mac) {
    if (!mac) throw new Error("Missing MAC address");
    await this.ensureBluetoothReady();
    await run("bluetoothctl", ["pair", mac]);
    await run("bluetoothctl", ["trust", mac]).catch(() => {});
    return this.getBluetooth();
  }

  async connectBluetooth(mac) {
    if (!mac) throw new Error("Missing MAC address");
    await this.ensureBluetoothReady();
    await run("bluetoothctl", ["connect", mac]);
    return this.getBluetooth();
  }

  async disconnectBluetooth(mac) {
    if (!mac) throw new Error("Missing MAC address");
    await run("bluetoothctl", ["disconnect", mac]);
    return this.getBluetooth();
  }

  async removeBluetooth(mac) {
    if (!mac) throw new Error("Missing MAC address");
    await run("bluetoothctl", ["remove", mac]);
    return this.getBluetooth();
  }

  async toggleBluetooth(enabled) {
    if (enabled) {
      await this.ensureBluetoothReady();
      await runBestEffort([
        ["bluetoothctl", ["power", "on"]],
        ["btmgmt", ["power", "on"]],
      ]);
    } else {
      await runBestEffort([
        ["bluetoothctl", ["power", "off"]],
        ["btmgmt", ["power", "off"]],
      ]);
    }
    return this.getBluetooth();
  }

  async getAudioDevices() {
    const [pactlInfo, pactlSinks, wpctlStatus] = await Promise.allSettled([
      run("pactl", ["info"]),
      run("pactl", ["list", "short", "sinks"]),
      run("wpctl", ["status"]),
    ]);

    const devices = [];
    let defaultOutput = null;

    if (pactlSinks.status === "fulfilled") {
      for (const line of splitLines(pactlSinks.value.stdout)) {
        const parts = line.split("\t");
        if (parts.length < 2) continue;
        const id = parts[0];
        const name = parts[1];
        const description = parts[4] || parts[1] || `Sink ${id}`;
        devices.push({ id, name, description });
      }
    }

    if (pactlInfo.status === "fulfilled") {
      const match = pactlInfo.value.stdout.match(/Default Sink:\s*(.+)/i);
      if (match) defaultOutput = match[1].trim();
    }

    if (!defaultOutput && wpctlStatus.status === "fulfilled") {
      const defaultLine = splitLines(wpctlStatus.value.stdout).find((line) => /\*.*\]/.test(line) || /\[default\]/i.test(line));
      if (defaultLine) {
        const token = defaultLine.match(/([^\s\]]+)(?:\s+\[default\]|\s*\*)?/);
        if (token) defaultOutput = token[1];
      }
    }

    if (!devices.length && wpctlStatus.status === "fulfilled") {
      const lines = splitLines(wpctlStatus.value.stdout);
      let inSinks = false;
      for (const line of lines) {
        if (/^\s*Sinks:/i.test(line)) {
          inSinks = true;
          continue;
        }
        if (inSinks && /^\s*Sources:/i.test(line)) {
          inSinks = false;
          continue;
        }
        if (!inSinks) continue;
        const match = line.match(/^\s*([*]?\s*[0-9]+\.?\s*[^ ]+)\s+(.+)$/);
        if (match) {
          const id = match[1].replace(/\*/g, "").trim();
          const name = match[2].replace(/\[(default|active)\]/gi, "").trim();
          devices.push({ id, name, description: name });
        }
      }
    }

    const volumeState = await this.getVolume();
    return { devices, defaultOutput, volume: volumeState.volume };
  }

  async volumeUp() {
    await run("wpctl", ["set-volume", "@DEFAULT_AUDIO_SINK@", "5%+"]).catch(async () => {
      await run("pactl", ["set-sink-volume", "@DEFAULT_SINK@", "+5%"]);
    });
    return this.getVolume();
  }

  async volumeDown() {
    await run("wpctl", ["set-volume", "@DEFAULT_AUDIO_SINK@", "5%-"]).catch(async () => {
      await run("pactl", ["set-sink-volume", "@DEFAULT_SINK@", "-5%"]);
    });
    return this.getVolume();
  }

  async mute(muted = true) {
    await run("wpctl", ["set-mute", "@DEFAULT_AUDIO_SINK@", muted ? "1" : "0"]).catch(async () => {
      await run("pactl", ["set-sink-mute", "@DEFAULT_SINK@", muted ? "1" : "0"]);
    });
    return this.getVolume();
  }

  async toggleMute() {
    const state = await this.getVolume();
    return this.mute(!state.muted);
  }

  async setAudioDevice(id) {
    if (!id) throw new Error("Missing audio device id");
    await run("wpctl", ["set-default", id]);
    return this.getAudioDevices();
  }

  async getVolume() {
    const wpctl = await run("wpctl", ["get-volume", "@DEFAULT_AUDIO_SINK@"]);
    const volumeMatch = wpctl.stdout.match(/([0-9]*\.?[0-9]+)/);
    const muted = /\bMUTED\b/i.test(wpctl.stdout);
    return {
      volume: volumeMatch ? Math.round(Number(volumeMatch[1]) * 100) : null,
      muted,
      raw: wpctl.stdout.trim(),
    };
  }

  async powerOff() {
    await run("systemctl", ["poweroff"]).catch(() => run("loginctl", ["poweroff"]));
  }

  async restart() {
    await run("systemctl", ["reboot"]).catch(() => run("loginctl", ["reboot"]));
  }

  async sleep() {
    await run("systemctl", ["suspend"]).catch(() => run("loginctl", ["suspend"]));
  }
}

module.exports = SystemManager;
