const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pixelpath", {
  platform: process.platform,
  updates: {
    getState: () => ipcRenderer.invoke("updates:get-state"),
    check: () => ipcRenderer.send("updates:check"),
    download: () => ipcRenderer.send("updates:download"),
    install: () => ipcRenderer.send("updates:install"),
    subscribe: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("updates:state", listener);
      return () => ipcRenderer.removeListener("updates:state", listener);
    },
  },
});
