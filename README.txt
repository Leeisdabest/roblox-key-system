Roblox Key Website
==================

Your website:

    https://roblox-key-system-hr3h.onrender.com

Key page:

    https://roblox-key-system-hr3h.onrender.com/generate-key

How it works
============

1. Person opens /generate-key.
2. Website shows Checkpoint 1.
3. Clicking that opens Linkvertise checkpoint 1 in the same tab and creates a hidden browser session.
4. If checkpoint 1 returns to /checkpoint-one with the correct pass, the site unlocks checkpoint 2.
5. If checkpoint 2 returns to /checkpoint-two-finish with the correct pass, the key is generated.
6. If someone backs out to /generate-key, no key is generated.
7. The key page shows a check mark, the key, a copy button, and a countdown timer.
8. Roblox checks the key with /check-key.

Upload these files to GitHub
============================

    server.js
    package.json
    render.yaml
    roblox-loader.lua
    README.txt

Render setup
============

You do not need to add Render environment variables for this version.

Just upload these files to GitHub, then redeploy this Render service:

    roblox-key-system-hr3h

The Linkvertise links, unlock pass, and strict anti-bypass mode are already inside server.js.

Your Linkvertise links must have Use anti-bypassing enabled. This makes Linkvertise append a short-lived token such as RS_EvaluationDT, hash, bypassId, or token to the destination URL. Without that token, the site blocks the checkpoint return.

Then redeploy.

Linkvertise setup
=================

For your first Linkvertise link, set the final destination/target URL to:

    https://roblox-key-system-hr3h.onrender.com/checkpoint-one?pass=3b913615466d0554a0ac12eb50fde9be4d35685300eef38ecf993a6ce7e45f12

For your second Linkvertise link, set the final destination/target URL to:

    https://roblox-key-system-hr3h.onrender.com/checkpoint-two-finish?pass=3b913615466d0554a0ac12eb50fde9be4d35685300eef38ecf993a6ce7e45f12

If Linkvertise sends you back to /generate-key, the Linkvertise destination is wrong.
Edit the Linkvertise destinations:

    First link -> /checkpoint-one
    Second link -> /checkpoint-two-finish

Roblox loader setup
===================

roblox-loader.lua is already set to:

    https://roblox-key-system-hr3h.onrender.com

Use it like this:

    getgenv().ScriptKey = "PASTE_KEY_HERE"
    loadstring(game:HttpGet("YOUR_RAW_LOADER_LINK_HERE"))()

Important
=========

The public key page does not show the secret return URL.
The return page requires the secret pass from Linkvertise.
Backing out of Linkvertise to the key page will not generate a key.
The return page now also requires the hidden browser session from /go and blocks returns that happen too fast.
Keys are signed on the server, so edited/fake key records are rejected.
The Roblox loader can remember one valid Roblox account/device until the 24 hour key expires.
If REQUIRE_ANTIBYPASS_TOKEN is true, checkpoint returns must include the short-lived anti-bypass token before the site will unlock or generate a key.
STRICT_ANTIBYPASS_TOKEN should be true when you want bypass-city style shortcuts blocked. If a real user gets blocked, Linkvertise is probably not appending the anti-bypass token to that link yet.

The strongest protection is Linkvertise server-side API verification. This setup is made to be reliable while still blocking the easy shortcut URL problem.
