Roblox Key Website
==================

Your website:

    https://roblox-key-system-hr3h.onrender.com

Key page:

    https://roblox-key-system-hr3h.onrender.com/generate-key

How it works
============

1. Person opens /generate-key.
2. Website shows a button that says Click Here To Open Linkvertise.
3. Person finishes Linkvertise.
4. Linkvertise sends them back to /unlock.
5. Website shows a check mark, a 24 hour key, and a countdown timer.
6. Roblox checks the key with /check-key.

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

Roblox loader setup
===================

roblox-loader.lua is already set to:

    https://roblox-key-system-hr3h.onrender.com

Use it like this:

    getgenv().ScriptKey = "PASTE_KEY_HERE"
    loadstring(game:HttpGet("YOUR_RAW_LOADER_LINK_HERE"))()

Important
=========

Do not put UNLOCK_PASS inside the Roblox loader.
Do not put private API keys inside the Roblox loader.
Anything in the Roblox loader can be seen by other people.
