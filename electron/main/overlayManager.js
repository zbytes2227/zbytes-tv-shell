const { BrowserView } = require("electron");
const path = require("path");

class OverlayManager {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.overlayView = null;
        this.readyPromise = null;
        this.hideTimer = null;
        this.activeType = null;
    }

    getAutoHideMs(type) {
        switch (type) {
            case "volume":
                return 1600;
            case "mute":
                return 1400;
            case "notification":
                return 2200;
            case "power":
                return 6000;
            case "bluetooth-connected":
                return 2200;
            default:
                return 1800;
        }
    }

    async create() {
        if (this.overlayView && !this.overlayView.webContents.isDestroyed()) {
            return this.overlayView;
        }

        this.overlayView = new BrowserView({
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, "../overlay/preload.js"),
            },
        });

        const view = this.overlayView;
        const syncBounds = () => {
            if (!view || view.webContents.isDestroyed()) return;
            const bounds = this.mainWindow.getBounds();
            view.setBounds({
                x: 0,
                y: 0,
                width: bounds.width,
                height: bounds.height,
            });
        };

        await view.webContents.loadFile(path.join(__dirname, "../overlay/overlay.html"));
        syncBounds();
        view.webContents.setBackgroundThrottling(false);

        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.setBrowserView(view);
        }

        this.mainWindow.on("resize", syncBounds);
        this.mainWindow.on("move", syncBounds);
        this.mainWindow.on("maximize", syncBounds);
        this.mainWindow.on("unmaximize", syncBounds);
        this.mainWindow.on("enter-full-screen", syncBounds);
        this.mainWindow.on("leave-full-screen", syncBounds);

        this.readyPromise = Promise.resolve(view);
        return view;
    }

    async ensureReady() {
        if (!this.readyPromise) {
            await this.create();
        }
        return this.readyPromise;
    }

    async runScript(script) {
        const view = await this.ensureReady();
        if (!view || view.webContents.isDestroyed()) return;
        await view.webContents.executeJavaScript(script, true);
    }

    async show(payload) {
        const view = await this.ensureReady();
        if (!view || view.webContents.isDestroyed()) return;

        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }

        this.activeType = payload?.type || null;
        await this.runScript(`window.__overlay && window.__overlay.show(${JSON.stringify(payload)})`);
        this.mainWindow.setBrowserView(view);
        const bounds = this.mainWindow.getBounds();
        view.setBounds({
            x: 0,
            y: 0,
            width: bounds.width,
            height: bounds.height,
        });
        view.setAutoResize({ width: true, height: true });
        view.webContents.focus();
        this.scheduleHide(this.getAutoHideMs(payload?.type));
        return true;
    }

    async hide() {
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }

        const view = await this.ensureReady();
        if (!view || view.webContents.isDestroyed()) return;
        await this.runScript(`window.__overlay && window.__overlay.hide()`);
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.removeBrowserView(view);
            this.mainWindow.show();
            this.mainWindow.focus();
            this.mainWindow.webContents.focus();
            setTimeout(() => {
                if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                    this.mainWindow.webContents.focus();
                }
            }, 0);
        }
        this.activeType = null;
    }

    scheduleHide(ms) {
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
        }
        this.hideTimer = setTimeout(() => {
            this.hide().catch((error) => {
                console.error("Failed to hide overlay:", error);
            });
        }, ms);
    }

    showVolume(volume) {
        return this.show({ type: "volume", volume: Number(volume) });
    }

    showMute(muted, volume = null) {
        return this.show({
            type: "mute",
            muted: Boolean(muted),
            volume: volume === null || volume === undefined ? null : Number(volume),
        });
    }

    showPowerDialog() {
        return this.show({ type: "power" });
    }

    showNotification(title, message) {
        return this.show({ type: "notification", title, message });
    }

    showLoading(message = "Loading...") {
        return this.show({ type: "loading", message });
    }

    showInternetLost() {
        return this.show({ type: "internet-lost" });
    }

    showBluetoothConnected(deviceName = "Bluetooth connected") {
        return this.show({ type: "bluetooth-connected", deviceName });
    }

    isPowerDialogVisible() {
        return this.activeType === "power";
    }

    async sendRemoteKey(command) {
        if (!this.overlayView || this.overlayView.webContents.isDestroyed()) return false;
        if (!this.isPowerDialogVisible()) return false;

        try {
            const handled = await this.overlayView.webContents.executeJavaScript(
                `window.__overlay && window.__overlay.remote && window.__overlay.remote(${JSON.stringify(command)})`,
                true
            );
            if (handled) {
                this.overlayView.webContents.focus();
            }
            return Boolean(handled);
        } catch (error) {
            console.error("Failed to route remote key to overlay:", error);
            return false;
        }
    }
}

module.exports = OverlayManager;
