const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const KEY_LIFETIME_MS = 24 * 60 * 60 * 1000;
const STORE_PATH = path.join(__dirname, "keys.json");

// Render settings:
// LINKVERTISE_URL = your Linkvertise link
// UNLOCK_PASS = your private return password
const LINKVERTISE_URL =
  process.env.LINKVERTISE_URL || "https://link-target.net/7498733/KpuqK9Bry5Xg";
const UNLOCK_PASS = process.env.UNLOCK_PASS || "jack-key-pass-2026";
const PUBLIC_SITE = "https://roblox-key-system-hr3h.onrender.com";

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

function removeExpiredKeys(keys) {
  const now = Date.now();
  for (const [key, data] of Object.entries(keys)) {
    if (!data.expiresAt || data.expiresAt <= now) {
      delete keys[key];
    }
  }
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

function sendPage(res, title, body) {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });

  res.end(`<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #101216;
      --panel: #1b2029;
      --panel-2: #0b0d11;
      --line: #343b4a;
      --text: #f6f7fb;
      --muted: #b9c0ce;
      --green: #26a65b;
      --green-hover: #31bd6c;
      --red: #ef6262;
      --gold: #f0c75e;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background: var(--bg);
      color: var(--text);
      font-family: Arial, sans-serif;
    }
    main {
      width: min(780px, 100%);
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 22px;
    }
    h1 { margin: 0 0 10px; font-size: 28px; }
    p { color: var(--muted); line-height: 1.45; }
    a, button {
      appearance: none;
      border: 0;
      border-radius: 6px;
      background: var(--green);
      color: white;
      cursor: pointer;
      display: inline-block;
      font-weight: 700;
      margin-top: 10px;
      padding: 12px 16px;
      text-decoration: none;
    }
    a:hover, button:hover { background: var(--green-hover); }
    code {
      display: block;
      overflow-wrap: anywhere;
      background: var(--panel-2);
      border: 1px solid var(--line);
      border-radius: 6px;
      color: white;
      font-size: 16px;
      line-height: 1.45;
      margin: 8px 0 14px;
      padding: 14px;
    }
    .error { color: var(--red); }
    .status {
      align-items: center;
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
    }
    .check {
      align-items: center;
      background: var(--green);
      border-radius: 999px;
      color: white;
      display: inline-flex;
      font-size: 20px;
      font-weight: 900;
      height: 34px;
      justify-content: center;
      width: 34px;
    }
    .timer {
      background: rgba(240, 199, 94, 0.12);
      border: 1px solid rgba(240, 199, 94, 0.35);
      border-radius: 6px;
      color: var(--gold);
      font-size: 20px;
      font-weight: 800;
      margin: 10px 0 14px;
      padding: 12px 14px;
    }
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`);
}

function sendJson(res, data) {
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function redirect(res, location) {
  res.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store",
  });
  res.end();
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const keys = loadKeys();
  removeExpiredKeys(keys);

  if (url.pathname === "/") {
    saveKeys(keys);
    return sendPage(
      res,
      "Key System",
      `<h1>Key System</h1>
      <p>Press the button, finish Linkvertise, then you will get a 24 hour key.</p>
      <a href="/generate-key">Get Key</a>`
    );
  }

  if (url.pathname === "/generate-key") {
    saveKeys(keys);

    if (!LINKVERTISE_URL) {
      return sendPage(
        res,
        "Render Setup Needed",
        `<h1>Render Setup Needed</h1>
        <p class="error">Your website is working, but Render is missing <b>LINKVERTISE_URL</b>.</p>
        <p>Go to Render, open this website, then add these Environment variables:</p>
        <p><b>LINKVERTISE_URL</b></p>
        <code>paste your Linkvertise link here</code>
        <p><b>UNLOCK_PASS</b></p>
        <code>${escapeHtml(UNLOCK_PASS)}</code>
        <p>In Linkvertise, set the destination URL to:</p>
        <code>${escapeHtml(PUBLIC_SITE)}/unlock?pass=${escapeHtml(UNLOCK_PASS)}</code>`
      );
    }

    return sendPage(
      res,
      "Open Linkvertise",
      `<h1>Get Your Key</h1>
      <p>Click the button below to open Linkvertise. After you finish it, you will be sent back here and your 24 hour key will be generated.</p>
      <a href="${escapeHtml(LINKVERTISE_URL)}">Click Here To Open Linkvertise</a>
      <p>Return page after Linkvertise:</p>
      <code>${escapeHtml(PUBLIC_SITE)}/unlock?pass=${escapeHtml(UNLOCK_PASS)}</code>`
    );
  }

  if (url.pathname === "/unlock") {
    const pass = String(url.searchParams.get("pass") || "");

    if (pass !== UNLOCK_PASS) {
      saveKeys(keys);
      return sendPage(
        res,
        "Locked",
        `<h1>Locked</h1>
        <p>You need to finish Linkvertise first.</p>
        <a href="/generate-key">Go Through Linkvertise</a>`
      );
    }

    const key = makeKey();
    const expiresAt = Date.now() + KEY_LIFETIME_MS;
    keys[key] = {
      createdAt: Date.now(),
      expiresAt,
    };
    saveKeys(keys);

    return sendPage(
      res,
      "Your Key",
      `<div class="status">
        <span class="check">✓</span>
        <h1>Key Generated</h1>
      </div>
      <p>Your key is ready. Copy it and paste it into the Roblox loader.</p>
      <code id="key">${escapeHtml(key)}</code>
      <button onclick="navigator.clipboard.writeText(document.getElementById('key').textContent)">Copy Key</button>
      <div class="timer" id="timer">24:00:00</div>
      <p>Expires: ${escapeHtml(new Date(expiresAt).toLocaleString())}</p>
      <script>
        const expiresAt = ${expiresAt};
        const timer = document.getElementById("timer");

        function updateTimer() {
          const left = Math.max(0, expiresAt - Date.now());
          const totalSeconds = Math.floor(left / 1000);
          const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
          const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
          const seconds = String(totalSeconds % 60).padStart(2, "0");
          timer.textContent = left > 0 ? hours + ":" + minutes + ":" + seconds : "Expired";
        }

        updateTimer();
        setInterval(updateTimer, 1000);
      </script>`
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
  console.log(`Key server running on port ${PORT}`);
});
