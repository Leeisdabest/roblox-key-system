Roblox Key Website
==================

This is the whole website for the key system.

What it does
============

1. The user opens:

       https://YOUR-SITE.onrender.com/generate-key

2. The website sends them to your Linkvertise link.

3. Linkvertise sends them back to:

       https://YOUR-SITE.onrender.com/unlock?pass=YOUR_SECRET_PASS

4. The website gives them a random 24 hour key.

5. The Roblox loader checks the key with:

       https://YOUR-SITE.onrender.com/check-key?key=THE_KEY

Files to upload to GitHub
=========================

Upload all of these:

    server.js
    package.json
    render.yaml
    roblox-loader.lua
    README.txt

Render setup
============

After the files are on GitHub, redeploy the Render website.

In Render, open your web service, then go to Environment.

Add these:

    LINKVERTISE_URL
        Put your Linkvertise link here.

    UNLOCK_PASS
        Make up a secret password.
        Example:
        my-secret-pass-9284

Linkvertise setup
=================

In Linkvertise, set the final destination/target URL to:

    https://YOUR-SITE.onrender.com/unlock?pass=YOUR_SECRET_PASS

Example:

    https://roblox-key-system.onrender.com/unlock?pass=my-secret-pass-9284

Roblox loader setup
===================

In roblox-loader.lua, change:

    local KEY_SITE = "https://YOUR-DOMAIN-HERE"

to your Render website:

    local KEY_SITE = "https://YOUR-SITE.onrender.com"

Then use a key like this:

    getgenv().ScriptKey = "PASTE_KEY_HERE"
    loadstring(game:HttpGet("YOUR_RAW_LOADER_LINK_HERE"))()

Important
=========

Do not put your UNLOCK_PASS inside the Roblox loader.
Do not put private API keys inside the Roblox loader.
Anything inside the Roblox loader can be seen by other people.
