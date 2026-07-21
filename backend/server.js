const express = require("express");
const cors = require("cors");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const BACKEND_DIR = __dirname;
const APPS_FILE = path.join(BACKEND_DIR, "apps.json");
const LAUNCHER_DIST_DIR = path.join(BACKEND_DIR, "../launcher/dist");
const INDEX_FILE = path.join(LAUNCHER_DIST_DIR, "index.html");

app.use(cors());
app.use(express.json());

async function readApps() {
  const raw = await fs.readFile(APPS_FILE, "utf8");
  const apps = JSON.parse(raw);

  if (!Array.isArray(apps)) {
    throw new Error("apps.json must contain an array");
  }

  return apps;
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/apps", async (_req, res) => {
  try {
    const apps = await readApps();
    res.json(apps);
  } catch (error) {
    console.error("Failed to load apps.json:", error);
    res.status(500).json({
      error: "Unable to load app list.",
    });
  }
});

app.use(express.static(LAUNCHER_DIST_DIR, { fallthrough: true }));

app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api/") || req.path === "/apps") return next();

  res.sendFile(INDEX_FILE, (err) => {
    if (err) next(err);
  });
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled backend error:", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
