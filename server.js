const http = require("http");
const https = require("https");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const KEY_LIFETIME_MS = 24 * 60 * 60 * 1000;
const PENDING_LIFETIME_MS = 30 * 60 * 1000;
const MIN_LINKVERTISE_TIME_MS = 3 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 90;
const STORE_PATH = path.join(__dirname, "keys.json");

const LINKVERTISE_URL = "https://work.ink/20lq/nins-hub";
const LINKVERTISE_URL_2 = "https://work.ink/20lq/nins-hub-last-checkpoint";
const UNLOCK_PASS = "3b913615466d0554a0ac12eb50fde9be4d35685300eef38ecf993a6ce7e45f12";
const PUBLIC_SITE = "https://roblox-key-system-hr3h.onrender.com";
const KEY_SIGNING_SECRET = "nins-hub-key-signing-secret-2026-change-this-later";
const SKIP_ANTIBYPASS_CHECKS = true;
const REQUIRE_GATE_POSTBACK = false;
const USE_LOOTLABS_POSTBACK = false;
const LOOTLABS_POSTBACK_TOKEN = "";
const ANTIBYPASS_API_KEY = "1409cc373e11bc24318e4b6703222a538a82d0202b986b30ad6959ca950db622";
const LINKVERTISE_ANTI_BYPASS_TOKEN = "1409cc373e11bc24318e4b6703222a538a82d0202b986b30ad6959ca950db622";
const REQUIRE_ANTIBYPASS_TOKEN = true;
const STRICT_ANTIBYPASS_TOKEN = true;
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

function getAntiBypassToken(url) {
  return (
    url.searchParams.get("RS_EvaluationDT") ||
    url.searchParams.get("hash") ||
    url.searchParams.get("bypassId") ||
    url.searchParams.get("token") ||
    url.searchParams.get("lv_token") ||
    url.searchParams.get("linkvertise_token") ||
    url.searchParams.get("anti_bypass") ||
    url.searchParams.get("antiBypass") ||
    url.searchParams.get("ab") ||
    url.searchParams.get("lvt") ||
    ""
  ).trim();
}

function listQueryParams(url) {
  const names = [];
  for (const key of url.searchParams.keys()) {
    if (!names.includes(key)) names.push(key);
  }
  return names.length ? names.join(", ") : "none";
}

function getJson(url, headers = {}) {
  return new Promise((resolve) => {
    const request = https.get(url, { headers, timeout: 8000 }, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });
    });

    request.on("timeout", () => {
      request.destroy();
      resolve(null);
    });
    request.on("error", () => resolve(null));
  });
}

function withPuid(targetUrl, puid) {
  const separator = targetUrl.includes("?") ? "&" : "?";
  return `${targetUrl}${separator}puid=${encodeURIComponent(puid)}`;
}

async function verifyAntiBypass(url, req) {
  if (!REQUIRE_ANTIBYPASS_TOKEN) {
    return { ok: true };
  }

  const token = getAntiBypassToken(url);
  if (!token) {
    if (!STRICT_ANTIBYPASS_TOKEN) {
      return {
        ok: true,
        mode: "debug-missing-token",
        params: listQueryParams(url),
        referer: getReferer(req) || "none",
      };
    }

    return {
      ok: false,
      reason: "missing-token",
      params: listQueryParams(url),
      referer: getReferer(req) || "none",
    };
  }

  if (!url.searchParams.get("RS_EvaluationDT") && url.searchParams.get("hash")) {
    return { ok: true, mode: "linkvertise-hash-session-checked" };
  }

  if (!ANTIBYPASS_API_KEY) {
    return { ok: false, reason: "missing-api-key" };
  }

  const reportUrl = `https://kys.linkvertise.lol/api/v2/ManualReport?tk=${encodeURIComponent(token)}`;
  const report = await getJson(reportUrl, {
    "c-api-key": ANTIBYPASS_API_KEY,
  });

  if (!report || report.success !== true) {
    return { ok: false, reason: "invalid-token" };
  }

  const detections = report.FinalReport && typeof report.FinalReport === "object"
    ? Object.keys(report.FinalReport).filter((key) => report.FinalReport[key])
    : [];

  if (detections.length > 0) {
    return { ok: false, reason: "bypass-detected", detections };
  }

  return { ok: true, report };
}

function antiBypassBlockedPage(res, result) {
  return page(
    res,
    "Bypass Blocked",
    `<section class="hero">
      <div class="topline">
        <div class="brand"><span class="mark">N</span> Nin's Hub</div>
        <span class="badge bad">Bypass Blocked</span>
      </div>
      <h1>Verification failed</h1>
      <p>The anti-bypass verification was missing, expired, or flagged. Open Linkvertise normally from the key page.</p>
      <p class="tiny">Reason: ${escapeHtml(result.reason || "blocked")}</p>
      <p class="tiny">Received params: ${escapeHtml(result.params || "unknown")}</p>
      <p class="tiny">Referer: ${escapeHtml(result.referer || "unknown")}</p>
      <div class="actions">
        <a class="primary" href="/generate-key">Start Again</a>
      </div>
    </section>`
  );
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
      --bg: #05070d;
      --panel: rgba(13, 17, 28, 0.88);
      --panel-2: rgba(5, 8, 16, 0.86);
      --line: rgba(170, 192, 255, 0.20);
      --line-strong: rgba(76, 217, 255, 0.62);
      --text: #f7f9ff;
      --muted: #b7c1d8;
      --blue: #6675ff;
      --cyan: #22d3ee;
      --green: #28d27f;
      --green-hover: #35e391;
      --red: #ff5d73;
      --gold: #ffd36a;
      --pink: #ff4fd8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at 18% 12%, rgba(102, 117, 255, 0.30), transparent 31%),
        radial-gradient(circle at 82% 76%, rgba(40, 210, 127, 0.19), transparent 28%),
        radial-gradient(circle at 68% 16%, rgba(255, 79, 216, 0.16), transparent 24%),
        linear-gradient(135deg, rgba(255,255,255,0.035), transparent 30%),
        repeating-linear-gradient(90deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 82px),
        repeating-linear-gradient(0deg, rgba(255,255,255,0.032) 0 1px, transparent 1px 82px),
        var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
    }
    main {
      position: relative;
      width: min(900px, 100%);
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 24px;
      box-shadow:
        0 30px 90px rgba(0, 0, 0, 0.62),
        0 0 80px rgba(34, 211, 238, 0.12),
        inset 0 1px 0 rgba(255,255,255,0.08);
      overflow: hidden;
      padding: 0;
      backdrop-filter: blur(18px);
    }
    main::before {
      content: "";
      display: block;
      height: 5px;
      background: linear-gradient(90deg, var(--blue), var(--cyan), var(--green), var(--gold), var(--pink));
    }
    .hero, .key-view {
      padding: clamp(28px, 5vw, 54px);
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
      border-radius: 14px;
      box-shadow: 0 16px 36px rgba(34, 211, 238, 0.22), inset 0 1px 0 rgba(255,255,255,0.28);
      display: inline-flex;
      height: 40px;
      justify-content: center;
      width: 40px;
    }
    .badge {
      background: rgba(255,255,255,0.055);
      border: 1px solid rgba(111, 131, 255, 0.42);
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
      background: linear-gradient(90deg, #ffffff, #d9f7ff 42%, #9dffc9);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      text-shadow: 0 18px 55px rgba(34, 211, 238, 0.18);
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
      border-radius: 12px;
      background: linear-gradient(135deg, var(--green), #18a96b);
      color: white;
      cursor: pointer;
      display: inline-block;
      font-weight: 700;
      margin-top: 0;
      padding: 14px 20px;
      text-decoration: none;
      transition: transform 0.16s ease, filter 0.16s ease, border-color 0.16s ease;
    }
    a:hover, button:hover { filter: brightness(1.08); transform: translateY(-1px); }
    .primary {
      background: linear-gradient(135deg, var(--blue), var(--cyan));
      box-shadow: 0 16px 34px rgba(34, 211, 238, 0.24);
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
      border-radius: 16px;
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
      border-radius: 16px;
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
      border-radius: 16px;
      min-height: 86px;
      padding: 14px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
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

function text(res, message, statusCode = 200) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(message);
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
    .update([
      getClientId(req),
      String(req.headers["user-agent"] || ""),
      String(req.headers["accept-language"] || ""),
    ].join("|"))
    .digest("hex");
}

function clientLock(req) {
  return crypto
    .createHash("sha256")
    .update([
      getClientId(req),
      String(req.headers["user-agent"] || ""),
      String(req.headers["accept-language"] || ""),
    ].join("|"))
    .digest("hex");
}

function saveFlow(keys, req, session, step, createdAt = Date.now()) {
  keys.__flows = keys.__flows || {};
  keys.__flows[flowKey(req)] = {
    session,
    step,
    createdAt,
    clientLock: clientLock(req),
    expiresAt: Date.now() + PENDING_LIFETIME_MS,
  };
}

function getPendingFlow(keys, req, session) {
  const pending = session && keys.__pending[session];
  if (pending && pending.clientLock === clientLock(req)) {
    return { session, pending };
  }

  const flow = keys.__flows && keys.__flows[flowKey(req)];
  if (
    flow &&
    flow.clientLock === clientLock(req) &&
    flow.session &&
    keys.__pending[flow.session] &&
    keys.__pending[flow.session].clientLock === clientLock(req)
  ) {
    return { session: flow.session, pending: keys.__pending[flow.session], flow };
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

function hasLootlabsCompletion(keys, session, step, req) {
  const pending = session && keys.__pending && keys.__pending[session];
  const completion = pending && pending.lootlabs && pending.lootlabs[String(step)];
  return Boolean(completion && completion.clientLock === clientLock(req));
}

function lootlabsWaitingPage(res, step, href) {
  return page(
    res,
        "Waiting For Work.ink",
    `<section class="hero">
      <div class="topline">
        <div class="brand"><span class="mark">N</span> Nin's Hub</div>
        <span class="badge bad">Waiting</span>
      </div>
      <h1>Finish Work.ink first</h1>
      <p>Finish checkpoint ${step} from the key page, then let Work.ink redirect back here.</p>
      <div class="actions">
        <a class="primary" href="${escapeHtml(href)}">Open Checkpoint ${step} Again</a>
      </div>
    </section>`
  );
}

const server = http.createServer(async (req, res) => {
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
        "Finish Work.ink",
        `<section class="hero">
          <div class="topline">
            <div class="brand"><span class="mark">N</span> Nin's Hub</div>
            <span class="badge bad">Not Verified</span>
          </div>
          <h1>Finish Checkpoint 1</h1>
          <p>You came back to the key page, so no key was generated. Finish the first Work.ink checkpoint until it sends you back automatically.</p>
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
          <div class="tile"><strong>2 Checkpoints</strong><span>Both Work.ink steps must be completed.</span></div>
          <div class="tile"><strong>24 Hour Key</strong><span>Keys expire automatically after one day.</span></div>
        </div>
        <p class="tiny">Backing out of Work.ink will not generate a key.</p>
      </section>`
    );
  }

  if (url.pathname === "/go") {
    const session = makeSession();
    keys.__pending[session] = {
      createdAt: Date.now(),
      step: 1,
      clientLock: clientLock(req),
      expiresAt: Date.now() + PENDING_LIFETIME_MS,
    };
    saveFlow(keys, req, session, 1, keys.__pending[session].createdAt);
    saveKeys(keys);

    return redirect(res, LINKVERTISE_URL, {
      "Set-Cookie": sessionCookieSet(session),
    });
  }

  if (url.pathname === "/lootlabs-postback") {
    const token = String(url.searchParams.get("token") || url.searchParams.get("secret") || url.searchParams.get("api_token") || "");
    const clickId = String(url.searchParams.get("click_id") || url.searchParams.get("puid") || "");
    const uniqueId = String(url.searchParams.get("unique_id") || url.searchParams.get("transaction_id") || makeSession());
    const stepValue = String(url.searchParams.get("step") || "");
    const pending = clickId && keys.__pending[clickId];

    if (LOOTLABS_POSTBACK_TOKEN && token !== LOOTLABS_POSTBACK_TOKEN) {
      saveKeys(keys);
      return text(res, "bad token", 403);
    }

    if (!pending) {
      saveKeys(keys);
      return text(res, "unknown click_id", 404);
    }

    const step = stepValue || (pending.step === 2 ? "2" : "1");
    pending.lootlabs = pending.lootlabs || {};
    pending.lootlabs[step] = {
      uniqueId,
      ip: String(url.searchParams.get("ip") || ""),
      completedAt: Date.now(),
      clientLock: pending.clientLock,
    };
    pending.expiresAt = Date.now() + PENDING_LIFETIME_MS;
    keys.__pending[clickId] = pending;
    saveKeys(keys);
    return text(res, "ok");
  }

  if (url.pathname === "/checkpoint" || url.pathname === "/checkpoint-one") {
    const pass = String(url.searchParams.get("pass") || "");
    const session = getAnySession(req);
    const flowState = getPendingFlow(keys, req, session);
    const pending = flowState.pending;
    const realSession = flowState.session;

    if (!SKIP_ANTIBYPASS_CHECKS && isBypassReferer(req)) {
      saveKeys(keys);
      return page(
        res,
        "Bypass Blocked",
        `<section class="hero">
          <div class="topline">
            <div class="brand"><span class="mark">N</span> Nin's Hub</div>
            <span class="badge bad">Bypass Blocked</span>
          </div>
          <h1>Open Work.ink normally</h1>
          <p>Start from the key page and complete Work.ink normally.</p>
          <div class="actions">
            <a class="primary" href="/generate-key">Start Again</a>
          </div>
        </section>`
      );
    }

    if (!SKIP_ANTIBYPASS_CHECKS && !USE_LOOTLABS_POSTBACK) {
      const antiBypass = await verifyAntiBypass(url, req);
      if (!antiBypass.ok) {
        saveKeys(keys);
        return antiBypassBlockedPage(res, antiBypass);
      }
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

    if (REQUIRE_GATE_POSTBACK && !hasLootlabsCompletion(keys, realSession, 1, req)) {
      saveKeys(keys);
      return lootlabsWaitingPage(res, 1, "/go");
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
          <p>Checkpoint 1 is verified. Open checkpoint 2 and let Work.ink redirect you back here to generate your 24 hour key.</p>
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

  if (
    url.pathname === "/final-checkpoint" ||
    url.pathname === "/checkpoint-two-finish" ||
    url.pathname === "/return" ||
    url.pathname === "/unlock"
  ) {
    const pass = String(url.searchParams.get("pass") || "");
    const session = getAnySession(req);
    const flowState = getPendingFlow(keys, req, session);
    const pending = flowState.pending;
    const realSession = flowState.session;

    if (!SKIP_ANTIBYPASS_CHECKS && isBypassReferer(req)) {
      saveKeys(keys);
      return page(
        res,
        "Bypass Blocked",
        `<section class="hero">
          <div class="topline">
            <div class="brand"><span class="mark">N</span> Nin's Hub</div>
            <span class="badge bad">Bypass Blocked</span>
          </div>
          <h1>Open Work.ink normally</h1>
          <p>Start from the key page and complete both Work.ink checkpoints normally.</p>
          <div class="actions">
            <a class="primary" href="/generate-key">Start Again</a>
          </div>
        </section>`
      );
    }

    if (!SKIP_ANTIBYPASS_CHECKS && !USE_LOOTLABS_POSTBACK) {
      const antiBypass = await verifyAntiBypass(url, req);
      if (!antiBypass.ok) {
        saveKeys(keys);
        return antiBypassBlockedPage(res, antiBypass);
      }
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
          <p>The return pass is wrong. Make sure your Work.ink destination uses the checkpoint URL exactly.</p>
          <div class="actions">
            <a class="primary" href="/generate-key">Go Through Work.ink</a>
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

    if (REQUIRE_GATE_POSTBACK && !hasLootlabsCompletion(keys, realSession, 2, req)) {
      saveKeys(keys);
      return lootlabsWaitingPage(res, 2, "/go2");
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
          <p>This shortcut is disabled. Finish Work.ink until it opens the verified return page.</p>
        <div class="actions">
          <a class="primary" href="/generate-key">Go Through Work.ink</a>
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
