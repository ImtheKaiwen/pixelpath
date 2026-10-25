const { app, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");

let state = { state: "idle", percent: 0, version: app.getVersion() };
let targetWindow;

function publish(patch) {
  state = { ...state, ...patch };
  if (targetWindow && !targetWindow.isDestroyed()) {
    targetWindow.webContents.send("updates:state", state);
  }
}

function setupUpdater(window) {
  targetWindow = window;
  ipcMain.handle("updates:get-state", () => state);
  ipcMain.on("updates:check", () => {
    if (app.isPackaged) autoUpdater.checkForUpdates().catch(onError);
  });
  ipcMain.on("updates:install", () => {
    if (state.state === "downloaded") autoUpdater.quitAndInstall(false, true);
  });
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () => publish({ state: "checking" }));
  autoUpdater.on("update-available", (info) =>
    publish({ state: "available", version: info.version, percent: 0 }),
  );
  autoUpdater.on("update-not-available", () =>
    publish({ state: "not-available" }),
  );
  autoUpdater.on("download-progress", (progress) =>
    publish({
      state: "downloading",
      percent: Math.round(progress.percent || 0),
    }),
  );
  autoUpdater.on("update-downloaded", (info) =>
    publish({ state: "downloaded", version: info.version, percent: 100 }),
  );
  autoUpdater.on("error", onError);
  setTimeout(() => autoUpdater.checkForUpdates().catch(onError), 3500);
}

function onError(error) {
  console.error("PixelPath updater", error);
  if (/404|latest\.yml|no published versions?/i.test(error?.message || "")) {
    publish({ state: "not-available", message: undefined });
    return;
  }
  publish({ state: "error", message: error?.message || String(error) });
}

module.exports = { setupUpdater };
