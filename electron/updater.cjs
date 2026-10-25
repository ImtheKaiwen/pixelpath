const { app, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const { initialUpdateState, reduceUpdateState } = require("./update-state.cjs");

let state = initialUpdateState(app.getVersion());
let targetWindow;
let configured = false;
let periodicCheck;

function publish(event) {
  state = reduceUpdateState(state, event);
  if (targetWindow && !targetWindow.isDestroyed()) {
    targetWindow.webContents.send("updates:state", state);
  }
}

function setupUpdater(window) {
  targetWindow = window;
  if (configured) return;
  configured = true;
  ipcMain.handle("updates:get-state", () => state);
  ipcMain.on("updates:check", () => {
    check();
  });
  ipcMain.on("updates:download", () => {
    if (app.isPackaged && state.state === "available") {
      publish({ type: "download-started" });
      autoUpdater.downloadUpdate().catch(onError);
    }
  });
  ipcMain.on("updates:install", () => {
    if (state.state === "downloaded") autoUpdater.quitAndInstall(false, true);
  });
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on("checking-for-update", () => publish({ type: "checking" }));
  autoUpdater.on("update-available", (info) =>
    publish({
      type: "available",
      version: info.version,
      releaseNotes: normalizeNotes(info.releaseNotes),
      percent: 0,
      message: undefined,
    }),
  );
  autoUpdater.on("update-not-available", () => publish({ type: "none" }));
  autoUpdater.on("download-progress", (progress) =>
    publish({
      type: "progress",
      percent: Math.round(progress.percent || 0),
    }),
  );
  autoUpdater.on("update-downloaded", (info) =>
    publish({
      type: "downloaded",
      version: info.version,
    }),
  );
  autoUpdater.on("error", onError);
  setTimeout(check, 3500);
  periodicCheck = setInterval(check, 6 * 60 * 60 * 1000);
  periodicCheck.unref?.();
}

function check() {
  if (!app.isPackaged || state.state === "downloading") return;
  autoUpdater.checkForUpdates().catch(onError);
}

function normalizeNotes(notes) {
  if (Array.isArray(notes))
    return notes
      .map((item) => item.note || "")
      .filter(Boolean)
      .join("\n");
  return typeof notes === "string" ? notes : "";
}

function onError(error) {
  console.error("PixelPath updater", error);
  if (/404|latest\.yml|no published versions?/i.test(error?.message || "")) {
    publish({ type: "none" });
    return;
  }
  publish({ type: "error", message: error?.message || String(error) });
}

module.exports = { setupUpdater };
