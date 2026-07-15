const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const KEY_LIFETIME_MS = 24 * 60 * 60 * 1000;
const PENDING_LIFETIME_MS = 30 * 60 * 1000;
const MIN_LINKVERTISE_TIME_MS = 25 * 1000;
const STORE_PATH = path.join(__dirname, "keys.json");

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

function cleanStore(keys) {
  const now = Date.now();
  keys.__pending = keys.__pending || {};

  for (const [key, data] of Object.entries(keys)) {
    if (key !== "__pending" && (!data.expiresAt || data.expiresAt <= now)) {
      delete keys[key];
    }
  }

  for (const [session, data] of Object.entries(keys.__pending)) {
    if (!data.expiresAt || data.expiresAt <= now) {
      delete keys.__pending[session];
    }
  }
}

function getCookie(req, name) {
  const cookieHeader = req.headers.cookie || "";
  const cookies = cookieHeader.split(";").map((part) => part.trim());

  for (const cookie of cookies) {
    const index = cookie.indexOf("=");
    if (index === -1) continue;

    if (cookie.slice(0, index) === name) {
      return decodeURIComponent(cookie.slice(index + 1));
    }
  }

  return "";
}

function makeSession() {
  return crypto.randomBytes(24).toString("base64url");
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

function page(res, title, body, extraHeaders = {}) {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
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
    button:disabled { cursor: not-allowed; opacity: 0.6; }
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
    .hidden { display: none; }
    .tiny { font-size: 13px; }
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

function redirect(res, location, extraHeaders = {}) {
  res.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end();
}

function sessionCookie(session) {
  return `key_session=${encodeURIComponent(session)}; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(PENDING_LIFETIME_MS / 1000)}; Path=/`;
}

function clearSessionCookie() {
  return "key_session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/";
}

function createKeyPage(res, keys, session) {
  delete keys.__pending[session];

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
    `<div class="status">
      <span class="check">&#10003;</span>
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
    </script>`,
    {
      "Set-Cookie": clearSessionCookie(),
    }
  );
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const keys = loadKeys();
  cleanStore(keys);

  if (url.pathname === "/" || url.pathname === "/generate-key") {
    saveKeys(keys);
    return page(
      res,
      "Get Your Key",
      `<h1>Get Your Key</h1>
      <p>Click the button below to open Linkvertise. After you finish it, this site will generate your 24 hour key.</p>
      <a href="/go" target="_blank" rel="noopener" id="openLink">Click Here To Open Linkvertise</a>
      <div id="fallback" class="hidden">
        <p>If Linkvertise does not bring you back automatically, come back to this tab and press this button after you finish.</p>
        <button id="claimButton" disabled>Wait 25 seconds...</button>
      </div>
      <script>
        const openLink = document.getElementById("openLink");
        const fallback = document.getElementById("fallback");
        const claimButton = document.getElementById("claimButton");
        let secondsLeft = 25;

        openLink.addEventListener("click", () => {
          fallback.classList.remove("hidden");
          const interval = setInterval(() => {
            secondsLeft -= 1;
            if (secondsLeft <= 0) {
              clearInterval(interval);
              claimButton.disabled = false;
              claimButton.textContent = "I Finished Linkvertise";
              return;
            }
            claimButton.textContent = "Wait " + secondsLeft + " seconds...";
          }, 1000);
        });

        claimButton.addEventListener("click", () => {
          window.location.href = "/claim";
        });
      </script>`
    );
  }

  if (url.pathname === "/go") {
    const session = makeSession();
    keys.__pending[session] = {
      createdAt: Date.now(),
      expiresAt: Date.now() + PENDING_LIFETIME_MS,
    };
    saveKeys(keys);

    return redirect(res, LINKVERTISE_URL, {
      "Set-Cookie": sessionCookie(session),
    });
  }

  if (url.pathname === "/unlock") {
    const pass = String(url.searchParams.get("pass") || "");
    const session = getCookie(req, "key_session");
    const pending = session && keys.__pending[session];

    if (pass !== UNLOCK_PASS || !pending) {
      saveKeys(keys);
      return page(
        res,
        "Locked",
        `<h1>Locked</h1>
        <p>You need to start from the key page and finish Linkvertise in the same browser.</p>
        <a href="/generate-key">Go Through Linkvertise</a>`
      );
    }

    return createKeyPage(res, keys, session);
  }

  if (url.pathname === "/claim") {
    const session = getCookie(req, "key_session");
    const pending = session && keys.__pending[session];

    if (!pending) {
      saveKeys(keys);
      return page(
        res,
        "Locked",
        `<h1>Locked</h1>
        <p>Open Linkvertise from the key page first, then come back here.</p>
        <a href="/generate-key">Go Through Linkvertise</a>`
      );
    }

    const elapsed = Date.now() - pending.createdAt;
    if (elapsed < MIN_LINKVERTISE_TIME_MS) {
      saveKeys(keys);
      const waitSeconds = Math.ceil((MIN_LINKVERTISE_TIME_MS - elapsed) / 1000);
      return page(
        res,
        "Almost Ready",
        `<h1>Almost Ready</h1>
        <p>Finish Linkvertise first. Try again in ${waitSeconds} seconds.</p>
        <a href="/generate-key">Back</a>`
      );
    }

    return createKeyPage(res, keys, session);
  }

  if (url.pathname === "/check-key") {
    const key = String(url.searchParams.get("key") || "").trim().toUpperCase();

    if (!key) {
      saveKeys(keys);
      return json(res, { valid: false, reason: "missing" });
    }

    const data = keys[key];
    if (!data || key === "__pending") {
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
