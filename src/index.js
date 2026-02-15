import { handleAuthQR, handleAuthCheck, handleWxQR, handleWxCheck } from './auth.js';
import { handleStats, handleDetail } from './stats.js';
import { handleCollection } from './collection.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        // CORS
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, X-NZM-Cookie',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
                }
            });
        }

        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, X-NZM-Cookie',
        };

        try {
            let response;
            if (path.startsWith('/api/auth/wx-qr')) {
                response = await handleWxQR(request);
            } else if (path.startsWith('/api/auth/wx-check')) {
                response = await handleWxCheck(request);
            } else if (path.startsWith('/api/auth/qr')) {
                response = await handleAuthQR(request);
            } else if (path.startsWith('/api/auth/check')) {
                response = await handleAuthCheck(request);
            } else if (path.startsWith('/api/stats')) {
                response = await handleStats(request);
            } else if (path.startsWith('/api/detail')) {
                response = await handleDetail(request);
            } else if (path.startsWith('/api/collection')) {
                response = await handleCollection(request);
            } else {
                // If not an API call, try to serve static assets
                // In Cloudflare Workers with 'assets' config, this is handled automatically if we return 404 or pass through?
                // Actually with `assets` binding, we normally use `env.ASSETS.fetch(request)`
                if (env.ASSETS) {
                    return await env.ASSETS.fetch(request);
                }
                return new Response('Not Found', { status: 404 });
            }

            // Append CORS headers to the response
            const newHeaders = new Headers(response.headers);
            for (const [k, v] of Object.entries(corsHeaders)) {
                newHeaders.set(k, v);
            }

            return new Response(response.body, {
                status: response.status,
                headers: newHeaders
            });

        } catch (e) {
            return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
    }
};
