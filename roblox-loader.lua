local HttpService = game:GetService("HttpService")

local KEY_SITE = "https://roblox-key-system-hr3h.onrender.com"
local KEY_LINK_URL = KEY_SITE .. "/generate-key"
local KEY_CHECK_URL = KEY_SITE .. "/check-key?key="

getgenv().ScriptKey = getgenv().ScriptKey or "PUT_KEY_HERE"

local function copyText(text)
    if typeof(setclipboard) == "function" then
        setclipboard(text)
    elseif typeof(toclipboard) == "function" then
        toclipboard(text)
    end
end

local function stopWithKeyMessage(message)
    warn(message)
    warn("Get a 24 hour key here: " .. KEY_LINK_URL)
    copyText(KEY_LINK_URL)
end

local function checkKey()
    local key = tostring(getgenv().ScriptKey or ""):gsub("^%s+", ""):gsub("%s+$", "")

    if key == "" or key == "PUT_KEY_HERE" then
        stopWithKeyMessage("No key entered.")
        return false
    end

    local ok, result = pcall(function()
        local raw = game:HttpGet(KEY_CHECK_URL .. HttpService:UrlEncode(key))
        return HttpService:JSONDecode(raw)
    end)

    if not ok or typeof(result) ~= "table" then
        stopWithKeyMessage("Could not check key. Make sure the key website is online.")
        return false
    end

    if result.valid ~= true then
        stopWithKeyMessage("Bad or expired key: " .. tostring(result.reason or "unknown"))
        return false
    end

    print("Key accepted.")
    return true
end

if not checkKey() then
    return
end

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local state = ReplicatedStorage:FindFirstChild("State")
local map = state and state:FindFirstChild("Map")

if map then
    print("Map detected:", map.Value)

    map:GetPropertyChangedSignal("Value"):Connect(function()
        print("Map changed to:", map.Value)
    end)

    -- Load your in-map script
    loadstring(game:HttpGet("https://pastebin.com/raw/HMr358mm"))()
else
    print("No map detected, loading elevator scanner...")

    -- Load your elevator scanner
    loadstring(game:HttpGet("https://pastebin.com/raw/Cipvhh7A"))()
end
