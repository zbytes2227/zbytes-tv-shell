const { BrowserWindow } = require("electron");
const path = require("path");

class WindowManager {
    constructor() {
        this.window = null;
    }

    create() {
        this.window = new BrowserWindow({
            titleBarStyle: "hidden",
            frame: false,
            fullscreen: true,
            kiosk: true,
            autoHideMenuBar: true,
            show: false,
            backgroundColor: "#000334",
            webPreferences: {
                preload: path.join(__dirname, "../preload/preload.js"),
                contextIsolation: true,
                nodeIntegration: false,
            },
        });

        this.window.once("ready-to-show", () => {
            this.window.maximize();
            this.window.setFullScreen(true);
            this.window.setKiosk(true);
            this.window.setMenuBarVisibility(false);
            this.window.show();
        });

        return this.window;
    }
}

module.exports = WindowManager;
