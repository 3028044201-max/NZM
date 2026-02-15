// 全局变量定义
let dom = {};
let qrTimer = null;
let wxQrTimer = null;
let qrSig = '';
let wxQrUuid = '';
let isQRPollingActive = false;
let isWxQRPollingActive = false;
let wxQrPollingInFlight = false;

// 后端API地址（替换为你的Cloudflare Worker地址）
const API_BASE = 'https://nzapi.3028044201.workers.dev';

// 初始化DOM元素
function initDOM() {
    dom = {
        qrImg: document.getElementById('qr-img'),
        qrLoading: document.getElementById('qr-loading'),
        qrOverlay: document.getElementById('qr-overlay'),
        qrStatus: document.getElementById('qr-status'),
        qqBtn: document.getElementById('method-qq'),
        wechatBtn: document.getElementById('method-wechat'),
        qqContainer: document.getElementById('qr-login-container'),
        wechatContainer: document.getElementById('wechat-login-container')
    };
}

// 切换登录方式
function switchLoginMethod(method) {
    // 清空所有定时器，避免重复
    if (qrTimer) { clearInterval(qrTimer); qrTimer = null; }
    if (wxQrTimer) { clearInterval(wxQrTimer); wxQrTimer = null; }
    isQRPollingActive = false;
    isWxQRPollingActive = false;

    if (method === 'wechat') {
        dom.qqBtn.style.background = '#1f2937';
        dom.qqBtn.style.color = '#9ca3af';
        dom.qqBtn.classList.remove('active');
        dom.wechatBtn.style.background = '#10b981';
        dom.wechatBtn.style.color = '#fff';
        dom.wechatBtn.classList.add('active');
        dom.qqContainer.style.display = 'none';
        dom.wechatContainer.style.display = 'block';
        startWxQRLogin(); // 切换微信时初始化二维码
    } else {
        dom.wechatBtn.style.background = '#1f2937';
        dom.wechatBtn.style.color = '#9ca3af';
        dom.wechatBtn.classList.remove('active');
        dom.qqBtn.style.background = '#8b5cf6';
        dom.qqBtn.style.color = '#fff';
        dom.qqBtn.classList.add('active');
        dom.qqContainer.style.display = 'block';
        dom.wechatContainer.style.display = 'none';
        startQRLogin(); // 切换QQ时初始化二维码
    }
}

// QQ二维码登录初始化
async function startQRLogin() {
    // 强制清空旧定时器
    if (qrTimer) {
        clearInterval(qrTimer);
        qrTimer = null;
    }
    isQRPollingActive = false;

    // 重置UI状态
    dom.qrLoading.style.display = 'flex';
    dom.qrOverlay.style.display = 'none';
    dom.qrImg.style.display = 'none';
    dom.qrStatus.textContent = '正在获取二维码...';
    dom.qrStatus.style.color = '#aaa';

    try {
        const res = await fetch(`${API_BASE}/api/auth/qr`);
        if (!res.ok) throw new Error(`接口请求失败：${res.status}`);
        
        const json = await res.json();
        // 严格校验返回格式
        if (!json || json.success !== true || !json.data?.qrcode) {
            throw new Error('接口返回数据格式错误');
        }

        // 渲染二维码
        dom.qrImg.src = json.data.qrcode;
        qrSig = json.data.qrsig;

        dom.qrLoading.style.display = 'none';
        dom.qrImg.style.display = 'block';
        dom.qrStatus.textContent = '请使用 手机QQ 扫码登录';
        dom.qrStatus.style.color = '#aaa';

        isQRPollingActive = true;
        qrTimer = setInterval(checkQR, 3000);
    } catch (e) {
        // 失败时停止加载，显示错误提示
        console.error('QQ二维码获取失败：', e);
        dom.qrLoading.style.display = 'none';
        dom.qrStatus.textContent = `获取失败：${e.message}，点击重试`;
        dom.qrStatus.style.color = '#ef4444';
        dom.qrOverlay.style.display = 'flex';
    }
}

// 检查QQ登录状态
async function checkQR() {
    if (!isQRPollingActive || !qrSig) return;

    try {
        const res = await fetch(`${API_BASE}/api/auth/check?qrsig=${qrSig}`);
        if (!res.ok) throw new Error('登录状态校验失败');
        
        const json = await res.json();
        if (json.status === 0) {
            // 登录成功
            clearInterval(qrTimer);
            isQRPollingActive = false;
            localStorage.setItem('nzm_cookie', json.data.cookie);
            loadStats(); // 加载数据
        } else if (json.status === 66) {
            dom.qrStatus.textContent = '请使用手机QQ扫码登录';
        } else if (json.status === 67) {
            dom.qrStatus.textContent = '已扫码，请在手机上确认登录';
        } else if (json.status === 65 || json.message.includes('失效')) {
            clearInterval(qrTimer);
            isQRPollingActive = false;
            dom.qrStatus.textContent = '二维码已失效，点击重试';
            dom.qrOverlay.style.display = 'flex';
        }
    } catch (e) {
        console.error('QQ登录状态校验失败：', e);
    }
}

// 微信二维码登录初始化
async function startWxQRLogin() {
    if (wxQrTimer) {
        clearInterval(wxQrTimer);
        wxQrTimer = null;
    }
    isWxQRPollingActive = false;
    wxQrPollingInFlight = false;

    const wxQrImg = document.getElementById('wx-qr-img');
    const wxQrLoading = document.getElementById('wx-qr-loading');
    const wxQrOverlay = document.getElementById('wx-qr-overlay');
    const wxQrStatus = document.getElementById('wx-qr-status');

    // 重置微信UI状态
    wxQrLoading.style.display = 'flex';
    wxQrOverlay.style.display = 'none';
    wxQrImg.style.display = 'none';
    wxQrStatus.textContent = '正在获取微信二维码...';
    wxQrStatus.style.color = '#aaa';

    try {
        const res = await fetch(`${API_BASE}/api/auth/wx-qr`);
        if (!res.ok) throw new Error(`接口请求失败：${res.status}`);
        
        const json = await res.json();
        if (!json || json.success !== true || !json.data?.qrcode) {
            throw new Error('接口返回数据格式错误');
        }

        wxQrImg.src = json.data.qrcode;
        wxQrUuid = json.data.uuid;

        wxQrLoading.style.display = 'none';
        wxQrImg.style.display = 'block';
        wxQrStatus.textContent = '请使用微信扫码登录';
        wxQrStatus.style.color = '#aaa';

        isWxQRPollingActive = true;
        wxQrTimer = setInterval(checkWxQR, 4000);
    } catch (e) {
        console.error('微信二维码获取失败：', e);
        wxQrLoading.style.display = 'none';
        wxQrStatus.textContent = `获取失败：${e.message}，点击重试`;
        wxQrStatus.style.color = '#ef4444';
        wxQrOverlay.style.display = 'flex';
    }
}

// 检查微信登录状态
async function checkWxQR() {
    if (!isWxQRPollingActive || !wxQrUuid || wxQrPollingInFlight) return;
    wxQrPollingInFlight = true;

    try {
        const res = await fetch(`${API_BASE}/api/auth/wx-check?uuid=${wxQrUuid}`);
        if (!res.ok) throw new Error('登录状态校验失败');
        
        const json = await res.json();
        if (json.status === 0) {
            // 微信登录成功
            clearInterval(wxQrTimer);
            isWxQRPollingActive = false;
            localStorage.setItem('nzm_cookie', json.data.cookie);
            loadStats();
        } else if (json.status === 408) {
            const wxQrStatus = document.getElementById('wx-qr-status');
            wxQrStatus.textContent = '请使用微信扫码登录';
        } else if (json.status === 404) {
            const wxQrStatus = document.getElementById('wx-qr-status');
            wxQrStatus.textContent = '已扫码，请在手机上确认登录';
        } else if (json.status === 402 || json.message.includes('失效')) {
            clearInterval(wxQrTimer);
            isWxQRPollingActive = false;
            const wxQrStatus = document.getElementById('wx-qr-status');
            wxQrStatus.textContent = '二维码已失效，点击重试';
            document.getElementById('wx-qr-overlay').style.display = 'flex';
        }
    } catch (e) {
        console.error('微信登录状态校验失败：', e);
    } finally {
        wxQrPollingInFlight = false;
    }
}

// 绑定所有事件
function bindEvents() {
    // QQ登录按钮
    dom.qqBtn.addEventListener('click', () => {
        switchLoginMethod('qq');
    });

    // 微信登录按钮（核心修复：补全绑定）
    dom.wechatBtn.addEventListener('click', () => {
        switchLoginMethod('wechat');
    });

    // QQ重试层
    dom.qrOverlay.addEventListener('click', startQRLogin);

    // 微信重试层
    document.getElementById('wx-qr-overlay').addEventListener('click', startWxQRLogin);

    // 页面可见性监听
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // 页面隐藏时停止轮询
            if (qrTimer) { clearInterval(qrTimer); }
            if (wxQrTimer) { clearInterval(wxQrTimer); }
        } else {
            // 页面显示时恢复轮询
            if (isQRPollingActive) {
                qrTimer = setInterval(checkQR, 3000);
            }
            if (isWxQRPollingActive) {
                wxQrTimer = setInterval(checkWxQR, 4000);
            }
        }
    });
}

// 加载游戏数据（示例：根据实际逻辑修改）
async function loadStats() {
    try {
        const cookie = localStorage.getItem('nzm_cookie');
        if (!cookie) {
            showCookieExpiredModal();
            return;
        }

        const res = await fetch(`${API_BASE}/api/stats`, {
            headers: {
                'X-NZM-Cookie': cookie
            }
        });

        if (!res.ok) throw new Error('数据加载失败');
        const data = await res.json();
        // 渲染数据到页面（根据你的UI逻辑补充）
        console.log('数据加载成功：', data);
    } catch (e) {
        console.error('数据加载失败：', e);
        showCookieExpiredModal();
    }
}

// 显示cookie过期提示
function showCookieExpiredModal() {
    alert('登录凭证已过期，请重新登录');
    // 重置登录界面
    switchLoginMethod('qq');
}

// 初始化入口
async function init() {
    initDOM(); // 初始化DOM元素
    const cookie = localStorage.getItem('nzm_cookie');
    if (cookie) {
        // 有cookie直接加载数据
        await loadStats();
    } else {
        // 无cookie默认显示QQ登录
        switchLoginMethod('qq');
    }
    bindEvents(); // 绑定所有事件
}

// DOM加载完成后执行初始化
document.addEventListener('DOMContentLoaded', async () => {
    await init();
});
