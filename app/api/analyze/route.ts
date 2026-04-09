import { NextRequest, NextResponse } from "next/server";

// POST /api/analyze
// Body: {
//   imageBase64: string,        // raw base64, no data: prefix
//   mimeType: string,           // e.g. "image/jpeg"
//   plantContext?: {            // optional context to improve diagnosis
//     genetics?: string;
//     phase?: string;
//     dayOfCycle?: number;
//     lastFeeding?: {
//       npk?: string;
//       phIn?: number;
//       ecIn?: number;
//       phRunoff?: number;
//       ecRunoff?: number;
//       hoursAgo?: number;
//     };
//     previousScore?: number;
//   }
// }
//
// Response shape mirrors AnalysisResult on the client + adds Gemini fields:
// {
//   ok: true,
//   source: "gemini",
//   healthScore: number,
//   diagnosis: string,
//   recommendations: string[],
//   confidence: "baja" | "moderada" | "alta",
//   detected: {
//     deficiencies: string[],   // e.g. ["nitrógeno", "magnesio"]
//     pests: string[],
//     diseases: string[],
//     stages: string[],         // e.g. ["pre-floración"]
//   },
//   nutrientStatus: {
//     nitrogen: "bajo" | "ok" | "alto" | "desconocido";
//     phosphorus: "bajo" | "ok" | "alto" | "desconocido";
//     potassium: "bajo" | "ok" | "alto" | "desconocido";
//     calcium: "bajo" | "ok" | "alto" | "desconocido";
//     magnesium: "bajo" | "ok" | "alto" | "desconocido";
//   },
//   raw: string  // raw model output for debugging
// }

const GEMINI_MODEL = "gemini-2.0-flash-exp";

const SYSTEM_PROMPT = `Sos un agrónomo experto en cultivo de cannabis medicinal indoor. Analizás una foto de una planta y devolvés un diagnóstico técnico, honesto y accionable EN ESPAÑOL.

Tenés que devolver SOLO un objeto JSON válido (sin markdown, sin \`\`\`json, sin texto extra), con esta estructura exacta:

{
  "healthScore": <0-100>,
  "diagnosis": "<2-4 oraciones en español, técnico pero claro>",
  "recommendations": ["<acción 1>", "<acción 2>", "<acción 3>"],
  "confidence": "<baja|moderada|alta>",
  "detected": {
    "deficiencies": ["<lista de deficiencias visibles, ej: nitrógeno, magnesio, calcio, hierro>"],
    "pests": ["<plagas visibles, ej: arañuela, trips, mosca blanca>"],
    "diseases": ["<enfermedades, ej: oídio, botritis, fusarium>"],
    "stages": ["<etapa observada, ej: vegetativo tardío, pre-floración, floración temprana>"]
  },
  "nutrientStatus": {
    "nitrogen": "bajo|ok|alto|desconocido",
    "phosphorus": "bajo|ok|alto|desconocido",
    "potassium": "bajo|ok|alto|desconocido",
    "calcium": "bajo|ok|alto|desconocido",
    "magnesium": "bajo|ok|alto|desconocido"
  }
}

Reglas:
- Sé honesto: si la foto es de mala calidad, está fuera de foco, o no se ven hojas claras, bajá la confianza a "baja" y decilo en el diagnóstico.
- healthScore: 90-100 = excelente, 70-89 = bueno, 50-69 = aceptable con estrés leve, 30-49 = problemas moderados, 0-29 = crítico.
- Si no podés determinar un nutriente con certeza, usá "desconocido".
- Las recomendaciones tienen que ser CONCRETAS (con números cuando se pueda: pH objetivo, EC, días, ml/L).
- No inventes deficiencias si no las ves. Lista vacía es válida.
- Si te pasan contexto de feeding previo, usalo para correlacionar (ej: si dieron mucho N y ves quemado de puntas, mencionalo).
- NO uses markdown. SOLO JSON puro.`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "GEMINI_API_KEY no configurada. Conseguí una gratis en https://aistudio.google.com/app/apikey y agregala como variable de entorno en Vercel.",
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { imageBase64, mimeType, plantContext } = body as {
      imageBase64: string;
      mimeType: string;
      plantContext?: Record<string, unknown>;
    };

    if (!imageBase64 || !mimeType) {
      return NextResponse.json(
        { ok: false, error: "Faltan imageBase64 o mimeType" },
        { status: 400 }
      );
    }

    const contextText = plantContext
      ? `\n\nContexto de la planta (usalo para mejorar el diagnóstico):\n${JSON.stringify(
          plantContext,
          null,
          2
        )}`
      : "";

    const userPrompt = `Analizá esta foto de planta de cannabis y devolvé el JSON pedido.${contextText}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const geminiBody = {
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [
            { text: userPrompt },
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
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
        { ok: false, error: `Gemini API error ${r.status}: ${errText}` },
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
      // Try to extract JSON if model wrapped it in markdown despite instructions
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = null;
        }
      }
    }

    if (!parsed) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo parsear la respuesta de Gemini",
          raw: text,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      source: "gemini",
      ...parsed,
      raw: text,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
