export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const response = await next();

  // 仅在请求根路径或 index.html 时注入脚本
  if (response.status === 200 && (path === "/" || path === "/index.html")) {
    const contentType = response.headers.get("Content-Type");
    if (contentType && contentType.includes("text/html")) {
      let html = await response.text();
      const injectedScript = `<script>window.ENV_CONFIG = { GEMINI_MODEL: "${env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview'}" };</script>`;
      return new Response(html.replace('</head>', `${injectedScript}</head>`), {
        headers: response.headers
      });
    }
  }

  return response;
}
