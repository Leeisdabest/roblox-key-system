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
3. Clicking that opens Linkvertise in the same tab and creates a hidden browser session.
4. If Linkvertise returns to /return, the key is generated.
5. If someone backs out to /generate-key, no key is generated.
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

    https://direct-link.net/7498733/H8FEbAxxI1Ag

Add:

    UNLOCK_PASS

Value:

    3b913615466d0554a0ac12eb50fde9be4d35685300eef38ecf993a6ce7e45f12

Then redeploy.

Linkvertise setup
=================

In Linkvertise, set the final destination/target URL to:

    https://roblox-key-system-hr3h.onrender.com/return?pass=3b913615466d0554a0ac12eb50fde9be4d35685300eef38ecf993a6ce7e45f12

If Linkvertise sends you back to /generate-key, the Linkvertise destination is wrong.
Edit the Linkvertise link and set the destination to /return, or make a new Linkvertise link with the /return URL above.

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
Backing out of Linkvertise to the key page will not generate a key.

The strongest protection is Linkvertise server-side API verification. This setup is made to be reliable while still blocking the easy shortcut URL problem.
