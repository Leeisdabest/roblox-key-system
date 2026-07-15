Roblox Key Website
==================

Your website:

    https://roblox-key-system-hr3h.onrender.com

Key page:

    https://roblox-key-system-hr3h.onrender.com/generate-key

How it works
============

1. Person opens /generate-key.
2. Website shows Click Here To Open Linkvertise.
3. Clicking that opens Linkvertise in a new tab and creates a hidden browser session.
4. If Linkvertise is set up correctly, it returns to /unlock and the key is generated.
5. If Linkvertise does not auto-return, the original tab shows I Finished Linkvertise after 25 seconds.
6. The key page shows a check mark, the key, a copy button, and a countdown timer.
7. Roblox checks the key with /check-key.

Upload these files to GitHub
============================

    server.js
    package.json
    render.yaml
    roblox-loader.lua
    README.txt

Render setup
============

Open Render.
Open your service:

    roblox-key-system-hr3h

Go to Environment.

Add:

    LINKVERTISE_URL

Value:

    https://link-target.net/7498733/KpuqK9Bry5Xg

Add:

    UNLOCK_PASS

Value:

    jack-key-pass-2026

Then redeploy.

Linkvertise setup
=================

In Linkvertise, set the final destination/target URL to:

    https://roblox-key-system-hr3h.onrender.com/unlock?pass=jack-key-pass-2026

If Linkvertise still does not auto-open that return link, the fallback button on the original site tab can generate the key after 25 seconds.

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
The unlock page requires a hidden browser session from /go.
The fallback claim button has a delay so direct instant bypass links do not work.

The strongest protection is Linkvertise server-side API verification. This setup is made to be reliable while still blocking the easy shortcut URL problem.
