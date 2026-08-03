const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const KEY_LIFETIME_MS = 24 * 60 * 60 * 1000;
const PENDING_LIFETIME_MS = 30 * 60 * 1000;
const MIN_LINKVERTISE_TIME_MS = 25 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 90;
const STORE_PATH = path.join(__dirname, "keys.json");

const LINKVERTISE_URL =
  process.env.LINKVERTISE_URL || "https://direct-link.net/7498733/H8FEbAxxI1Ag";
const LINKVERTISE_URL_2 =
  process.env.LINKVERTISE_URL_2 || "https://link-hub.net/7498733/4KS2lmxbEPeM";
const UNLOCK_PASS =
  process.env.UNLOCK_PASS ||
  "3b913615466d0554a0ac12eb50fde9be4d35685300eef38ecf993a6ce7e45f12";
const PUBLIC_SITE = "https://roblox-key-system-hr3h.onrender.com";
const KEY_SIGNING_SECRET = process.env.KEY_SIGNING_SECRET || UNLOCK_PASS;
const rateBuckets = new Map();

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
  keys.__devices = keys.__devices || {};
  keys.__flows = keys.__flows || {};

  for (const [key, data] of Object.entries(keys)) {
    if (
      key !== "__pending" &&
      key !== "__devices" &&
      key !== "__flows" &&
      (!data.expiresAt || data.expiresAt <= now || !isValidKeyRecord(key, data))
    ) {
      delete keys[key];
    }
  }

  for (const [session, data] of Object.entries(keys.__pending)) {
    if (!data.expiresAt || data.expiresAt <= now) {
      delete keys.__pending[session];
    }
  }

  for (const [deviceKey, data] of Object.entries(keys.__devices)) {
    if (!data.expiresAt || data.expiresAt <= now || !keys[data.key]) {
      delete keys.__devices[deviceKey];
    }
  }

  for (const [flowKey, data] of Object.entries(keys.__flows)) {
    if (!data.expiresAt || data.expiresAt <= now) {
      delete keys.__flows[flowKey];
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

function cleanId(value, maxLength = 80) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_.-]/g, "")
    .slice(0, maxLength);
}

function getDeviceLookup(url) {
  const userId = cleanId(url.searchParams.get("userId"), 32);
  const deviceId = cleanId(url.searchParams.get("deviceId"), 80);

  if (!userId || !deviceId) return null;

  return {
    userId,
    deviceId,
    lookupKey: `${userId}:${deviceId}`,
  };
}

function getClientId(req) {
  return String(
    req.headers["cf-connecting-ip"] ||
      req.headers["x-forwarded-for"] ||
      req.socket.remoteAddress ||
      "unknown"
  )
    .split(",")[0]
    .trim();
}

function isRateLimited(req) {
  const now = Date.now();
  const id = getClientId(req);
  const bucket = rateBuckets.get(id) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }

  bucket.count += 1;
  rateBuckets.set(id, bucket);

  return bucket.count > RATE_LIMIT_MAX;
}

function signKeyRecord(key, createdAt, expiresAt) {
  return crypto
    .createHmac("sha256", KEY_SIGNING_SECRET)
    .update(`${key}.${createdAt}.${expiresAt}`)
    .digest("hex");
}

function isValidKeyRecord(key, data) {
  if (!data || !data.createdAt || !data.expiresAt || !data.signature) {
    return false;
  }

  const expected = signKeyRecord(key, data.createdAt, data.expiresAt);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(String(data.signature), "hex");

  return (
    expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

function getReferer(req) {
  return String(req.headers.referer || req.headers.referrer || "").toLowerCase();
}

function isBypassReferer(req) {
  const referer = getReferer(req);
  return [
    "bypass.vip",
    "bypass.city",
    "bypass.pm",
    "bypassi.com",
    "thebypasser.com",
    "bypassbot",
    "linkvertisebypass",
  ].some((name) => referer.includes(name));
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
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
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
      --bg: #080a0f;
      --panel: rgba(18, 22, 31, 0.92);
      --panel-2: #0d111a;
      --line: rgba(160, 174, 205, 0.18);
      --line-strong: rgba(126, 148, 255, 0.55);
      --text: #f7f9ff;
      --muted: #aab3c8;
      --blue: #6f83ff;
      --cyan: #38d6ff;
      --green: #28d27f;
      --green-hover: #35e391;
      --red: #ff5d73;
      --gold: #ffd36a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        linear-gradient(135deg, rgba(111, 131, 255, 0.16), transparent 34%),
        linear-gradient(315deg, rgba(40, 210, 127, 0.12), transparent 32%),
        repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 72px),
        repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 72px),
        var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
    }
    main {
      position: relative;
      width: min(840px, 100%);
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 18px;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.48), inset 0 1px 0 rgba(255,255,255,0.05);
      overflow: hidden;
      padding: 0;
      backdrop-filter: blur(18px);
    }
    main::before {
      content: "";
      display: block;
      height: 4px;
      background: linear-gradient(90deg, var(--blue), var(--cyan), var(--green), var(--gold));
    }
    .hero, .key-view {
      padding: clamp(24px, 5vw, 44px);
    }
    .topline {
      align-items: center;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 28px;
    }
    .brand {
      align-items: center;
      display: flex;
      gap: 12px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .mark {
      align-items: center;
      background: linear-gradient(135deg, var(--blue), var(--green));
      border-radius: 12px;
      box-shadow: 0 12px 30px rgba(111, 131, 255, 0.25);
      display: inline-flex;
      height: 40px;
      justify-content: center;
      width: 40px;
    }
    .badge {
      border: 1px solid rgba(111, 131, 255, 0.35);
      border-radius: 999px;
      color: #dce3ff;
      display: inline-flex;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.04em;
      padding: 8px 11px;
      text-transform: uppercase;
    }
    .badge.good { border-color: rgba(40, 210, 127, 0.45); color: #9dffc9; }
    .badge.bad { border-color: rgba(255, 93, 115, 0.45); color: #ffb7c1; }
    h1 {
      margin: 0 0 12px;
      font-size: clamp(34px, 7vw, 64px);
      line-height: 0.95;
      letter-spacing: 0;
    }
    p {
      color: var(--muted);
      font-size: 16px;
      line-height: 1.6;
      margin: 0 0 16px;
      max-width: 650px;
    }
    .actions {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 26px;
    }
    a, button {
      appearance: none;
      border: 0;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--green), #18a96b);
      color: white;
      cursor: pointer;
      display: inline-block;
      font-weight: 700;
      margin-top: 0;
      padding: 13px 18px;
      text-decoration: none;
      transition: transform 0.16s ease, filter 0.16s ease, border-color 0.16s ease;
    }
    a:hover, button:hover { filter: brightness(1.08); transform: translateY(-1px); }
    .primary {
      background: linear-gradient(135deg, var(--blue), #4858ff);
      box-shadow: 0 12px 28px rgba(111, 131, 255, 0.22);
    }
    .secondary {
      background: rgba(255,255,255,0.06);
      border: 1px solid var(--line);
    }
    button:disabled { cursor: not-allowed; opacity: 0.6; }
    code {
      display: block;
      overflow-wrap: anywhere;
      background: var(--panel-2);
      border: 1px solid var(--line-strong);
      border-radius: 12px;
      color: white;
      font-size: clamp(15px, 3vw, 20px);
      font-weight: 800;
      letter-spacing: 0.08em;
      line-height: 1.45;
      margin: 16px 0 14px;
      padding: 18px;
      text-align: center;
    }
    .error { color: var(--red); }
    .status {
      align-items: center;
      display: flex;
      gap: 10px;
      margin-bottom: 18px;
    }
    .check {
      align-items: center;
      background: linear-gradient(135deg, var(--green), #1fadbe);
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
      background: rgba(255, 211, 106, 0.1);
      border: 1px solid rgba(255, 211, 106, 0.35);
      border-radius: 12px;
      color: var(--gold);
      font-size: 24px;
      font-weight: 800;
      margin: 14px 0;
      padding: 14px 16px;
      text-align: center;
    }
    .grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      margin-top: 28px;
    }
    .tile {
      background: rgba(255,255,255,0.045);
      border: 1px solid var(--line);
      border-radius: 14px;
      min-height: 86px;
      padding: 14px;
    }
    .tile strong {
      display: block;
      font-size: 13px;
      margin-bottom: 6px;
    }
    .tile span {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
    }
    .hidden { display: none; }
    .tiny { font-size: 13px; margin-top: 14px; }
    @media (max-width: 640px) {
      body { padding: 14px; }
      .topline { align-items: flex-start; flex-direction: column; }
      .grid { grid-template-columns: 1fr; }
      a, button { width: 100%; text-align: center; }
    }
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`);
}

function json(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
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

function sessionCookie(session, name = "key_session") {
  return `${name}=${encodeURIComponent(session)}; HttpOnly; Secure; SameSite=None; Max-Age=${Math.floor(PENDING_LIFETIME_MS / 1000)}; Path=/`;
}

function sessionCookieSet(session) {
  return [
    sessionCookie(session, "key_session"),
    sessionCookie(session, "checkpoint_session"),
    sessionCookie(session, "final_session"),
  ];
}

function clearSessionCookie() {
  return [
    "key_session=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/",
    "checkpoint_session=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/",
    "final_session=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/",
  ];
}

function getAnySession(req) {
  return (
    getCookie(req, "key_session") ||
    getCookie(req, "checkpoint_session") ||
    getCookie(req, "final_session")
  );
}

function flowKey(req) {
  return crypto
    .createHash("sha256")
    .update(getClientId(req))
    .digest("hex");
}

function saveFlow(keys, req, session, step, createdAt = Date.now()) {
  keys.__flows = keys.__flows || {};
  keys.__flows[flowKey(req)] = {
    session,
    step,
    createdAt,
    expiresAt: Date.now() + PENDING_LIFETIME_MS,
  };
}

function getPendingFlow(keys, req, session) {
  const pending = session && keys.__pending[session];
  if (pending) {
    return { session, pending };
  }

  const flow = keys.__flows && keys.__flows[flowKey(req)];
  if (flow && flow.session && keys.__pending[flow.session]) {
    return { session: flow.session, pending: keys.__pending[flow.session], flow };
  }

  if (flow && flow.step) {
    return {
      session: flow.session || makeSession(),
      pending: {
        createdAt: flow.createdAt,
        step: flow.step,
        expiresAt: flow.expiresAt,
      },
      flow,
    };
  }

  return { session, pending: null };
}

function createKeyPage(res, keys, session, req) {
  delete keys.__pending[session];
  if (req && keys.__flows) {
    delete keys.__flows[flowKey(req)];
  }

  const key = makeKey();
  const createdAt = Date.now();
  const expiresAt = Date.now() + KEY_LIFETIME_MS;
  keys[key] = {
    createdAt,
    expiresAt,
    signature: signKeyRecord(key, createdAt, expiresAt),
  };
  saveKeys(keys);

  return page(
    res,
    "Your Key",
    `<section class="key-view">
      <div class="topline">
        <div class="brand"><span class="mark">N</span> Nin's Hub</div>
        <span class="badge good">Verified</span>
      </div>
      <div class="status">
        <span class="check">&#10003;</span>
        <h1>Key Generated</h1>
      </div>
      <p>Your key is ready. Copy it and paste it into the Roblox loader.</p>
      <code id="key">${escapeHtml(key)}</code>
      <div class="actions">
        <button class="primary" onclick="navigator.clipboard.writeText(document.getElementById('key').textContent)">Copy Key</button>
      </div>
      <div class="timer" id="timer">24:00:00</div>
      <p>Expires: ${escapeHtml(new Date(expiresAt).toLocaleString())}</p>
    </section>
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

  if (isRateLimited(req)) {
    return json(res, { valid: false, reason: "rate-limited" }, 429);
  }

  if (url.pathname === "/" || url.pathname === "/generate-key") {
    const session = getAnySession(req);
    const pending = session && keys.__pending[session];

    if (pending) {
      saveKeys(keys);
      return page(
        res,
        "Finish Linkvertise",
        `<section class="hero">
          <div class="topline">
            <div class="brand"><span class="mark">N</span> Nin's Hub</div>
            <span class="badge bad">Not Verified</span>
          </div>
          <h1>Finish Checkpoint 1</h1>
          <p>You came back to the key page, so no key was generated. Finish the first Linkvertise until it sends you to the checkpoint page automatically.</p>
          <div class="actions">
            <a class="primary" href="/go">Open Checkpoint 1 Again</a>
          </div>
        </section>`
      );
    }

    saveKeys(keys);
    return page(
      res,
      "Get Your Key",
      `<section class="hero">
        <div class="topline">
          <div class="brand"><span class="mark">N</span> Nin's Hub</div>
          <span class="badge">24 Hour Access</span>
        </div>
        <h1>Get Your Key</h1>
        <p>Open checkpoint 1 from this page. After that, checkpoint 2 must be completed before the 24 hour key is generated.</p>
        <div class="actions">
          <a class="primary" href="/go">Open Checkpoint 1</a>
        </div>
        <div class="grid">
          <div class="tile"><strong>Session Locked</strong><span>The return must match this browser session.</span></div>
          <div class="tile"><strong>2 Checkpoints</strong><span>Both Linkvertise steps must be completed.</span></div>
          <div class="tile"><strong>24 Hour Key</strong><span>Keys expire automatically after one day.</span></div>
        </div>
        <p class="tiny">Backing out of Linkvertise will not generate a key.</p>
      </section>`
    );
  }

  if (url.pathname === "/go") {
    const session = makeSession();
    keys.__pending[session] = {
      createdAt: Date.now(),
      step: 1,
      expiresAt: Date.now() + PENDING_LIFETIME_MS,
    };
    saveFlow(keys, req, session, 1, keys.__pending[session].createdAt);
    saveKeys(keys);

    return redirect(res, LINKVERTISE_URL, {
      "Set-Cookie": sessionCookieSet(session),
    });
  }

  if (url.pathname === "/checkpoint") {
    const pass = String(url.searchParams.get("pass") || "");
    const session = getAnySession(req);
    const flowState = getPendingFlow(keys, req, session);
    const pending = flowState.pending;
    const realSession = flowState.session;

    if (isBypassReferer(req)) {
      saveKeys(keys);
      return page(
        res,
        "Bypass Blocked",
        `<section class="hero">
          <div class="topline">
            <div class="brand"><span class="mark">N</span> Nin's Hub</div>
            <span class="badge bad">Bypass Blocked</span>
          </div>
          <h1>Open Linkvertise normally</h1>
          <p>This return came from a known bypass service. Start from the key page and complete Linkvertise normally.</p>
          <div class="actions">
            <a class="primary" href="/generate-key">Start Again</a>
          </div>
        </section>`
      );
    }

    if (pass !== UNLOCK_PASS) {
      saveKeys(keys);
      return page(
        res,
        "Checkpoint Locked",
        `<section class="hero">
          <div class="topline">
            <div class="brand"><span class="mark">N</span> Nin's Hub</div>
            <span class="badge bad">Checkpoint Locked</span>
          </div>
          <h1>Start from the key page</h1>
          <p>Checkpoint 1 must be opened from this website before checkpoint 2 is available.</p>
          <div class="actions">
            <a class="primary" href="/generate-key">Start Again</a>
          </div>
        </section>`
      );
    }

    if (!pending) {
      saveKeys(keys);
      return page(
        res,
        "Checkpoint Locked",
        `<section class="hero">
          <div class="topline">
            <div class="brand"><span class="mark">N</span> Nin's Hub</div>
            <span class="badge bad">Checkpoint Locked</span>
          </div>
          <h1>Start from the key page</h1>
          <p>Checkpoint 1 must be opened from this website before checkpoint 2 is available.</p>
          <div class="actions">
            <a class="primary" href="/generate-key">Start Again</a>
          </div>
        </section>`
      );
    }

    if (Date.now() - pending.createdAt < MIN_LINKVERTISE_TIME_MS) {
      saveKeys(keys);
      return page(
        res,
        "Checkpoint Locked",
        `<section class="hero">
          <div class="topline">
            <div class="brand"><span class="mark">N</span> Nin's Hub</div>
            <span class="badge bad">Too Fast</span>
          </div>
          <h1>Checkpoint 1 was not completed</h1>
          <p>The return happened too quickly. Go through checkpoint 1 normally and let it redirect you here.</p>
          <div class="actions">
            <a class="primary" href="/go">Open Checkpoint 1 Again</a>
          </div>
        </section>`
      );
    }

    pending.step = 2;
    pending.checkpointAt = Date.now();
    pending.createdAt = Date.now();
    pending.expiresAt = Date.now() + PENDING_LIFETIME_MS;
    keys.__pending[realSession] = pending;
    saveFlow(keys, req, realSession, 2, pending.createdAt);
    saveKeys(keys);

    return page(
      res,
      "Checkpoint 1 Complete",
      `<section class="hero">
        <div class="topline">
          <div class="brand"><span class="mark">N</span> Nin's Hub</div>
          <span class="badge good">Checkpoint 1 Complete</span>
        </div>
        <h1>One more step</h1>
        <p>Checkpoint 1 is verified. Open checkpoint 2 and let it redirect you back here to generate your 24 hour key.</p>
        <div class="actions">
          <a class="primary" href="/go2">Open Checkpoint 2</a>
        </div>
      </section>`
      ,
      {
        "Set-Cookie": sessionCookieSet(realSession),
      }
    );
  }

  if (url.pathname === "/go2") {
    const session = getAnySession(req);
    const flowState = getPendingFlow(keys, req, session);
    const pending = flowState.pending;
    const realSession = flowState.session;

    if (!pending || pending.step !== 2) {
      saveKeys(keys);
      return page(
        res,
        "Checkpoint Locked",
        `<section class="hero">
          <div class="topline">
            <div class="brand"><span class="mark">N</span> Nin's Hub</div>
            <span class="badge bad">Checkpoint 1 Needed</span>
          </div>
          <h1>Finish checkpoint 1 first</h1>
          <p>Checkpoint 2 only opens after checkpoint 1 is verified in the same browser.</p>
          <div class="actions">
            <a class="primary" href="/generate-key">Start Again</a>
          </div>
        </section>`
      );
    }

    pending.createdAt = Date.now();
    pending.expiresAt = Date.now() + PENDING_LIFETIME_MS;
    keys.__pending[realSession] = pending;
    saveFlow(keys, req, realSession, 2, pending.createdAt);
    saveKeys(keys);

    return redirect(res, LINKVERTISE_URL_2, {
      "Set-Cookie": sessionCookieSet(realSession),
    });
  }

  if (url.pathname === "/final-checkpoint" || url.pathname === "/return" || url.pathname === "/unlock") {
    const pass = String(url.searchParams.get("pass") || "");
    const session = getAnySession(req);
    const flowState = getPendingFlow(keys, req, session);
    const pending = flowState.pending;
    const realSession = flowState.session;

    if (isBypassReferer(req)) {
      saveKeys(keys);
      return page(
        res,
        "Bypass Blocked",
        `<section class="hero">
          <div class="topline">
            <div class="brand"><span class="mark">N</span> Nin's Hub</div>
            <span class="badge bad">Bypass Blocked</span>
          </div>
          <h1>Open Linkvertise normally</h1>
          <p>This return came from a known bypass service. Start from the key page and complete both checkpoints normally.</p>
          <div class="actions">
            <a class="primary" href="/generate-key">Start Again</a>
          </div>
        </section>`
      );
    }

    if (pass !== UNLOCK_PASS) {
      saveKeys(keys);
      return page(
        res,
        "Locked",
        `<section class="hero">
          <div class="topline">
            <div class="brand"><span class="mark">N</span> Nin's Hub</div>
            <span class="badge bad">Locked</span>
          </div>
          <h1>Wrong Return</h1>
          <p>The return pass is wrong. Set the second Linkvertise destination to the exact /final-checkpoint link from the README.</p>
          <div class="actions">
            <a class="primary" href="/generate-key">Go Through Linkvertise</a>
          </div>
        </section>`
      );
    }

    if (!pending || pending.step !== 2) {
      saveKeys(keys);
      return page(
        res,
        "Locked",
        `<section class="hero">
          <div class="topline">
            <div class="brand"><span class="mark">N</span> Nin's Hub</div>
            <span class="badge bad">Session Missing</span>
          </div>
          <h1>Finish both checkpoints first</h1>
          <p>This return page only works after checkpoint 1 and checkpoint 2 are completed from this website.</p>
          <div class="actions">
            <a class="primary" href="/generate-key">Start Again</a>
          </div>
        </section>`
      );
    }

    if (Date.now() - pending.createdAt < MIN_LINKVERTISE_TIME_MS) {
      saveKeys(keys);
      return page(
        res,
        "Locked",
        `<section class="hero">
          <div class="topline">
            <div class="brand"><span class="mark">N</span> Nin's Hub</div>
            <span class="badge bad">Too Fast</span>
          </div>
          <h1>Checkpoint 2 was not completed</h1>
          <p>The return happened too quickly. Go through checkpoint 2 normally and let it redirect you back.</p>
          <div class="actions">
            <a class="primary" href="/go2">Open Checkpoint 2 Again</a>
          </div>
        </section>`
      );
    }

    return createKeyPage(res, keys, realSession, req);
  }

  if (url.pathname === "/claim") {
    saveKeys(keys);
    return page(
      res,
      "Locked",
      `<section class="hero">
        <div class="topline">
          <div class="brand"><span class="mark">N</span> Nin's Hub</div>
          <span class="badge bad">Shortcut Blocked</span>
        </div>
        <h1>Locked</h1>
        <p>This shortcut is disabled. Finish Linkvertise until it opens the verified return page.</p>
        <div class="actions">
          <a class="primary" href="/generate-key">Go Through Linkvertise</a>
        </div>
      </section>`
    );
  }

  if (url.pathname === "/check-key") {
    const key = String(url.searchParams.get("key") || "").trim().toUpperCase();
    const device = getDeviceLookup(url);

    if (!key) {
      saveKeys(keys);
      return json(res, { valid: false, reason: "missing" });
    }

    const data = keys[key];
    if (!data || key === "__pending" || key === "__devices" || !isValidKeyRecord(key, data)) {
      saveKeys(keys);
      return json(res, { valid: false, reason: "invalid" });
    }

    if (data.expiresAt <= Date.now()) {
      delete keys[key];
      saveKeys(keys);
      return json(res, { valid: false, reason: "expired" });
    }

    if (device) {
      keys.__devices[device.lookupKey] = {
        key,
        userId: device.userId,
        deviceId: device.deviceId,
        createdAt: Date.now(),
        expiresAt: data.expiresAt,
      };
    }

    saveKeys(keys);
    return json(res, {
      valid: true,
      expiresAt: data.expiresAt,
      timeLeftMs: data.expiresAt - Date.now(),
    });
  }

  if (url.pathname === "/check-device") {
    const device = getDeviceLookup(url);

    if (!device) {
      saveKeys(keys);
      return json(res, { valid: false, reason: "missing-device" });
    }

    const claim = keys.__devices[device.lookupKey];
    if (!claim || !claim.key) {
      saveKeys(keys);
      return json(res, { valid: false, reason: "unknown-device" });
    }

    const data = keys[claim.key];
    if (!data || !isValidKeyRecord(claim.key, data) || data.expiresAt <= Date.now()) {
      delete keys.__devices[device.lookupKey];
      if (claim.key && keys[claim.key] && keys[claim.key].expiresAt <= Date.now()) {
        delete keys[claim.key];
      }
      saveKeys(keys);
      return json(res, { valid: false, reason: "expired" });
    }

    claim.expiresAt = data.expiresAt;
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
