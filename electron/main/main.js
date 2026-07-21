const { app, ipcMain } = require("electron");
const fs = require("fs/promises");
const path = require("path");
const { pathToFileURL } = require("url");

const WindowManager = require("./windowManager");
const BootManager = require("./bootManager");
const LauncherManager = require("./launcherManager");
const SystemManager = require("./systemManager");
const OverlayManager = require("./overlayManager");

const APPS_FILE = path.join(__dirname, "../../backend/apps.json");

async function readApps() {
    const raw = await fs.readFile(APPS_FILE, "utf8");
    const apps = JSON.parse(raw);
    if (!Array.isArray(apps)) {
        throw new Error("apps.json must contain an array");
    }
    return apps;
}

app.whenReady().then(async () => {
    console.log(
        `[${new Date().toISOString()}] [INFO] Electron session env ${JSON.stringify({
            XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || null,
            DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS || null,
            WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY || null,
            DISPLAY: process.env.DISPLAY || null,
            PULSE_SERVER: process.env.PULSE_SERVER || null,
        })}`
    );

    const windowManager = new WindowManager();
    const mainWindow = windowManager.create();

    const launcherManager = new LauncherManager(mainWindow);
    const systemManager = new SystemManager();
    const overlayManager = new OverlayManager(mainWindow);
    const remoteModule = await import(
        pathToFileURL(path.join(__dirname, "remoteManager.mjs")).href
    );
    const RemoteManager = remoteModule.default;
    const remote = new RemoteManager();

    const remoteKeyMap = {
        UP: "Up",
        DOWN: "Down",
        LEFT: "Left",
        RIGHT: "Right",
        ENTER: "Enter",
        Escape: "Escape",
    };

    let lastRemoteEscapeAt = 0;

    const sendRemoteKey = (command) => {
        if (
            command === "Escape" &&
            mainWindow.webContents.getURL().startsWith("http://localhost:3000")
        ) {
            return;
        }

        const keyCode = remoteKeyMap[command];
        if (!keyCode) return;

        if (!mainWindow.isFocused()) {
            mainWindow.focus();
        }

        mainWindow.webContents.sendInputEvent({
            type: "rawKeyDown",
            keyCode,
        });
        mainWindow.webContents.sendInputEvent({
            type: "keyUp",
            keyCode,
        });
    };

    const sendRemoteEscapeOnce = () => {
        const now = Date.now();
        if (now - lastRemoteEscapeAt < 750) {
            return;
        }
        lastRemoteEscapeAt = now;
        sendRemoteKey("Escape");
    };

    const sendOverlayRemoteKey = async (command) => {
        if (!(await overlayManager.sendRemoteKey(command))) {
            return false;
        }
        return true;
    };

    ipcMain.handle("zbytes:open-app", async (_event, { appId }) => {
        if (!appId || typeof appId !== "string") {
            throw new Error("Missing appId");
        }

        const apps = await readApps();
        const appEntry = apps.find((item) => item && item.id === appId);
        if (!appEntry) {
            throw new Error(`Unknown appId: ${appId}`);
        }

        await launcherManager.openApp(appEntry.url, appEntry.userAgent || null);
        return { ok: true };
    });

    ipcMain.handle("zbytes:show-launcher", async () => {
        await launcherManager.showLauncher();
        return { ok: true };
    });

    ipcMain.handle("zbytes:reload", async () => {
        await launcherManager.reload();
        return { ok: true };
    });

    ipcMain.handle("zbytes:go-back", async () => {
        launcherManager.goBack();
        return { ok: true };
    });

    ipcMain.handle("zbytes:go-forward", async () => {
        launcherManager.goForward();
        return { ok: true };
    });

    ipcMain.handle("zbytes:system-action", async (_event, { action }) => {
        switch (action) {
            case "volume-up":
                {
                    const state = await systemManager.volumeUp();
                    overlayManager.showVolume(state.volume ?? 0);
                }
                break;
            case "volume-down":
                {
                    const state = await systemManager.volumeDown();
                    overlayManager.showVolume(state.volume ?? 0);
                }
                break;
            case "mute-toggle":
                {
                    const state = await systemManager.toggleMute();
                    overlayManager.showMute(Boolean(state.muted), state.volume ?? null);
                }
                break;
            case "power-off":
                overlayManager.showPowerDialog();
                await systemManager.powerOff();
                break;
            case "restart":
                overlayManager.showPowerDialog();
                await systemManager.restart();
                break;
            case "sleep":
                overlayManager.showPowerDialog();
                await systemManager.sleep();
                break;
            default:
                throw new Error(`Unknown system action: ${action}`);
        }

        return { ok: true };
    });

    ipcMain.handle("zbytes:settings:get-displays", async () => systemManager.getDisplays());
    ipcMain.handle("zbytes:settings:set-display", async (_event, { id, enabled }) =>
        systemManager.setDisplay(id, enabled)
    );
    ipcMain.handle("zbytes:settings:toggle-display", async (_event, { id, enabled }) =>
        systemManager.toggleDisplay(id, enabled)
    );

    ipcMain.handle("zbytes:settings:get-wifi", async () => systemManager.getWifi());
    ipcMain.handle("zbytes:settings:scan-wifi", async () => systemManager.scanWifi());
    ipcMain.handle("zbytes:settings:toggle-wifi", async (_event, { enabled }) =>
        systemManager.toggleWifi(enabled)
    );
    ipcMain.handle("zbytes:settings:connect-wifi", async (_event, { ssid, password }) =>
        systemManager.connectWifi(ssid, password)
    );
    ipcMain.handle("zbytes:settings:disconnect-wifi", async () => systemManager.disconnectWifi());
    ipcMain.handle("zbytes:settings:forget-wifi", async (_event, { ssid }) =>
        systemManager.forgetWifi(ssid)
    );

    ipcMain.handle("zbytes:settings:get-bluetooth", async () => systemManager.getBluetooth());
    ipcMain.handle("zbytes:settings:scan-bluetooth", async () => systemManager.scanBluetooth());
    ipcMain.handle("zbytes:settings:toggle-bluetooth", async (_event, { enabled }) =>
        systemManager.toggleBluetooth(enabled)
    );
    ipcMain.handle("zbytes:settings:pair-bluetooth", async (_event, { mac }) =>
        systemManager.pairBluetooth(mac)
    );
    ipcMain.handle("zbytes:settings:connect-bluetooth", async (_event, { mac }) =>
        systemManager.connectBluetooth(mac)
    );
    ipcMain.handle("zbytes:settings:disconnect-bluetooth", async (_event, { mac }) =>
        systemManager.disconnectBluetooth(mac)
    );
    ipcMain.handle("zbytes:settings:remove-bluetooth", async (_event, { mac }) =>
        systemManager.removeBluetooth(mac)
    );

    ipcMain.handle("zbytes:settings:get-audio-devices", async () => systemManager.getAudioDevices());
    ipcMain.handle("zbytes:settings:set-audio-device", async (_event, { id }) =>
        systemManager.setAudioDevice(id)
    );
    ipcMain.handle("zbytes:settings:get-volume", async () => systemManager.getVolume());

    mainWindow.webContents.on("before-input-event", (_event, input) => {
        const isBackKey =
            input.key === "BrowserBack" ||
            input.key === "Backspace" ||
            (input.alt && input.key === "ArrowLeft");

        if (!isBackKey) return;

        launcherManager.goBack();
    });

    remote.on("READY", () => {
        console.log("Remote ready");
    });

    remote.on("UP", async () => {
        if (!(await sendOverlayRemoteKey("UP"))) sendRemoteKey("UP");
    });

    remote.on("DOWN", async () => {
        if (!(await sendOverlayRemoteKey("DOWN"))) sendRemoteKey("DOWN");
    });

    remote.on("LEFT", async () => {
        if (!(await sendOverlayRemoteKey("LEFT"))) sendRemoteKey("LEFT");
    });

    remote.on("RIGHT", async () => {
        if (!(await sendOverlayRemoteKey("RIGHT"))) sendRemoteKey("RIGHT");
    });

    remote.on("ENTER", async () => {
        if (!(await sendOverlayRemoteKey("ENTER"))) sendRemoteKey("ENTER");
    });

    remote.on("HOME", () => {
        launcherManager.showLauncher().catch((error) => {
            console.error("Failed to return to launcher:", error);
        });
    });

    remote.on("BACK", async () => {
        if (!(await sendOverlayRemoteKey("BACK"))) {
            sendRemoteEscapeOnce();
        }
    });

    remote.on("BROWSER_BACK", async () => {
        if (!(await sendOverlayRemoteKey("BACK"))) {
            sendRemoteEscapeOnce();
        }
    });

    remote.on("BROWSER_FORWARD", () => {
        launcherManager.goForward();
    });

    remote.on("MUTE", () => {
        systemManager.toggleMute().then((state) => {
            overlayManager.showMute(Boolean(state.muted), state.volume ?? null);
        }).catch((error) => {
            console.error("Failed to mute audio:", error);
        });
        mainWindow.webContents.send("remote:mute", "MUTE");
    });

    remote.on("VOLUME_UP", () => {
        systemManager.volumeUp().then((state) => {
            overlayManager.showVolume(state.volume ?? 0);
        }).catch((error) => {
            console.error("Failed to increase volume:", error);
        });
        mainWindow.webContents.send("remote:volume-up", "VOLUME_UP");
    });

    remote.on("VOLUME_DOWN", () => {
        systemManager.volumeDown().then((state) => {
            overlayManager.showVolume(state.volume ?? 0);
        }).catch((error) => {
            console.error("Failed to decrease volume:", error);
        });
        mainWindow.webContents.send("remote:volume-down", "VOLUME_DOWN");
    });

    remote.on("PAUSE", () => {
        mainWindow.webContents.send("remote:pause", "PAUSE");
    });

    remote.on("RESUME", () => {
        mainWindow.webContents.send("remote:resume", "RESUME");
    });

    remote.on("POWER", () => {
        overlayManager.showPowerDialog();
    });

    remote.on("UNKNOWN", (command) => {
        console.warn(`Unknown remote command: ${command}`);
    });

    const bootManager = new BootManager(
        mainWindow,
        launcherManager
    );

    await bootManager.boot();
    await remote.start();
});
