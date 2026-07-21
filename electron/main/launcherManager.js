const path = require("path");

const TV_USER_AGENT =
    "Mozilla/5.0 (Linux; Android 12; Google TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

class LauncherManager {

    constructor(window) {
        this.window = window;
        this.launcherUrl = "http://localhost:3000";
    }

    async _load(url, userAgent = null) {
        try {
            if (userAgent) {
                this.window.webContents.setUserAgent(userAgent);
            }
            await this.window.loadURL(url);
        } catch (error) {
            if (error?.code === "ERR_ABORTED" || error?.errno === -3) {
                return;
            }
            throw error;
        }
    }

    async showLauncher() {
        console.log("Loading Launcher...");
        await this._load(this.launcherUrl, null);
        this.window.webContents.clearHistory();
    }

    async reload() {
        await this.window.reload();
    }

    async openApp(url, userAgent = TV_USER_AGENT) {
        await this._load(url, userAgent);
    }

    goBack() {
        if (this.window.webContents.navigationHistory.canGoBack()) {
            this.window.webContents.goBack();
        }
    }

    goForward() {
        if (this.window.webContents.navigationHistory.canGoForward()) {
            this.window.webContents.goForward();
        }
    }
}

module.exports = LauncherManager;
