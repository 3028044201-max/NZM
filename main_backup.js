const { app, BrowserWindow, session, shell } = require('electron');
const express = require('express');
const path = require('path');

const serverApp = express();
const PORT = 3000;

// --- In-Memory Storage for Cookies ---
const userStore = new Map(); // uid -> cookie

// --- Constants & Config ---
const HEADERS = {
    'Host': 'comm.ams.game.qq.com',
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B)',
    'Referer': 'https://servicewechat.com/wx4e8cbe4fb0eca54c/9/page-frame.html',
    'xweb_xhr': '1',
};
const API_URL = 'https://comm.ams.game.qq.com/ide/';

// Simplified Local Config (Merged from 数据1.json)
const LOCAL_CONFIG = {
    difficultyInfo: {
        "0": { "id": 0, "name": "默认" },
        "1": { "id": 1, "name": "引导" },
        "10": { "id": 10, "name": "折磨V" },
        "11": { "id": 11, "name": "折磨VI" },
        "2": { "id": 2, "name": "普通" },
        "3": { "id": 3, "name": "困难" },
        "32": { "id": 32, "name": "练习" },
        "4": { "id": 4, "name": "英雄" },
        "5": { "id": 5, "name": "炼狱" },
        "6": { "id": 6, "name": "折磨I" },
        "64": { "id": 64, "name": "最大值" },
        "7": { "id": 7, "name": "折磨II" },
        "8": { "id": 8, "name": "折磨III" },
        "9": { "id": 9, "name": "折磨IV" }
    },
    mapInfo: {
        "1000": { "id": 1000, "name": "风暴峡谷", "mode": "机甲非对称", "icon": "https://nzm.playerhub.qq.com/playerhub/60106/maps/maps-1000.png" },
        "1001": { "id": 1001, "name": "风暴峡谷", "mode": "机甲非对称", "icon": "https://nzm.playerhub.qq.com/playerhub/60106/maps/maps-1001.png" },
        "1002": { "id": 1002, "name": "凯旋之地", "mode": "机甲非对称", "icon": "https://nzm.playerhub.qq.com/playerhub/60106/maps/maps-1002.png" },
        "112": { "id": 112, "name": "黑暗复活节", "mode": "猎场竞速", "icon": "https://nzm.playerhub.qq.com/playerhub/60106/maps/maps-112.png" },
        "114": { "id": 114, "name": "大都会", "mode": "猎场竞速", "icon": "https://nzm.playerhub.qq.com/playerhub/60106/maps/maps-114.png" },
        "115": { "id": 115, "name": "冰点源起", "mode": "猎场竞速", "icon": "https://nzm.playerhub.qq.com/playerhub/60106/maps/maps-115.png" },
        "12": { "id": 12, "name": "黑暗复活节", "mode": "猎场", "icon": "https://nzm.playerhub.qq.com/playerhub/60106/maps/maps-12.png" },
        "132": { "id": 132, "name": "飓风要塞-风暴行动--BOSS撕咬", "mode": "副本", "icon": "https://nzm.playerhub.qq.com/playerhub/60106/maps/maps-132.png" },
        "135": { "id": 135, "name": "太空电梯上/苍穹之上--BOSS护盾壁垒", "mode": "副本", "icon": "https://nzm.playerhub.qq.com/playerhub/60106/maps/maps-135.png" },
        "14": { "id": 14, "name": "大都会", "mode": "猎场", "icon": "https://nzm.playerhub.qq.com/playerhub/60106/maps/maps-14.png" },
        "21": { "id": 21, "name": "冰点源起", "mode": "猎场", "icon": "https://nzm.playerhub.qq.com/playerhub/60106/maps/maps-21.png" },
        "30": { "id": 30, "name": "猎场-新手关", "mode": "猎场", "icon": "https://nzm.playerhub.qq.com/playerhub/60106/maps/maps-30.png" },
        "300": { "id": 300, "name": "空间站", "mode": "塔防", "icon": "https://nzm.playerhub.qq.com/playerhub/60106/maps/maps-300.png" },
        "304": { "id": 304, "name": "20号星港", "mode": "塔防", "icon": "https://nzm.playerhub.qq.com/playerhub/60106/maps/maps-304.png" },
        "308": { "id": 308, "name": "塔防-新手关", "mode": "塔防", "icon": "https://nzm.playerhub.qq.com/playerhub/60106/maps/maps-308.png" },
        "321": { "id": 321, "name": "根除变异", "mode": "时空追猎", "icon": "https://nzm.playerhub.qq.com/playerhub/60106/maps/maps-321.png" },
        "322": { "id": 322, "name": "夺回资料", "mode": "时空追猎", "icon": "https://nzm.playerhub.qq.com/playerhub/60106/maps/maps-322.png" },
        "324": { "id": 324, "name": "追猎-新手关", "mode": "时空追猎", "icon": "https://nzm.playerhub.qq.com/playerhub/60106/maps/maps-324.png" }
    }
};

// --- Helper Functions ---
function normalizeCookie(cookie) {
    return (cookie || '').replace(/[\r\n]/g, '').trim();
}

function buildBody(method, param) {
    const params = {
        iChartId: '430662', iSubChartId: '430662', sIdeToken: 'NoOapI',
        eas_url: 'http://wechatmini.qq.com/-/-/pages/record/record/',
        method: method, from_source: '2',
        param: JSON.stringify(param),
    };
    return new URLSearchParams(params).toString();
}

async function fetchWithRetry(fetchFn, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try { return await fetchFn(); }
        catch (e) { if (i === retries - 1) throw e; await new Promise(r => setTimeout(r, 500)); }
    }
}

// --- API Fetching Logic ---
async function fetchUserSummary(cookie) {
    const cleanCookie = normalizeCookie(cookie);
    const body = buildBody('center.user.stats', { seasonID: 1 });
    try {
        const res = await fetch(API_URL, { method: 'POST', headers: { ...HEADERS, 'Cookie': cleanCookie }, body });
        const data = await res.json();
        return data.jData?.data?.data || null;
    } catch (e) {
        console.error('Summary Fetch Error:', e);
        return null;
    }
}

async function fetchGameList(cookie, page = 1) {
    const cleanCookie = normalizeCookie(cookie);
    const body = buildBody('center.user.game.list', { seasonID: 1, page, limit: 10 });
    try {
        const res = await fetch(API_URL, { method: 'POST', headers: { ...HEADERS, 'Cookie': cleanCookie }, body });
        const data = await res.json();
        return data.jData?.data?.data?.gameList || [];
    } catch (e) { return []; }
}

async function fetchAllGames(cookie, maxPages = 10) { // Set to EXACTLY 10 pages per request
    let all = [];
    for (let p = 1; p <= maxPages; p++) {
        const list = await fetchGameList(cookie, p);
        if (!list.length) break;
        all = all.concat(list);
    }
    return all;
}

async function fetchGameDetail(cookie, roomId) {
    const cleanCookie = normalizeCookie(cookie);
    const body = buildBody('center.game.detail', { seasonID: 1, roomID: roomId });
    try {
        const res = await fetch(API_URL, { method: 'POST', headers: { ...HEADERS, 'Cookie': cleanCookie }, body });
        const data = await res.json();
        return data.jData?.data?.data || null;
    } catch (e) { return null; }
}

async function fetchConfig(cookie) {
    const cleanCookie = normalizeCookie(cookie);
    const body = buildBody('center.user.game.config', { seasonID: 1 });
    try {
        const res = await fetch(API_URL, { method: 'POST', headers: { ...HEADERS, 'Cookie': cleanCookie }, body });
        const data = await res.json();
        return data.jData?.data?.data?.config;
    } catch (e) { return null; }
}

// --- Calculation Logic ---
function calculateStats(records, config) {
    if (!records || records.length === 0) return { totalGames: 0, winRate: 0, avgDamage: 0, modeStats: {}, mapStats: {} };

    // Prefer dynamically fetched config, fallback to local
    const mapInfo = { ...LOCAL_CONFIG.mapInfo, ...(config?.mapInfo || {}) };
    const diffInfo = { ...LOCAL_CONFIG.difficultyInfo, ...(config?.difficultyInfo || {}) };

    const stats = {
        totalGames: 0, totalWin: 0, totalLoss: 0, totalDuration: 0, totalDamage: 0,
        mapStats: {}, modeStats: {}
    };

    records.forEach(record => {
        let mapName = `地图${record.iMapId}`;
        let modeName = `模式${record.iGameMode}`;

        if (mapInfo[record.iMapId]) {
            mapName = mapInfo[record.iMapId].name;
            modeName = mapInfo[record.iMapId].mode;
        }

        if (modeName.includes('机甲') || record.iGameMode === 6) return;

        stats.totalGames++;
        stats.totalDuration += parseInt(record.iDuration || 0);
        const score = parseInt(record.iScore || 0);
        stats.totalDamage += score;

        const isWin = parseInt(record.iIsWin) === 1;
        if (isWin) stats.totalWin++; else stats.totalLoss++;

        if (!stats.modeStats[modeName]) stats.modeStats[modeName] = { total: 0, win: 0, loss: 0 };
        stats.modeStats[modeName].total++;
        if (isWin) stats.modeStats[modeName].win++; else stats.modeStats[modeName].loss++;

        // Map Stats
        if (!stats.mapStats[mapName]) stats.mapStats[mapName] = {};

        let diff = '默认';
        if (diffInfo[record.iSubModeType]) {
            diff = diffInfo[record.iSubModeType].name;
        }

        if (!stats.mapStats[mapName][diff]) stats.mapStats[mapName][diff] = { total: 0, win: 0, loss: 0 };
        stats.mapStats[mapName][diff].total++;
        if (isWin) stats.mapStats[mapName][diff].win++; else stats.mapStats[mapName][diff].loss++;
    });

    stats.winRate = stats.totalGames > 0 ? ((stats.totalWin / stats.totalGames) * 100).toFixed(1) : 0;
    stats.avgDamage = stats.totalGames > 0 ? Math.floor(stats.totalDamage / stats.totalGames) : 0;

    return stats;
}


// --- Express Routes ---
serverApp.use(express.static(path.join(__dirname, 'public')));
serverApp.use(express.json());

serverApp.get('/api/login', (req, res) => {
    if (loginWindow && !loginWindow.isDestroyed()) {
        loginWindow.focus();
        return res.status(409).json({ message: 'Login window open' });
    }
    createLoginWindow((cookieStr) => {
        res.json({ success: true, cookie: cookieStr });
    });
});

serverApp.post('/api/bind', (req, res) => {
    const { cookie } = req.body;
    if (!cookie) return res.status(400).json({ success: false });
    const uid = 'local_user_' + Date.now();
    userStore.set(uid, cookie);
    res.json({ success: true, uid });
});

serverApp.get('/api/stats', async (req, res) => {
    const uid = req.query.uid;
    const cookie = userStore.get(uid);
    if (!cookie) return res.status(401).json({ success: false, message: 'Not logged in' });

    try {
        const [summary, config, rawGames] = await Promise.all([
            fetchUserSummary(cookie),
            fetchConfig(cookie),
            fetchAllGames(cookie, 10) // Fixed 10 pages / 100 games
        ]);

        const mapInfo = { ...LOCAL_CONFIG.mapInfo, ...(config?.mapInfo || {}) };
        const diffInfo = { ...LOCAL_CONFIG.difficultyInfo, ...(config?.difficultyInfo || {}) };

        // Filter games BEFORE calculation and response
        const filteredGames = rawGames.filter(g => {
            const mapId = parseInt(g.iMapId);
            const modeId = parseInt(g.iGameMode);

            // 1. Filter by Map ID range (Mecha is usually 1000+)
            if (mapId >= 1000) return false;

            // 2. Filter by Mode Name/Prop if known
            const mapName = mapInfo[mapId]?.name || '';
            const modeName = mapInfo[mapId]?.mode || '';
            if (modeName.includes('机甲') || modeName.includes('PVP') || modeName.includes('竞技')) return false;

            // 3. Filter by Mode ID (6 is often Mecha/Special)
            if (modeId === 6) return false;

            return true;
        });

        const calculated = calculateStats(filteredGames, config);

        // Transform for frontend
        const gameList = filteredGames.map(g => ({
            ...g, // Preserve original keys (iMapId, iIsWin, etc.) for app.js
            mapName: mapInfo[g.iMapId]?.name || `地图${g.iMapId}`,
            modeName: mapInfo[g.iMapId]?.mode || '未知',
            diffName: diffInfo[g.iSubModeType]?.name || `难度${g.iSubModeType}`,
            // We can still keep these friendly names if we update app.js to use them
        }));

        res.json({
            success: true,
            data: {
                ...calculated,
                officialSummary: summary,
                gameList: gameList
            }
        });

    } catch (e) {
        console.error('Stats Error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

serverApp.get('/api/detail', async (req, res) => {
    const uid = req.query.uid;
    const roomId = req.query.room_id;
    const cookie = userStore.get(uid);

    if (!cookie) return res.status(401).json({ success: false, message: 'Not logged in' });
    if (!roomId) return res.status(400).json({ success: false, message: 'Missing room_id' });

    try {
        const detail = await fetchGameDetail(cookie, roomId);
        res.json({ success: true, data: detail });
    } catch (e) {
        console.error('Detail Error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// --- Server Start ---
let server;
function startServer() {
    server = serverApp.listen(PORT, () => {
        console.log(`Server at http://localhost:${PORT}`);
        shell.openExternal(`http://localhost:${PORT}`);
    });
}

// --- Electron Logic ---
let loginWindow;
let cookieCallback;

function createLoginWindow(cb) {
    cookieCallback = cb;
    loginWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        autoHideMenuBar: true,
        alwaysOnTop: true, // Ensure it pops up
        center: true,
        bg: '#ffffff'
    });

    // Reset alwaysOnTop after a moment so user can switch windows if needed
    setTimeout(() => { if (loginWindow) loginWindow.setAlwaysOnTop(false); }, 1000);

    loginWindow.loadURL('https://qzone.qq.com/');
    const timer = setInterval(checkCookies, 1000);
    loginWindow.on('closed', () => { clearInterval(timer); loginWindow = null; });
}

async function checkCookies() {
    if (!loginWindow) return;
    try {
        const cookies = await session.defaultSession.cookies.get({});
        const skey = cookies.find(c => c.name === 'skey');
        const uin = cookies.find(c => c.name === 'uin');
        if (skey && uin) {
            const str = `uin=${uin.value}; skey=${skey.value};`;
            if (cookieCallback) cookieCallback(str);
            if (!loginWindow.isDestroyed()) loginWindow.close();
        }
    } catch (e) { }
}

app.whenReady().then(() => { startServer(); });
app.on('window-all-closed', () => { });
app.on('before-quit', () => { if (server) server.close(); });
