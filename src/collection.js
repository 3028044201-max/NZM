// Collection APIs for testing
const HEADERS = {
    'Host': 'comm.ams.game.qq.com',
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B)',
    'Referer': 'https://servicewechat.com/wx4e8cbe4fb0eca54c/9/page-frame.html',
    'xweb_xhr': '1',
};
const API_URL = 'https://comm.ams.game.qq.com/ide/';

function normalizeCookie(cookie) {
    return (cookie || '').replace(/[\r\n]/g, '').trim();
}

function buildBody(method, param) {
    const params = {
        iChartId: '430662', iSubChartId: '430662', sIdeToken: 'NoOapI',
        eas_url: 'http://wechatmini.qq.com/-/-/pages/handbook/handbook/',
        method: method, from_source: '2',
        param: JSON.stringify(param),
    };
    return new URLSearchParams(params).toString();
}

// 武器图鉴
async function fetchWeaponCollection(cookie) {
    const cleanCookie = normalizeCookie(cookie);
    const body = buildBody('collection.weapon.list', { seasonID: 1, queryTime: true });
    try {
        const res = await fetch(API_URL, { method: 'POST', headers: { ...HEADERS, 'Cookie': cleanCookie }, body });
        const data = await res.json();
        return data.jData?.data?.data?.list || null;
    } catch (e) { return { error: e.message }; }
}

// 塔防图鉴
async function fetchTrapCollection(cookie) {
    const cleanCookie = normalizeCookie(cookie);
    const body = buildBody('collection.trap.list', { seasonID: 1 });
    try {
        const res = await fetch(API_URL, { method: 'POST', headers: { ...HEADERS, 'Cookie': cleanCookie }, body });
        const data = await res.json();
        return data.jData?.data?.data?.list || null;
    } catch (e) { return { error: e.message }; }
}

// 插件图鉴
async function fetchPluginCollection(cookie) {
    const cleanCookie = normalizeCookie(cookie);
    const body = buildBody('collection.plugin.list', { seasonID: 1 });
    try {
        const res = await fetch(API_URL, { method: 'POST', headers: { ...HEADERS, 'Cookie': cleanCookie }, body });
        const data = await res.json();
        return data.jData?.data?.data?.list || null;
    } catch (e) { return { error: e.message }; }
}

// 首页碎片进度
async function fetchCollectionHome(cookie) {
    const cleanCookie = normalizeCookie(cookie);
    const body = buildBody('collection.home', { seasonID: 1, limit: 4 });
    try {
        const res = await fetch(API_URL, { method: 'POST', headers: { ...HEADERS, 'Cookie': cleanCookie }, body });
        const data = await res.json();
        // 返回 weaponList 字段
        return data.jData?.data?.data?.weaponList || null;
    } catch (e) { return { error: e.message }; }
}

export async function handleCollection(request) {
    const cookie = request.headers.get('X-NZM-Cookie');
    if (!cookie) return new Response(JSON.stringify({ success: false, message: 'Missing Cookie' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'all';

    let result = {};

    if (type === 'all' || type === 'weapon') {
        result.weapons = await fetchWeaponCollection(cookie);
    }
    if (type === 'all' || type === 'trap') {
        result.traps = await fetchTrapCollection(cookie);
    }
    if (type === 'all' || type === 'plugin') {
        result.plugins = await fetchPluginCollection(cookie);
    }
    if (type === 'all' || type === 'home') {
        result.home = await fetchCollectionHome(cookie);
    }

    // Calculate summary
    if (result.weapons) {
        const owned = result.weapons.filter(w => w.owned).length;
        result.weaponSummary = { total: result.weapons.length, owned };
    }
    if (result.traps) {
        const owned = result.traps.filter(t => t.owned).length;
        result.trapSummary = { total: result.traps.length, owned };
    }
    if (result.plugins) {
        const owned = result.plugins.filter(p => p.owned).length;
        result.pluginSummary = { total: result.plugins.length, owned };
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
