// 114514

import { getPtqrToken } from './utils.js';

export async function handleAuthQR(request) {
    // 1. Fetch QR Image. Using QQ Space login for game data access
    const qrUrl = 'https://ssl.ptlogin2.qq.com/ptqrshow?appid=549000912&e=2&l=M&s=3&d=72&v=4&t=0.5' + Date.now() + '&daid=5&pt_3rd_aid=0';
    const resp = await fetch(qrUrl);

    // 2. Get qrsig from headers
    const setCookie = resp.headers.get('set-cookie') || '';
    let qrsig = '';
    const match = setCookie.match(/qrsig=([^;,]+)/);
    if (match) qrsig = match[1];

    // 3. Convert image to base64
    const arrayBuffer = await resp.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const dataUrl = `data:image/png;base64,${base64}`;

    return new Response(JSON.stringify({
        success: true,
        data: { qrcode: dataUrl, qrsig: qrsig }
    }), { headers: { 'Content-Type': 'application/json' } });
}

export async function handleAuthCheck(request) {
    const url = new URL(request.url);
    const qrsig = url.searchParams.get('qrsig');

    if (!qrsig) return new Response(JSON.stringify({ msg: 'missing qrsig' }));

    const ptqrtoken = getPtqrToken(qrsig);
    const checkUrl = `https://ssl.ptlogin2.qq.com/ptqrlogin?u1=https%3A%2F%2Fqzone.qq.com%2F&ptqrtoken=${ptqrtoken}&ptredirect=0&h=1&t=1&g=1&from_ui=1&ptlang=2052&action=0-0-${Date.now()}&js_ver=21020514&js_type=1&login_sig=&pt_uistyle=40&aid=549000912&daid=5&`;

    const resp = await fetch(checkUrl, {
        headers: { 'Cookie': `qrsig=${qrsig}` }
    });
    const text = await resp.text();

    // Status codes: 
    // 0 = Success
    // 66 = Scanning (Not scanned yet)
    // 67 = Confirming (Scanned, waiting for click)
    // 65 = Expired

    if (text.includes("ptuiCB('0'")) {
        const extraction = /ptuiCB\('0','0','(.*?)','0','(.*?)', '(.*?)'\)/.exec(text);
        const nickname = extraction ? extraction[3] : 'User';
        const rawSetCookie = resp.headers.get('set-cookie') || '';

        // Manual extraction because we need specific keys
        // OAuth2.0 login returns: superuin, superkey, supertoken
        // NZM API needs: uin, skey
        let uin = '', skey = '';

        // Try standard uin/skey first
        const uinMatch = rawSetCookie.match(/uin=([^;]+)/);
        if (uinMatch) uin = uinMatch[1];

        const skeyMatch = rawSetCookie.match(/skey=([^;]+)/);
        if (skeyMatch) skey = skeyMatch[1];

        // If not found, try OAuth2.0 format (superuin/superkey)
        if (!uin) {
            const superUinMatch = rawSetCookie.match(/superuin=([^;]+)/);
            if (superUinMatch) uin = superUinMatch[1];
        }

        if (!skey) {
            const superKeyMatch = rawSetCookie.match(/superkey=([^;]+)/);
            if (superKeyMatch) skey = superKeyMatch[1];
        }

        // Fallback: if still not found, send raw cookie
        const finalCookie = (uin && skey) ? `uin=${uin}; skey=${skey};` : rawSetCookie;

        return new Response(JSON.stringify({
            success: true,
            status: 0,
            message: '登录成功',
            data: {
                nickname,
                cookie: finalCookie
            }
        }));
    } else if (text.includes("ptuiCB('66'")) {
        return new Response(JSON.stringify({ success: true, status: 66, message: '请使用手机QQ扫码' }));
    } else if (text.includes("ptuiCB('67'")) {
        return new Response(JSON.stringify({ success: true, status: 67, message: '请在手机上确认登录' }));
    } else if (text.includes("ptuiCB('65'")) {
        return new Response(JSON.stringify({ success: true, status: 65, message: '二维码已过期' }));
    } else {
        return new Response(JSON.stringify({ success: false, status: -1, message: '状态异常', raw: text }));
    }
}

// --- WeChat QR Login ---
const WX_APPID = 'wxfa0c35392d06b82f';
const WX_REDIRECT_URI = 'https://iu.qq.com/comm-htdocs/login/milosdk/wx_pc_redirect.html';

export async function handleWxQR(request) {
    // Fetch the WeChat QR connect page to get the UUID
    const qrPageUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${WX_APPID}&redirect_uri=${encodeURIComponent(WX_REDIRECT_URI)}&response_type=code&scope=snsapi_login&state=1`;

    try {
        const resp = await fetch(qrPageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const html = await resp.text();

        // Extract UUID from the page - look for the QR code image src
        const uuidMatch = html.match(/\/connect\/qrcode\/([a-zA-Z0-9_-]+)/);
        if (!uuidMatch) {
            return new Response(JSON.stringify({ success: false, message: '获取微信二维码失败' }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const uuid = uuidMatch[1];
        const qrImgUrl = `https://open.weixin.qq.com/connect/qrcode/${uuid}`;

        // Fetch the QR image and convert to base64
        const imgResp = await fetch(qrImgUrl);
        const imgBuf = await imgResp.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuf)));
        const contentType = imgResp.headers.get('content-type') || 'image/jpeg';
        const dataUrl = `data:${contentType};base64,${base64}`;

        return new Response(JSON.stringify({
            success: true,
            data: { qrcode: dataUrl, uuid }
        }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function handleWxCheck(request) {
    const url = new URL(request.url);
    const uuid = url.searchParams.get('uuid');
    if (!uuid) return new Response(JSON.stringify({ success: false, message: 'missing uuid' }));

    try {
        // Poll WeChat's long-polling endpoint with a timeout
        // The endpoint holds connection for ~25s if no status change
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        let text;
        try {
            const checkUrl = `https://long.open.weixin.qq.com/connect/l/qrconnect?uuid=${uuid}&_=${Date.now()}`;
            const resp = await fetch(checkUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                signal: controller.signal
            });
            text = await resp.text();
        } catch (e) {
            clearTimeout(timeoutId);
            // Timeout or abort - return waiting status
            if (e.name === 'AbortError') {
                return new Response(JSON.stringify({ success: true, status: 408, message: '等待扫码' }));
            }
            throw e;
        }
        clearTimeout(timeoutId);

        // Parse response: window.wx_errcode=XXX;window.wx_code='YYY';
        const errMatch = text.match(/wx_errcode=(\d+)/);
        const codeMatch = text.match(/wx_code='([^']*)'/);

        const errcode = errMatch ? parseInt(errMatch[1]) : -1;
        const wxCode = codeMatch ? codeMatch[1] : '';

        if (errcode === 405 && wxCode) {
            // User confirmed - exchange code for tokens
            const result = await exchangeWxCode(wxCode);
            if (result.success) {
                const tokenData = result.data;
                const cookie = `acctype=wx; openid=${tokenData.openid}; appid=${WX_APPID}; access_token=${tokenData.access_token}; refresh_token=${tokenData.refresh_token}`;
                return new Response(JSON.stringify({
                    success: true, status: 0, message: '登录成功',
                    data: { cookie }
                }), { headers: { 'Content-Type': 'application/json' } });
            }
            return new Response(JSON.stringify({
                success: false, status: -1,
                message: result.error || 'Token交换失败'
            }), { headers: { 'Content-Type': 'application/json' } });
        } else if (errcode === 408) {
            return new Response(JSON.stringify({ success: true, status: 408, message: '等待扫码' }));
        } else if (errcode === 404) {
            return new Response(JSON.stringify({ success: true, status: 404, message: '已扫码，请确认' }));
        } else if (errcode === 402 || errcode === 403) {
            return new Response(JSON.stringify({ success: true, status: 402, message: '二维码已过期' }));
        } else {
            return new Response(JSON.stringify({ success: true, status: errcode, message: '未知状态' }));
        }
    } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }));
    }
}

async function exchangeWxCode(code) {
    // Call Tencent's public JSONP endpoint to exchange code for tokens
    // Parameters discovered from Milo SDK: sServiceType="undefined", wxcodedomain=host
    const params = new URLSearchParams({
        appid: WX_APPID,
        wxcode: code,
        acctype: 'wx',
        sServiceType: 'undefined',
        wxcodedomain: 'nzm.qq.com',
        callback: '_cb'
    });
    const url = `https://apps.game.qq.com/ams/ame/codeToOpenId.php?${params}`;
    try {
        const resp = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://nzm.qq.com/'
            }
        });
        const text = await resp.text();

        // Response is JSONP: _cb({iRet:0, sMsg:"{json_string}", ...})
        const jsonMatch = text.match(/_cb\((\{[\s\S]*\})\)/);
        if (!jsonMatch) {
            return { success: false, error: `JSONP解析失败: ${text.substring(0, 200)}` };
        }
        const result = JSON.parse(jsonMatch[1]);
        if (parseInt(result.iRet) === 0 && result.sMsg) {
            // sMsg contains a JSON string with the actual token data
            const data = JSON.parse(result.sMsg);
            return { success: true, data: data };
        }
        return { success: false, error: `接口返回: iRet=${result.iRet}, sMsg=${result.sMsg || ''}, sErrMsg=${result.sErrMsg || ''}` };
    } catch (e) {
        return { success: false, error: `请求异常: ${e.message}` };
    }
}
