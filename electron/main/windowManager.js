const { BrowserWindow } = require("electron");
const path = require("path");

class WindowManager {

    constructor() {
        this.window = null;
    }

    create() {

        this.window = new BrowserWindow({

            fullscreen: true,

            autoHideMenuBar: true,

            backgroundColor: "#000334",

            show: false,

            titleBarStyle: "hidden",

            webPreferences: {

                preload: path.join(__dirname, "../preload/preload.js"),

                contextIsolation: true,

                nodeIntegration: false

            }

        });

        this.window.once("ready-to-show", () => {

            this.window.show();

        });

        return this.window;

    }

}

module.exports = WindowManager;