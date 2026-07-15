const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const KEY_LIFETIME_MS = 24 * 60 * 60 * 1000;
const STORE_PATH = path.join(__dirname, "keys.json");

function loadKeys() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveKeys(keys) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(keys, null, 2));
}

function pruneExpired(keys) {
  const now = Date.now();
  for (const [key, data] of Object.entries(keys)) {
    if (!data.expiresAt || data.expiresAt <= now) {
      delete keys[key];
    }
  }
}

function sendJson(res, data) {
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function sendHtml(res, html) {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(html);
}

function makeKey() {
  return crypto.randomBytes(18).toString("base64url").toUpperCase();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const keys = loadKeys();
  pruneExpired(keys);

  if (url.pathname === "/") {
    saveKeys(keys);
    return sendHtml(
      res,
      `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Key System</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 680px; margin: 48px auto; padding: 0 18px; background: #111318; color: #f5f7fb; }
    a, button { background: #28a745; color: white; border: 0; border-radius: 6px; padding: 12px 16px; text-decoration: none; font-weight: 700; display: inline-block; }
    .box { background: #1d212b; border: 1px solid #343b4d; border-radius: 8px; padding: 18px; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Key System</h1>
    <p>Press the button to get a key that lasts 24 hours.</p>
    <a href="/generate-key">Generate Key</a>
  </div>
</body>
</html>`
    );
  }

  if (url.pathname === "/generate-key") {
    const key = makeKey();
    const expiresAt = Date.now() + KEY_LIFETIME_MS;
    keys[key] = { createdAt: Date.now(), expiresAt };
    saveKeys(keys);

    return sendHtml(
      res,
      `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Your Key</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 760px; margin: 48px auto; padding: 0 18px; background: #111318; color: #f5f7fb; }
    .box { background: #1d212b; border: 1px solid #343b4d; border-radius: 8px; padding: 18px; }
    code { display: block; overflow-wrap: anywhere; background: #07080c; border: 1px solid #343b4d; border-radius: 6px; padding: 14px; font-size: 18px; }
    button, a { background: #28a745; color: white; border: 0; border-radius: 6px; padding: 12px 16px; text-decoration: none; font-weight: 700; display: inline-block; margin-top: 12px; cursor: pointer; }
    .muted { color: #b9c0d0; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Your 24 Hour Key</h1>
    <code id="key">${escapeHtml(key)}</code>
    <button onclick="navigator.clipboard.writeText(document.getElementById('key').textContent)">Copy Key</button>
    <p class="muted">Expires: ${escapeHtml(new Date(expiresAt).toLocaleString())}</p>
    <a href="/generate-key">Generate Another</a>
  </div>
</body>
</html>`
    );
  }

  if (url.pathname === "/check-key") {
    const key = String(url.searchParams.get("key") || "").trim().toUpperCase();

    if (!key) {
      saveKeys(keys);
      return sendJson(res, { valid: false, reason: "missing" });
    }

    const data = keys[key];
    if (!data) {
      saveKeys(keys);
      return sendJson(res, { valid: false, reason: "invalid" });
    }

    if (data.expiresAt <= Date.now()) {
      delete keys[key];
      saveKeys(keys);
      return sendJson(res, { valid: false, reason: "expired" });
    }

    saveKeys(keys);
    return sendJson(res, {
      valid: true,
      expiresAt: data.expiresAt,
      timeLeftMs: data.expiresAt - Date.now(),
    });
  }

  saveKeys(keys);
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Key server running on http://localhost:${PORT}`);
});
