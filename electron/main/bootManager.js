const { spawn } = require("child_process");
const path = require("path");

class BootManager {

    constructor(window, launcherManager) {

        this.window = window;

        this.backend = null;

        this.launcherManager = launcherManager

    }

    async boot() {

        console.log("Boot Started");

        await this.showSplash();

        await this.startBackend();

        await this.waitForBackend();

        await this.launcherManager.showLauncher();

    }

    async showSplash() {

        await this.window.loadFile(

            path.join(__dirname, "../splash/splash.html")

        );

    }

    async startBackend() {

        console.log("Starting Backend...");

        this.backend = spawn(

            "node",

            [path.join(__dirname, "../../backend/server.js")],

            {

                stdio: "inherit"

            }

        );

    }

    async waitForBackend() {

        console.log("Waiting for Backend...");

        while (true) {

            try {

                const res = await fetch("http://localhost:3000/api/health");

                if (res.ok) {

                    console.log("Backend Ready");

                    return;

                }

            }

            catch { }

            await new Promise(r => setTimeout(r, 300));

        }

    }


}

module.exports = BootManager;
