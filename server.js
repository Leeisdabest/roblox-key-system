const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const KEY_LIFETIME_MS = 24 * 60 * 60 * 1000;
const STORE_PATH = path.join(__dirname, "keys.json");

// Put these in Render > your service > Environment.
const LINKVERTISE_URL = process.env.LINKVERTISE_URL || "";
const UNLOCK_PASS = process.env.UNLOCK_PASS || "change-this-secret";

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

function page(res, title, body) {
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
      --green-hover: #2fbe6a;
      --red: #df5454;
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
      width: min(760px, 100%);
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
      font-size: 17px;
      line-height: 1.4;
      padding: 14px;
    }
    .error { color: var(--red); }
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`);
}

function json(res, data) {
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

function getBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${req.headers.host}`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const keys = loadKeys();
  removeExpiredKeys(keys);

  if (url.pathname === "/") {
    saveKeys(keys);
    return page(
      res,
      "Key System",
      `<h1>Key System</h1>
      <p>Go through Linkvertise first, then this site will generate a 24 hour key.</p>
      <a href="/generate-key">Get Key</a>`
    );
  }

  if (url.pathname === "/generate-key") {
    saveKeys(keys);

    if (!LINKVERTISE_URL) {
      const returnUrl = `${getBaseUrl(req)}/unlock?pass=${encodeURIComponent(UNLOCK_PASS)}`;
      return page(
        res,
        "Setup Needed",
        `<h1>Set Up Linkvertise</h1>
        <p class="error">LINKVERTISE_URL is missing in Render.</p>
        <p>In Render, add an environment variable named <b>LINKVERTISE_URL</b> with your Linkvertise link.</p>
        <p>In Linkvertise, set the final destination to this:</p>
        <code>${escapeHtml(returnUrl)}</code>`
      );
    }

    return redirect(res, LINKVERTISE_URL);
  }

  if (url.pathname === "/unlock") {
    const pass = String(url.searchParams.get("pass") || "");

    if (pass !== UNLOCK_PASS) {
      saveKeys(keys);
      return page(
        res,
        "Locked",
        `<h1>Locked</h1>
        <p>You need to finish the Linkvertise step before the key is generated.</p>
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

    return page(
      res,
      "Your Key",
      `<h1>Your 24 Hour Key</h1>
      <code id="key">${escapeHtml(key)}</code>
      <button onclick="navigator.clipboard.writeText(document.getElementById('key').textContent)">Copy Key</button>
      <p>Expires: ${escapeHtml(new Date(expiresAt).toLocaleString())}</p>`
    );
  }

  if (url.pathname === "/check-key") {
    const key = String(url.searchParams.get("key") || "").trim().toUpperCase();

    if (!key) {
      saveKeys(keys);
      return json(res, { valid: false, reason: "missing" });
    }

    const data = keys[key];

    if (!data) {
      saveKeys(keys);
      return json(res, { valid: false, reason: "invalid" });
    }

    if (data.expiresAt <= Date.now()) {
      delete keys[key];
      saveKeys(keys);
      return json(res, { valid: false, reason: "expired" });
    }

    saveKeys(keys);
    return json(res, {
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
