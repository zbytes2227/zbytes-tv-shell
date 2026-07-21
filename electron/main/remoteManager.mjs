import { EventEmitter } from "events";
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";

const CONFIG = {
  baudRate: 115200,
  reconnectDelayMs: 3000,
  scanIntervalMs: 5000,
  forcedPortPath: null,
  vendorIds: ["2341", "2a03", "1a86", "0403", "10c4"],
  pathHints: ["/dev/ttyUSB", "/dev/ttyACM"],
};

const COMMAND_EVENTS = new Set([
  "READY",
  "UP",
  "DOWN",
  "LEFT",
  "RIGHT",
  "ENTER",
  "HOME",
  "BACK",
  "MUTE",
  "VOLUME_UP",
  "VOLUME_DOWN",
  "BROWSER_BACK",
  "BROWSER_FORWARD",
  "PAUSE",
  "RESUME",
  "POWER",
]);

export default class RemoteManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      ...CONFIG,
      ...config,
      vendorIds: config.vendorIds ?? CONFIG.vendorIds,
      pathHints: config.pathHints ?? CONFIG.pathHints,
    };
    this.port = null;
    this.parser = null;
    this.scanTimer = null;
    this.reconnectTimer = null;
    this.connecting = false;
    this.started = false;
    this.stopping = false;
    this.sigintHandler = null;
  }

  log(level, message, details = null) {
    const ts = new Date().toISOString();
    const suffix = details ? ` ${typeof details === "string" ? details : JSON.stringify(details)}` : "";
    console.log(`[${ts}] [${level}] ${message}${suffix}`);
  }

  async start() {
    if (this.started) return;
    this.started = true;
    this.stopping = false;
    this.log("INFO", "RemoteManager starting");

    this.sigintHandler = async () => {
      this.log("INFO", "SIGINT received");
      await this.stop();
      process.exit(0);
    };
    process.once("SIGINT", this.sigintHandler);

    await this.scheduleScan(0);
  }

  async stop() {
    this.stopping = true;
    this.started = false;
    this.clearTimers();

    if (this.sigintHandler) {
      process.removeListener("SIGINT", this.sigintHandler);
      this.sigintHandler = null;
    }

    await this.disconnect();
    this.log("INFO", "RemoteManager stopped");
  }

  clearTimers() {
    if (this.scanTimer) clearTimeout(this.scanTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.scanTimer = null;
    this.reconnectTimer = null;
  }

  async findArduino() {
    if (this.config.forcedPortPath) {
      this.log("INFO", "Using forced port", this.config.forcedPortPath);
      return this.config.forcedPortPath;
    }

    this.log("INFO", "Scanning for Arduino...");

    let ports = [];
    try {
      ports = await SerialPort.list();
    } catch (error) {
      this.log("ERROR", "Failed to list serial ports", error?.message || error);
      return null;
    }

    const vendorIds = new Set(this.config.vendorIds.map((id) => String(id).toLowerCase()));

    for (const port of ports) {
      const path = port.path || "";
      const vendorId = String(port.vendorId || "").toLowerCase();
      const pathMatch = this.config.pathHints.some((hint) => path.startsWith(hint));
      const vendorMatch = vendorId && vendorIds.has(vendorId);

      if (pathMatch || vendorMatch) {
        this.log("INFO", "Arduino found", {
          path,
          vendorId: port.vendorId || null,
          manufacturer: port.manufacturer || null,
          productId: port.productId || null,
        });
        return path;
      }
    }

    this.log("WARN", "No Arduino detected");
    return null;
  }

  async connect() {
    if (this.connecting || this.port?.isOpen) return;
    this.connecting = true;

    try {
      const path = await this.findArduino();
      if (!path) {
        await this.scheduleScan();
        return;
      }

      this.log("INFO", `Connecting to ${path} at ${this.config.baudRate} baud`);
      const port = new SerialPort({
        path,
        baudRate: this.config.baudRate,
        autoOpen: false,
      });

      this.port = port;
      this.parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

      port.on("open", () => {
        this.log("INFO", `Connected to ${path}`);
      });

      port.on("close", () => {
        this.log("WARN", `Disconnected from ${path}`);
        this.cleanupPort();
        if (!this.stopping) this.scheduleReconnect();
      });

      port.on("error", (error) => {
        this.log("ERROR", `Serial error on ${path}`, error?.message || error);
        this.emit("ERROR", error);
      });

      this.parser.on("data", (line) => this.handleCommand(line));

      await new Promise((resolve, reject) => {
        port.open((error) => (error ? reject(error) : resolve()));
      });

      this.emit("READY");
    } catch (error) {
      this.log("ERROR", "Failed to connect", error?.message || error);
      this.cleanupPort();
      if (!this.stopping) await this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  async disconnect() {
    this.clearTimers();

    const port = this.port;
    this.cleanupPort();
    if (!port) return;

    await new Promise((resolve) => {
      try {
        if (!port.isOpen) return resolve();
        port.close((error) => {
          if (error) this.log("WARN", "Close error", error?.message || error);
          resolve();
        });
      } catch (error) {
        this.log("WARN", "Disconnect failure", error?.message || error);
        resolve();
      }
    });
  }

  cleanupPort() {
    if (this.parser) {
      this.parser.removeAllListeners();
      this.parser = null;
    }
    if (this.port) {
      this.port.removeAllListeners();
      this.port = null;
    }
  }

  async scheduleReconnect() {
    if (this.reconnectTimer || this.stopping || !this.started) return;
    this.log("WARN", `Reconnecting in ${this.config.reconnectDelayMs}ms`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.stopping || !this.started) return;
      await this.connect();
    }, this.config.reconnectDelayMs);
  }

  async scheduleScan(delayMs = this.config.scanIntervalMs) {
    if (this.scanTimer || this.stopping || !this.started) return;
    this.log("INFO", `Scanning again in ${delayMs}ms`);
    this.scanTimer = setTimeout(async () => {
      this.scanTimer = null;
      if (this.stopping || !this.started) return;
      await this.connect();
      if (!this.port?.isOpen) {
        await this.scheduleScan();
      }
    }, delayMs);
  }

  handleCommand(rawLine) {
    const command = String(rawLine || "").trim();
    if (!command) return;

    const normalized = command.toUpperCase();
    this.log("INFO", `Received command: ${normalized}`);

    if (COMMAND_EVENTS.has(normalized)) {
      this.emit(normalized);
      return;
    }

    this.log("WARN", `Unknown command: ${normalized}`);
    this.emit("UNKNOWN", normalized);
  }
}

export { CONFIG };
