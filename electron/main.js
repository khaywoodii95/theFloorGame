import { app, BrowserWindow, shell, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !!process.env.VITE_DEV_SERVER_URL;

console.log("Electron main.js loaded, isDev:", isDev, "VITE_DEV_SERVER_URL:", process.env.VITE_DEV_SERVER_URL);

let mainWindow = null;
let hostDialogWindow = null;

function getPreloadPath() {
  if (isDev) {
    const built = path.join(__dirname, "../dist/preload.js");
    if (fs.existsSync(built)) return built;
    return path.join(__dirname, "../src/preload.ts");
  }

  const candidates = [
    path.join(process.resourcesPath, "app.asar.unpacked", "dist", "preload.js"),
    path.join(process.resourcesPath, "dist", "preload.js"),
    path.join(app.getAppPath(), "dist", "preload.js"),
  ];

  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    console.error("Preload not found in any expected location", candidates);
    return candidates[0];
  }

  return found;
}

function createHostDialogWindow() {
  if (hostDialogWindow && !hostDialogWindow.isDestroyed()) {
    hostDialogWindow.focus();
    return;
  }

  const preloadPath = getPreloadPath();
  console.log("Host dialog preload path:", preloadPath);
  console.log("Preload exists:", fs.existsSync(preloadPath));

  hostDialogWindow = new BrowserWindow({
    width: 380,
    height: 320,
    minWidth: 300,
    minHeight: 260,
    backgroundColor: "#0b0b0f",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
    },
    show: false,
  });

  hostDialogWindow.on("ready-to-show", () => {
    hostDialogWindow?.show();
  });

  hostDialogWindow.on("closed", () => {
    hostDialogWindow = null;
  });

  hostDialogWindow.webContents.on("crashed", () => {
    console.error("Host dialog window crashed");
  });

  hostDialogWindow.webContents.on("render-process-gone", (event, details) => {
    console.error("Host dialog render process gone:", details);
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    hostDialogWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}?hostDialog=true`);
    hostDialogWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexPath = path.join(__dirname, "../dist/index.html");
    hostDialogWindow.loadFile(indexPath, { hash: "hostDialog=true" });
  }
}

function createWindow() {
  const preloadPath = getPreloadPath();
  console.log("Main window preload path:", preloadPath);
  console.log("Preload exists:", fs.existsSync(preloadPath));

  const win = new BrowserWindow({
    width: 960,
    height: 900,
    minWidth: 600,
    minHeight: 500,
    backgroundColor: "#0b0b0f",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
    },
  });

  mainWindow = win;

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexPath = path.join(__dirname, "../dist/index.html");
    win.loadFile(indexPath);
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    // open external links in the default browser
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.on("hostDialog:open", () => {
    console.log("Received hostDialog:open request");
    createHostDialogWindow();
  });

  ipcMain.on("hostDialog:update", (event, data) => {
    console.log("Received hostDialog:update");
    if (hostDialogWindow && !hostDialogWindow.isDestroyed()) {
      hostDialogWindow.webContents.send("hostDialog:update", data);
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
