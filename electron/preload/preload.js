const { contextBridge, ipcRenderer } = require("electron");

function invoke(channel, payload = {}) {
  return ipcRenderer.invoke(channel, payload);
}

contextBridge.exposeInMainWorld("zbytes", {
  openApp: (appId) => invoke("zbytes:open-app", { appId }),
  showLauncher: () => invoke("zbytes:show-launcher"),
  reload: () => invoke("zbytes:reload"),
  goBack: () => invoke("zbytes:go-back"),
  goForward: () => invoke("zbytes:go-forward"),
  systemAction: (action) => invoke("zbytes:system-action", { action }),
  settings: {
    getDisplays: () => invoke("zbytes:settings:get-displays"),
    setDisplay: (id, enabled = true) => invoke("zbytes:settings:set-display", { id, enabled }),
    toggleDisplay: (id, enabled) => invoke("zbytes:settings:toggle-display", { id, enabled }),
    getWifi: () => invoke("zbytes:settings:get-wifi"),
    scanWifi: () => invoke("zbytes:settings:scan-wifi"),
    connectWifi: (ssid, password) => invoke("zbytes:settings:connect-wifi", { ssid, password }),
    disconnectWifi: () => invoke("zbytes:settings:disconnect-wifi"),
    forgetWifi: (ssid) => invoke("zbytes:settings:forget-wifi", { ssid }),
    toggleWifi: (enabled) => invoke("zbytes:settings:toggle-wifi", { enabled }),
    getBluetooth: () => invoke("zbytes:settings:get-bluetooth"),
    scanBluetooth: () => invoke("zbytes:settings:scan-bluetooth"),
    pairBluetooth: (mac) => invoke("zbytes:settings:pair-bluetooth", { mac }),
    connectBluetooth: (mac) => invoke("zbytes:settings:connect-bluetooth", { mac }),
    disconnectBluetooth: (mac) => invoke("zbytes:settings:disconnect-bluetooth", { mac }),
    removeBluetooth: (mac) => invoke("zbytes:settings:remove-bluetooth", { mac }),
    toggleBluetooth: (enabled) => invoke("zbytes:settings:toggle-bluetooth", { enabled }),
    getAudioDevices: () => invoke("zbytes:settings:get-audio-devices"),
    setAudioDevice: (id) => invoke("zbytes:settings:set-audio-device", { id }),
    getVolume: () => invoke("zbytes:settings:get-volume"),
  },
});

