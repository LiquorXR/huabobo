export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { model, contents, systemInstruction } = body;
    const key = env.GEMINI_API_KEY;

    if (!key) {
      return new Response(JSON.stringify({ error: { message: "GEMINI_API_KEY is not configured" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const apiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction,
        generationConfig: {
          maxOutputTokens: 100,
          temperature: 0.7
        }
      })
    });

    const data = await apiResponse.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
      status: apiResponse.status
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: { message: e.message } }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
