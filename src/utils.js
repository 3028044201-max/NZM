export function getPtqrToken(qrsig) {
    let e = 0;
    for (let i = 0; i < qrsig.length; ++i) {
        e += (e << 5) + qrsig.charCodeAt(i);
    }
    return 2147483647 & e;
}

export function parseCookies(cookieStr) {
    const list = {};
    if (!cookieStr) return list;
    cookieStr.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        const name = parts.shift().trim();
        const value = parts.join('='); // Handle value with =
        if (name && value) list[name] = decodeURIComponent(value);
    });
    return list;
}

export function getCookieValue(cookieStr, key) {
    const match = cookieStr.match(new RegExp(`(^| )${key}=([^;]+)`));
    return match ? match[2] : null;
}
