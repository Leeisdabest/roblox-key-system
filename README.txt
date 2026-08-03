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
4. If checkpoint 1 returns to /checkpoint with the correct pass, the site unlocks checkpoint 2.
5. If checkpoint 2 returns to /return with the correct pass, the key is generated.
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

Open Render.
Open your service:

    roblox-key-system-hr3h

Go to Environment.

Add:

    LINKVERTISE_URL

Value:

    https://direct-link.net/7498733/H8FEbAxxI1Ag

Add:

    LINKVERTISE_URL_2

Value:

    https://link-hub.net/7498733/4KS2lmxbEPeM

Add:

    UNLOCK_PASS

Value:

    3b913615466d0554a0ac12eb50fde9be4d35685300eef38ecf993a6ce7e45f12

Add:

    KEY_SIGNING_SECRET

Value:

    make-this-a-long-random-secret-that-only-you-know

Then redeploy.

Linkvertise setup
=================

For your first Linkvertise link, set the final destination/target URL to:

    https://roblox-key-system-hr3h.onrender.com/checkpoint?pass=3b913615466d0554a0ac12eb50fde9be4d35685300eef38ecf993a6ce7e45f12

For your second Linkvertise link, set the final destination/target URL to:

    https://roblox-key-system-hr3h.onrender.com/return?pass=3b913615466d0554a0ac12eb50fde9be4d35685300eef38ecf993a6ce7e45f12

If Linkvertise sends you back to /generate-key, the Linkvertise destination is wrong.
Edit the Linkvertise destinations:

    First link -> /checkpoint
    Second link -> /return

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

The strongest protection is Linkvertise server-side API verification. This setup is made to be reliable while still blocking the easy shortcut URL problem.
