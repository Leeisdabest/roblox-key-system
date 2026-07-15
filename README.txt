Where the JSON code goes
========================

You do not paste the JSON into Roblox.

The JSON is sent by the website/server when the Roblox loader checks a key:

    /check-key?key=THE_KEY_HERE

Example valid response:

    {"valid":true,"expiresAt":1784140000000,"timeLeftMs":86400000}

Example bad response:

    {"valid":false,"reason":"expired"}

Files
=====

server.js
    This is the website/server. It creates keys and checks keys.

roblox-loader.lua
    This is the Roblox loader. Put your public website URL in KEY_SITE, then put your key in getgenv().ScriptKey.

How to test on your PC
======================

1. Open a terminal in this folder.
2. Run:

       node server.js

3. Open this in your browser:

       http://localhost:3000/generate-key

Important
=========

Roblox cannot normally reach localhost from your PC. For the Roblox script to use it, host server.js on a public site like Render, Railway, Replit, or your own VPS.

After hosting it, replace this in roblox-loader.lua:

    https://YOUR-DOMAIN-HERE

with your real public website URL.

Do not put secret API keys inside the Roblox loader. Anything inside the Roblox loader can be seen by other people.
