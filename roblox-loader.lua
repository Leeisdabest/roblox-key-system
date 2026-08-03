local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")
local ReplicatedFirst = game:GetService("ReplicatedFirst")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local CHECK_URL = "https://roblox-key-system-hr3h.onrender.com/check-key?key="
local CHECK_DEVICE_URL = "https://roblox-key-system-hr3h.onrender.com/check-device?"
local KEY_PAGE = "https://roblox-key-system-hr3h.onrender.com/generate-key"
local SAVED_KEY_FILE = "NinsSavedKey.json"
local SAVE_FOLDER = "NinsHub"
local USER_KEY_FILE = SAVE_FOLDER .. "/NinsSavedKey_" .. tostring(player.UserId) .. ".json"
local DEVICE_FILE = SAVE_FOLDER .. "/NinsDevice_" .. tostring(player.UserId) .. ".txt"

local IN_MAP_SCRIPT = "https://pastebin.com/raw/HMr358mm"
local ELEVATOR_SCRIPT = "https://pastebin.com/raw/Cipvhh7A"

local getDeviceId

local function detectExecutor()
    local checks = {
        {"Synapse X", function() return syn and syn.request end},
        {"Script-Ware", function() return identifyexecutor and tostring(identifyexecutor()):lower():find("script") end},
        {"Krnl", function() return KRNL_LOADED end},
        {"Fluxus", function() return fluxus end},
        {"Delta", function() return delta end},
        {"Codex", function() return Codex or codex end},
        {"Executor", function() return identifyexecutor end}
    }

    for _, check in ipairs(checks) do
        local ok, found = pcall(check[2])
        if ok and found then
            if check[1] == "Executor" then
                local name = "Executor"
                pcall(function()
                    name = identifyexecutor()
                end)
                return tostring(name)
            end
            return check[1]
        end
    end

    return "Unknown"
end

local function getLobbyBoards()
    local intermissionLobby = workspace:FindFirstChild("IntermissionLobby")
        or (workspace:FindFirstChild("Lobby") and workspace.Lobby:FindFirstChild("IntermissionLobby"))
        or workspace:FindFirstChild("IntermissionLobby", true)

    return intermissionLobby and intermissionLobby:FindFirstChild("Boards")
end

local function loadMain()
    local boards = getLobbyBoards()

    if boards then
        print("Boards detected, loading map script.")
        loadstring(game:HttpGet(IN_MAP_SCRIPT))()
    else
        print("No boards detected, loading elevator scanner.")
        loadstring(game:HttpGet(ELEVATOR_SCRIPT))()
    end
end

local function checkKey(key)
    key = tostring(key or ""):gsub("%s+", "")
    if key == "" then return false end

    local ok, response = pcall(function()
        local url = CHECK_URL .. HttpService:UrlEncode(key)
            .. "&userId=" .. HttpService:UrlEncode(tostring(player.UserId))
            .. "&username=" .. HttpService:UrlEncode(player.Name)
            .. "&deviceId=" .. HttpService:UrlEncode(getDeviceId())

        return game:HttpGet(url)
    end)

    if not ok then
        return false, "request failed"
    end

    local valid = false
    pcall(function()
        local data = HttpService:JSONDecode(response)
        valid = data.valid == true
    end)

    return valid
end

local function canUseFiles()
    return typeof(writefile) == "function"
        and typeof(readfile) == "function"
        and typeof(isfile) == "function"
end

local function makeSaveData(key)
    return {
        key = tostring(key or ""),
        userId = player.UserId,
        username = player.Name,
        displayName = player.DisplayName,
        executor = detectExecutor(),
        deviceId = getDeviceId(),
        savedAt = os.time(),
        version = 2,
    }
end

local function ensureSaveFolder()
    pcall(function()
        if typeof(isfolder) == "function" and typeof(makefolder) == "function" and not isfolder(SAVE_FOLDER) then
            makefolder(SAVE_FOLDER)
        end
    end)
end

getDeviceId = function()
    ensureSaveFolder()

    if typeof(readfile) == "function" and typeof(isfile) == "function" and isfile(DEVICE_FILE) then
        local ok, value = pcall(function()
            return tostring(readfile(DEVICE_FILE)):gsub("%s+", "")
        end)

        if ok and value and #value >= 16 then
            return value
        end
    end

    local newId = ""
    pcall(function()
        newId = HttpService:GenerateGUID(false)
    end)

    if newId == "" then
        newId = tostring(player.UserId) .. "-" .. tostring(os.time()) .. "-" .. tostring(math.random(100000, 999999))
    end

    pcall(function()
        if typeof(writefile) == "function" then
            writefile(DEVICE_FILE, newId)
        end
    end)

    return newId
end

local function checkDevice()
    local deviceId = getDeviceId()
    if not deviceId or deviceId == "" then
        return false
    end

    local ok, response = pcall(function()
        local url = CHECK_DEVICE_URL
            .. "userId=" .. HttpService:UrlEncode(tostring(player.UserId))
            .. "&username=" .. HttpService:UrlEncode(player.Name)
            .. "&deviceId=" .. HttpService:UrlEncode(deviceId)

        return game:HttpGet(url)
    end)

    if not ok then
        return false, "request failed"
    end

    local valid = false
    pcall(function()
        local data = HttpService:JSONDecode(response)
        valid = data.valid == true
    end)

    return valid
end

local function writeSave(path, data)
    if typeof(writefile) ~= "function" then return end
    pcall(function()
        writefile(path, HttpService:JSONEncode(data))
    end)
end

local function saveKey(key)
    if typeof(writefile) ~= "function" then return end

    local data = makeSaveData(key)
    ensureSaveFolder()

    -- Save both places: old path for compatibility, per-user path for stronger remembering.
    writeSave(SAVED_KEY_FILE, data)
    writeSave(USER_KEY_FILE, data)
end

local function clearFile(path)
    pcall(function()
        if typeof(delfile) == "function" and typeof(isfile) == "function" and isfile(path) then
            delfile(path)
        elseif typeof(writefile) == "function" then
            writefile(path, "")
        end
    end)
end

local function clearSavedKey()
    clearFile(SAVED_KEY_FILE)
    clearFile(USER_KEY_FILE)
end

local function readSave(path)
    if typeof(readfile) ~= "function" or typeof(isfile) ~= "function" or not isfile(path) then
        return nil
    end

    local ok, data = pcall(function()
        return HttpService:JSONDecode(readfile(path))
    end)

    if ok and type(data) == "table" and type(data.key) == "string" then
        return data
    end
end

local function getSavedKey()
    if not canUseFiles() then
        return nil
    end

    for _, path in ipairs({ USER_KEY_FILE, SAVED_KEY_FILE }) do
        local data = readSave(path)
        if data and data.key ~= "" then
            -- Old saves may not have userId. New saves must match this Roblox account.
            if data.userId == nil or tonumber(data.userId) == player.UserId then
                return data.key, data
            end
        end
    end
end

local function runLoadingScreen()
    pcall(function()
        ReplicatedFirst:RemoveDefaultLoadingScreen()
    end)

    local guiParent = playerGui
    pcall(function()
        local coreGui = game:GetService("CoreGui")
        guiParent = coreGui
    end)

    for _, container in ipairs({ playerGui, guiParent }) do
        local oldLoading = container and container:FindFirstChild("NinsLoadingScreen")
        if oldLoading then oldLoading:Destroy() end
    end

    local hiddenGuis = {}
    local function shouldHideGui(item)
        if item.Name == "NinsLoadingScreen" then return false end
        local name = item.Name:lower()
        return name:find("load", 1, true)
            or name:find("blackout", 1, true)
            or name:find("transition", 1, true)
            or name:find("intro", 1, true)
    end

    local function hideOtherLoadingGuis()
        for _, container in ipairs({ playerGui, guiParent }) do
            if container then
                for _, item in ipairs(container:GetChildren()) do
                    if item:IsA("ScreenGui") and item.Enabled and shouldHideGui(item) then
                        hiddenGuis[item] = true
                        pcall(function()
                            item.Enabled = false
                        end)
                    end
                end
            end
        end
    end

    local loadingGui = Instance.new("ScreenGui")
    loadingGui.Name = "NinsLoadingScreen"
    loadingGui.ResetOnSpawn = false
    loadingGui.IgnoreGuiInset = true
    loadingGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
    loadingGui.DisplayOrder = 999999999
    pcall(function()
        loadingGui.ScreenInsets = Enum.ScreenInsets.None
    end)
    loadingGui.Parent = guiParent

    hideOtherLoadingGuis()

    local shade = Instance.new("Frame")
    shade.Size = UDim2.fromScale(1, 1)
    shade.BackgroundColor3 = Color3.fromRGB(8, 9, 13)
    shade.BorderSizePixel = 0
    shade.Parent = loadingGui

    local glow = Instance.new("Frame")
    glow.AnchorPoint = Vector2.new(0.5, 0.5)
    glow.Position = UDim2.fromScale(0.5, 0.5)
    glow.Size = UDim2.fromOffset(520, 320)
    glow.BackgroundColor3 = Color3.fromRGB(76, 91, 255)
    glow.BackgroundTransparency = 0.72
    glow.BorderSizePixel = 0
    glow.Parent = shade
    Instance.new("UICorner", glow).CornerRadius = UDim.new(0, 24)

    local glowGradient = Instance.new("UIGradient")
    glowGradient.Color = ColorSequence.new({
        ColorSequenceKeypoint.new(0, Color3.fromRGB(76, 91, 255)),
        ColorSequenceKeypoint.new(0.5, Color3.fromRGB(38, 190, 120)),
        ColorSequenceKeypoint.new(1, Color3.fromRGB(240, 199, 94)),
    })
    glowGradient.Rotation = 25
    glowGradient.Parent = glow

    local panel = Instance.new("Frame")
    panel.AnchorPoint = Vector2.new(0.5, 0.5)
    panel.Position = UDim2.fromScale(0.5, 0.5)
    panel.Size = UDim2.fromOffset(430, 230)
    panel.BackgroundColor3 = Color3.fromRGB(15, 17, 24)
    panel.BorderSizePixel = 0
    panel.Parent = shade
    Instance.new("UICorner", panel).CornerRadius = UDim.new(0, 14)

    local stroke = Instance.new("UIStroke")
    stroke.Color = Color3.fromRGB(90, 105, 255)
    stroke.Transparency = 0.15
    stroke.Thickness = 1.4
    stroke.Parent = panel

    local logo = Instance.new("TextLabel")
    logo.BackgroundTransparency = 1
    logo.AnchorPoint = Vector2.new(0.5, 0)
    logo.Position = UDim2.fromScale(0.5, 0)
    logo.Size = UDim2.new(1, -40, 0, 64)
    logo.Font = Enum.Font.GothamBlack
    logo.Text = "NIN'S HUB"
    logo.TextColor3 = Color3.fromRGB(245, 247, 255)
    logo.TextSize = 34
    logo.Parent = panel

    local subtitle = Instance.new("TextLabel")
    subtitle.BackgroundTransparency = 1
    subtitle.Position = UDim2.fromOffset(20, 64)
    subtitle.Size = UDim2.new(1, -40, 0, 24)
    subtitle.Font = Enum.Font.Gotham
    subtitle.Text = "Preparing key system"
    subtitle.TextColor3 = Color3.fromRGB(170, 176, 196)
    subtitle.TextSize = 14
    subtitle.Parent = panel

    local barBack = Instance.new("Frame")
    barBack.Position = UDim2.fromOffset(32, 124)
    barBack.Size = UDim2.new(1, -64, 0, 12)
    barBack.BackgroundColor3 = Color3.fromRGB(35, 38, 50)
    barBack.BorderSizePixel = 0
    barBack.Parent = panel
    Instance.new("UICorner", barBack).CornerRadius = UDim.new(1, 0)

    local barFill = Instance.new("Frame")
    barFill.Size = UDim2.fromScale(0, 1)
    barFill.BackgroundColor3 = Color3.fromRGB(76, 91, 255)
    barFill.BorderSizePixel = 0
    barFill.Parent = barBack
    Instance.new("UICorner", barFill).CornerRadius = UDim.new(1, 0)

    local barGradient = Instance.new("UIGradient")
    barGradient.Color = ColorSequence.new({
        ColorSequenceKeypoint.new(0, Color3.fromRGB(76, 91, 255)),
        ColorSequenceKeypoint.new(1, Color3.fromRGB(38, 190, 120)),
    })
    barGradient.Parent = barFill

    local percent = Instance.new("TextLabel")
    percent.BackgroundTransparency = 1
    percent.Position = UDim2.fromOffset(32, 146)
    percent.Size = UDim2.new(1, -64, 0, 24)
    percent.Font = Enum.Font.GothamBold
    percent.Text = "0%"
    percent.TextColor3 = Color3.fromRGB(240, 199, 94)
    percent.TextSize = 14
    percent.Parent = panel

    local steps = {
        "Starting secure loader...",
        "Checking executor...",
        "Loading clean interface...",
        "Preparing website key check...",
        "Almost ready...",
    }

    local startTime = os.clock()
    local duration = 15
    while loadingGui.Parent and os.clock() - startTime < duration do
        hideOtherLoadingGuis()
        loadingGui.DisplayOrder = 999999999
        local alpha = math.clamp((os.clock() - startTime) / duration, 0, 1)
        local pct = math.floor(alpha * 100)
        barFill.Size = UDim2.fromScale(alpha, 1)
        percent.Text = tostring(pct) .. "%"
        subtitle.Text = steps[math.clamp(math.floor(alpha * #steps) + 1, 1, #steps)]
        glowGradient.Rotation = (glowGradient.Rotation + 2) % 360
        logo.TextTransparency = 0.05 + (math.sin(os.clock() * 5) + 1) * 0.08
        task.wait(0.03)
    end

    barFill.Size = UDim2.fromScale(1, 1)
    percent.Text = "100%"
    subtitle.Text = "Ready"
    task.wait(0.25)

    local fadeInfo = TweenInfo.new(0.45, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
    for _, item in ipairs(loadingGui:GetDescendants()) do
        if item:IsA("Frame") then
            TweenService:Create(item, fadeInfo, { BackgroundTransparency = 1 }):Play()
        elseif item:IsA("TextLabel") or item:IsA("TextButton") or item:IsA("TextBox") then
            TweenService:Create(item, fadeInfo, {
                TextTransparency = 1,
                BackgroundTransparency = 1,
            }):Play()
        elseif item:IsA("UIStroke") then
            TweenService:Create(item, fadeInfo, { Transparency = 1 }):Play()
        end
    end

    task.wait(0.5)
    loadingGui:Destroy()

    for item in pairs(hiddenGuis) do
        if item and item.Parent then
            pcall(function()
                item.Enabled = true
            end)
        end
    end
end

runLoadingScreen()

local deviceValid = checkDevice()
if deviceValid then
    print("This Roblox account and saved device are still valid. Loading Nin's Hub.")
    loadMain()
    return
end

local savedKey = getSavedKey()
if savedKey then
    local valid = checkKey(savedKey)
    if valid then
        print("Saved key is still valid. Loading Nin's Hub.")
        loadMain()
        return
    else
        print("Saved key is invalid or expired. Clearing it.")
        clearSavedKey()
    end
end

local oldGui = playerGui:FindFirstChild("NinsKeySystem")
if oldGui then oldGui:Destroy() end

local gui = Instance.new("ScreenGui")
gui.Name = "NinsKeySystem"
gui.ResetOnSpawn = false
gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
gui.Parent = playerGui

local main = Instance.new("Frame")
main.Name = "Main"
main.Size = UDim2.fromOffset(430, 290)
main.Position = UDim2.fromScale(0.5, 0.5)
main.AnchorPoint = Vector2.new(0.5, 0.5)
main.BackgroundColor3 = Color3.fromRGB(13, 14, 20)
main.BorderSizePixel = 0
main.Parent = gui

Instance.new("UICorner", main).CornerRadius = UDim.new(0, 10)

local stroke = Instance.new("UIStroke")
stroke.Color = Color3.fromRGB(70, 75, 95)
stroke.Thickness = 1
stroke.Transparency = 0.2
stroke.Parent = main

local top = Instance.new("Frame")
top.Name = "Top"
top.Size = UDim2.new(1, 0, 0, 46)
top.BackgroundColor3 = Color3.fromRGB(22, 23, 32)
top.BorderSizePixel = 0
top.Parent = main

Instance.new("UICorner", top).CornerRadius = UDim.new(0, 10)

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, -90, 1, 0)
title.Position = UDim2.fromOffset(16, 0)
title.BackgroundTransparency = 1
title.Text = "Nin's Hub"
title.TextColor3 = Color3.fromRGB(245, 246, 255)
title.Font = Enum.Font.GothamBold
title.TextSize = 18
title.TextXAlignment = Enum.TextXAlignment.Left
title.Parent = top

local close = Instance.new("TextButton")
close.Size = UDim2.fromOffset(32, 32)
close.Position = UDim2.new(1, -40, 0, 7)
close.BackgroundColor3 = Color3.fromRGB(35, 36, 48)
close.Text = "X"
close.TextColor3 = Color3.fromRGB(230, 230, 240)
close.Font = Enum.Font.GothamBold
close.TextSize = 14
close.Parent = top
Instance.new("UICorner", close).CornerRadius = UDim.new(0, 8)

local profile = Instance.new("Frame")
profile.Size = UDim2.new(1, -32, 0, 74)
profile.Position = UDim2.fromOffset(16, 62)
profile.BackgroundColor3 = Color3.fromRGB(18, 20, 29)
profile.BorderSizePixel = 0
profile.Parent = main
Instance.new("UICorner", profile).CornerRadius = UDim.new(0, 8)

local avatar = Instance.new("ImageLabel")
avatar.Size = UDim2.fromOffset(52, 52)
avatar.Position = UDim2.fromOffset(12, 11)
avatar.BackgroundColor3 = Color3.fromRGB(33, 36, 48)
avatar.Image = "rbxthumb://type=AvatarHeadShot&id=" .. player.UserId .. "&w=150&h=150"
avatar.Parent = profile
Instance.new("UICorner", avatar).CornerRadius = UDim.new(0, 8)

local hello = Instance.new("TextLabel")
hello.Size = UDim2.new(1, -82, 0, 24)
hello.Position = UDim2.fromOffset(76, 13)
hello.BackgroundTransparency = 1
hello.Text = "Hello, " .. player.Name
hello.TextColor3 = Color3.fromRGB(255, 255, 255)
hello.Font = Enum.Font.GothamBold
hello.TextSize = 14
hello.TextXAlignment = Enum.TextXAlignment.Left
hello.Parent = profile

local sub = Instance.new("TextLabel")
sub.Size = UDim2.new(1, -82, 0, 22)
sub.Position = UDim2.fromOffset(76, 36)
sub.BackgroundTransparency = 1
sub.Text = "Executor: " .. detectExecutor()
sub.TextColor3 = Color3.fromRGB(165, 170, 190)
sub.Font = Enum.Font.Gotham
sub.TextSize = 12
sub.TextXAlignment = Enum.TextXAlignment.Left
sub.Parent = profile

local box = Instance.new("TextBox")
box.Size = UDim2.new(1, -32, 0, 42)
box.Position = UDim2.fromOffset(16, 151)
box.BackgroundColor3 = Color3.fromRGB(26, 28, 39)
box.TextColor3 = Color3.fromRGB(255, 255, 255)
box.PlaceholderColor3 = Color3.fromRGB(120, 125, 145)
box.PlaceholderText = "Enter your 24 hour key..."
box.Text = ""
box.Font = Enum.Font.Gotham
box.TextSize = 14
box.ClearTextOnFocus = false
box.Parent = main
Instance.new("UICorner", box).CornerRadius = UDim.new(0, 8)

local status = Instance.new("TextLabel")
status.Size = UDim2.new(1, -32, 0, 28)
status.Position = UDim2.fromOffset(16, 199)
status.BackgroundTransparency = 1
status.Text = "Get a key from the website, then paste it here."
status.TextColor3 = Color3.fromRGB(170, 176, 196)
status.Font = Enum.Font.Gotham
status.TextSize = 12
status.TextXAlignment = Enum.TextXAlignment.Left
status.Parent = main

local getKey = Instance.new("TextButton")
getKey.Size = UDim2.new(0.5, -22, 0, 42)
getKey.Position = UDim2.fromOffset(16, 234)
getKey.BackgroundColor3 = Color3.fromRGB(76, 91, 255)
getKey.Text = "Get Key"
getKey.TextColor3 = Color3.fromRGB(255, 255, 255)
getKey.Font = Enum.Font.GothamBold
getKey.TextSize = 14
getKey.Parent = main
Instance.new("UICorner", getKey).CornerRadius = UDim.new(0, 8)

local submit = Instance.new("TextButton")
submit.Size = UDim2.new(0.5, -22, 0, 42)
submit.Position = UDim2.new(0.5, 6, 0, 234)
submit.BackgroundColor3 = Color3.fromRGB(38, 190, 120)
submit.Text = "Check Key"
submit.TextColor3 = Color3.fromRGB(255, 255, 255)
submit.Font = Enum.Font.GothamBold
submit.TextSize = 14
submit.Parent = main
Instance.new("UICorner", submit).CornerRadius = UDim.new(0, 8)

local accent = Instance.new("Frame")
accent.Size = UDim2.new(1, -32, 0, 2)
accent.Position = UDim2.fromOffset(16, 45)
accent.BackgroundColor3 = Color3.fromRGB(76, 91, 255)
accent.BorderSizePixel = 0
accent.Parent = main

local dragging, dragStart, startPos
top.InputBegan:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
        dragging = true
        dragStart = input.Position
        startPos = main.Position
    end
end)

UserInputService.InputEnded:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
        dragging = false
    end
end)

UserInputService.InputChanged:Connect(function(input)
    if dragging and (input.UserInputType == Enum.UserInputType.MouseMovement or input.UserInputType == Enum.UserInputType.Touch) then
        local delta = input.Position - dragStart
        main.Position = UDim2.new(
            startPos.X.Scale,
            startPos.X.Offset + delta.X,
            startPos.Y.Scale,
            startPos.Y.Offset + delta.Y
        )
    end
end)

close.MouseButton1Click:Connect(function()
    gui:Destroy()
end)

local function setStatus(text, color)
    status.Text = text
    status.TextColor3 = color or Color3.fromRGB(170, 176, 196)
end

getKey.MouseButton1Click:Connect(function()
    pcall(function()
        setclipboard(KEY_PAGE)
    end)
    setStatus("Key website copied. Paste it into your browser.", Color3.fromRGB(130, 170, 255))
end)

submit.MouseButton1Click:Connect(function()
    local key = box.Text:gsub("%s+", "")

    if key == "" then
        setStatus("Enter your key first.", Color3.fromRGB(255, 190, 90))
        return
    end

    submit.Text = "Checking..."
    submit.AutoButtonColor = false
    setStatus("Checking key...", Color3.fromRGB(130, 170, 255))

    local valid, err = checkKey(key)

    if err == "request failed" then
        submit.Text = "Check Key"
        submit.AutoButtonColor = true
        setStatus("Could not check key. Try again.", Color3.fromRGB(255, 100, 100))
        return
    end

    if valid then
        saveKey(key)
        setStatus("Key valid. Loading Nin's Hub...", Color3.fromRGB(90, 255, 160))
        submit.Text = "Loaded"

        TweenService:Create(main, TweenInfo.new(0.25), {
            BackgroundTransparency = 1
        }):Play()

        task.wait(0.35)
        gui:Destroy()
        loadMain()
    else
        clearSavedKey()
        submit.Text = "Check Key"
        submit.AutoButtonColor = true
        setStatus("Invalid or expired key.", Color3.fromRGB(255, 100, 100))
    end
end)

