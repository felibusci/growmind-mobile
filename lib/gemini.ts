// Gemini de texto, capa gratis. Con fallback de modelos y reintentos cortos,
// porque el modelo principal a veces devuelve 503 por demanda.

const MODELOS = [
  process.env.GEMINI_MODEL,
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash",
].filter(Boolean) as string[];

export interface RespuestaGemini {
  texto: string;
  modelo: string;
}

export async function generar(system: string, user: string, opts?: { json?: boolean; maxTokens?: number; temperatura?: number }): Promise<RespuestaGemini> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");
  let ultimo = "";
  const t0 = Date.now();
  for (const modelo of MODELOS) {
    for (let intento = 0; intento < 2; intento++) {
      if (Date.now() - t0 > 45000) throw new Error("Gemini tardó demasiado: " + ultimo);
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            temperature: opts?.temperatura ?? 0.7,
            maxOutputTokens: opts?.maxTokens ?? 2048,
            ...(opts?.json ? { responseMimeType: "application/json" } : {}),
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const texto: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
        if (texto.trim()) return { texto, modelo };
        ultimo = `${modelo}: respuesta vacía`;
      } else {
        const txt = await res.text();
        ultimo = `${modelo} ${res.status}: ${txt.slice(0, 200)}`;
        if (res.status === 404 || res.status === 400) break; // ese modelo no, probá el siguiente
        if (res.status === 429 || res.status >= 500) {
          await new Promise((r) => setTimeout(r, 1500 * (intento + 1)));
          continue;
        }
        break;
      }
    }
  }
  throw new Error("Ningún modelo respondió. " + ultimo);
}
