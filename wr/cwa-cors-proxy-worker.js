// ============================================================
// CWA + Groq 代理伺服器（Cloudflare Worker）
//
// 用途：
// 1. 中央氣象署「鄉鎮天氣預報」等 API 官方沒有開放瀏覽器端直接呼叫
//    （CORS 政策不允許），這支 Worker 幫忙轉發請求，並在回應上補上
//    瀏覽器需要的 CORS header。
// 2. 同一支 Worker 也可以代為轉發 Groq API（用於 AI 文字潤飾功能），
//    順便代管 Groq 金鑰，前端不用填。
//
// 路由規則（用網址路徑判斷要轉發去哪裡）：
//   /groq/xxx   → 轉發到 https://api.groq.com/xxx （POST，金鑰放在 Header）
//   其他路徑     → 轉發到 https://opendata.cwa.gov.tw/xxx （GET，金鑰放在網址參數）
//
// 【金鑰代管功能】
// 在 Cloudflare 後台幫這支 Worker 設定 Secret（環境變數）：
//   CWA_API_KEY  → CWA 請求沒帶金鑰時自動補上（網址參數 Authorization）
//   GROQ_API_KEY → Groq 請求沒帶金鑰時自動補上（Header Authorization: Bearer ...）
// 前端有自己帶金鑰的話，一律以前端帶的為準，Worker 不會覆蓋。
// 設定方式：Cloudflare 後台 → 這支 Worker → Settings → Variables and
// Secrets → Add → Type 選 Secret → Name 填上面兩個名稱之一 → Value 貼
// 金鑰 → Deploy。
//
// 使用方式（部署完成、拿到網址後）：
//   把「雲海預測儀_CWA版.html」裡的「代理伺服器網址」欄位填入你部署好
//   的網址，例如 https://cwa-proxy.你的帳號.workers.dev（結尾不要加
//   斜線），CWA 與 Groq 兩項功能會共用同一個網址。
// ============================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 瀏覽器發送正式請求前，有時會先送 OPTIONS 預檢請求，直接回覆允許即可
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      // --- Groq 轉發：路徑開頭是 /groq/，例如 /groq/openai/v1/chat/completions ---
      if (url.pathname.startsWith('/groq/')) {
        const targetPath = url.pathname.slice('/groq'.length);
        const targetUrl = 'https://api.groq.com' + targetPath + url.search;

        const headers = new Headers(request.headers);
        headers.delete('host');
        const hasAuth = headers.get('Authorization') && headers.get('Authorization').trim() !== '';
        if (!hasAuth && env.GROQ_API_KEY) {
          headers.set('Authorization', `Bearer ${env.GROQ_API_KEY}`);
        }

        const upstreamRes = await fetch(targetUrl, {
          method: request.method,
          headers,
          body: (request.method === 'GET' || request.method === 'HEAD') ? undefined : await request.text(),
        });
        const body = await upstreamRes.text();
        return new Response(body, {
          status: upstreamRes.status,
          headers: {
            'Content-Type': upstreamRes.headers.get('Content-Type') || 'application/json; charset=utf-8',
            ...corsHeaders(),
          },
        });
      }

      // --- CWA 轉發（原本的行為）---
      const existingAuth = url.searchParams.get('Authorization');
      if ((!existingAuth || existingAuth.trim() === '') && env.CWA_API_KEY) {
        url.searchParams.set('Authorization', env.CWA_API_KEY);
      }
      const targetUrl = 'https://opendata.cwa.gov.tw' + url.pathname + url.search;
      const upstreamRes = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      const body = await upstreamRes.text();
      return new Response(body, {
        status: upstreamRes.status,
        headers: {
          'Content-Type': upstreamRes.headers.get('Content-Type') || 'application/json; charset=utf-8',
          ...corsHeaders(),
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ success: 'false', message: '代理伺服器轉發失敗：' + err.message }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders() } }
      );
    }
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };
}
