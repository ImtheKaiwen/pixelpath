const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");
const { app } = require("electron");

let backendProcess;

function commandExists(command) {
  const probe = process.platform === "win32" ? "where.exe" : "which";
  return spawnSync(probe, [command], { stdio: "ignore" }).status === 0;
}

function developmentCommand() {
  const script = path.join(app.getAppPath(), "backend", "app.py");
  if (process.env.PIXELPATH_PYTHON) {
    return [process.env.PIXELPATH_PYTHON, [script, "--port", "0", "--no-open"]];
  }
  if (commandExists("uv")) {
    return ["uv", ["run", "python", script, "--port", "0", "--no-open"]];
  }
  if (process.platform === "win32" && commandExists("py")) {
    return ["py", ["-3", script, "--port", "0", "--no-open"]];
  }
  return [
    process.platform === "win32" ? "python" : "python3",
    [script, "--port", "0", "--no-open"],
  ];
}

function packagedCommand() {
  const executable = path.join(
    process.resourcesPath,
    "backend",
    process.platform === "win32"
      ? "pixelpath-backend.exe"
      : "pixelpath-backend",
  );
  return [executable, ["--port", "0", "--no-open"]];
}

function startBackend(timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const [command, args] = app.isPackaged
      ? packagedCommand()
      : developmentCommand();
    backendProcess = spawn(command, args, {
      cwd: app.isPackaged ? process.resourcesPath : app.getAppPath(),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const timer = setTimeout(() => {
      stopBackend();
      reject(new Error("PixelPath backend zamanında başlamadı."));
    }, timeoutMs);
    backendProcess.stdout.on("data", (chunk) => {
      output += chunk.toString();
      const match = output.match(
        /PIXELPATH_READY\s+(http:\/\/127\.0\.0\.1:\d+)/,
      );
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    backendProcess.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    backendProcess.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    backendProcess.once("exit", (code) => {
      if (code && code !== 0)
        console.error("PixelPath backend exited", code, output);
    });
  });
}

function stopBackend() {
  if (!backendProcess || backendProcess.killed) return;
  const processToStop = backendProcess;
  backendProcess = undefined;
  if (process.platform === "win32" && processToStop.pid) {
    spawn("taskkill.exe", ["/pid", String(processToStop.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    return;
  }
  processToStop.kill("SIGTERM");
}

module.exports = { startBackend, stopBackend };
