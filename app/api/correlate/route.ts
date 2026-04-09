import { NextRequest, NextResponse } from "next/server";

// POST /api/correlate
// Body: {
//   plantContext: { name, genetics, phase, dayOfCycle },
//   feedings: [{ timestamp, npk, phIn, ecIn, phRunoff, ecRunoff, volumeMl, notes }],
//   photos:   [{ timestamp, healthScore, diagnosis, detected }]
// }
// Output: a Spanish narrative + structured insights about how the plant
// is reacting to feedings, plus a forecast for the next 3-7 days.

const GEMINI_MODEL = "gemini-2.0-flash-exp";

const SYSTEM_PROMPT = `Sos un agrónomo experto en cannabis medicinal. Te paso el historial de feedings y diagnósticos visuales de una planta. Tu trabajo es:

1. Detectar patrones: ¿qué pasa con la salud después de cada feeding?
2. Detectar problemas crónicos: ¿hay drift de pH, EC subiendo, deficiencias persistentes?
3. Predecir qué va a pasar en los próximos 3-7 días si no se cambia nada.
4. Recomendar el próximo feeding con números concretos.

Devolvés SOLO JSON puro, sin markdown:

{
  "summary": "<2-3 oraciones de resumen general en español>",
  "trends": {
    "healthDirection": "subiendo|estable|bajando",
    "phDrift": "<descripción del comportamiento del pH, ej: pH del runoff bajando de 6.4 a 5.8 en 5 días>",
    "ecDrift": "<descripción del EC>",
    "recurringIssues": ["<problemas que se repiten>"]
  },
  "feedingResponse": [
    {
      "feedingDate": "<ISO date>",
      "responseObserved": "<qué se vio en las fotos siguientes>",
      "verdict": "positivo|neutro|negativo"
    }
  ],
  "forecast": {
    "next3Days": "<predicción concreta>",
    "next7Days": "<predicción concreta>",
    "risks": ["<riesgo 1>", "<riesgo 2>"]
  },
  "nextFeedingRecommendation": {
    "when": "<ej: en 24-48hs>",
    "what": "<ej: agua sola con CalMag 1ml/L, pH 6.3>",
    "why": "<razón en 1 oración>"
  }
}`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "GEMINI_API_KEY no configurada" },
        { status: 500 }
      );
    }

    const body = await req.json();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const geminiBody = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Datos de la planta:\n${JSON.stringify(body, null, 2)}\n\nDevolvé el JSON.`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
      },
    };

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (!r.ok) {
      const errText = await r.text();
      return NextResponse.json(
        { ok: false, error: `Gemini ${r.status}: ${errText}` },
        { status: 502 }
      );
    }

    const data = await r.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch {
          parsed = null;
        }
      }
    }

    if (!parsed) {
      return NextResponse.json(
        { ok: false, error: "No se pudo parsear", raw: text },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, ...parsed });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
