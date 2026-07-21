const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    systemAction: (action) => ipcRenderer.invoke("zbytes:system-action", { action }),
});
