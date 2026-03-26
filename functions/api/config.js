export async function onRequest(context) {
  const { env } = context;
  return new Response(JSON.stringify({
    GEMINI_MODEL: env.GEMINI_MODEL
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
