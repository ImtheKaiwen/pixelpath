const path = require("node:path");
const { app, BrowserWindow, dialog, shell } = require("electron");
const { startBackend, stopBackend } = require("./backend.cjs");
const { setupUpdater } = require("./updater.cjs");

let mainWindow;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 900,
    minWidth: 720,
    minHeight: 560,
    show: false,
    backgroundColor: "#f7f7f5",
    icon: path.join(app.getAppPath(), "build", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("http://127.0.0.1:")) event.preventDefault();
  });
  try {
    const url = await startBackend();
    await mainWindow.loadURL(url);
    setupUpdater(mainWindow);
    mainWindow.show();
  } catch (error) {
    dialog.showErrorBox(
      "PixelPath başlatılamadı",
      `${error.message}\n\nPython backend çalıştırılamadı.`,
    );
    app.quit();
  }
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(() => {
    app.setAppUserModelId("com.kaiwen.pixelpath");
    createWindow();
  });
}

app.on("before-quit", stopBackend);
app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
