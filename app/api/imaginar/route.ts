import { NextRequest, NextResponse } from "next/server";
import { VOZ_FELIPE } from "@/lib/voz";
import type { ConceptoIA, Lugar, ParamsPresupuesto, ResultadoPresupuesto } from "@/lib/tipos";
import { PARAMS_DEFAULT } from "@/lib/lugares";
import { calcularPresupuesto } from "@/lib/presupuesto";

// POST /api/imaginar
// Body: { lugar: Lugar, params: ParamsPresupuesto, resultado: ResultadoPresupuesto, fecha?: string }
// Devuelve { ok: true, concepto: ConceptoIA } o { ok: false, error }

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const SYSTEM_PROMPT = `Sos el chief of staff de On Air Music (OAM), la productora de Felipe Busciglio. OAM hace sets de DJs filmados en locaciones que no se repiten: un Boeing 737, la Iglesia de los Capuchinos en Córdoba, un cultivo en La Rioja, el ECU de la Universidad Nacional de Rosario. Canal @onairmusicarg con 838 mil views. El modelo: sessions de 600 a 1.000 personas donde el que tiene el lugar pone el lugar, OAM pone el formato y el video, y un tercero (sponsor, ente de turismo, universidad, destino) paga el cachet internacional. Cada session produce tres cosas: el evento, el video largo con el lugar en el título, y cuando se puede un track original inspirado en el lugar. Con institución pública el formato es de dos días: día uno Forum de industria abierto y gratuito (lo que la institución se lleva), día dos la fiesta.

Te dan un lugar (a veces solo un nombre y coordenadas) y los números ya calculados. Vos imaginás la session completa. Sos concreto, local y específico. Nada de adjetivos vacíos. Si no sabés algo del lugar, decilo como hipótesis ("probablemente decide...") y no lo inventes como dato.

Criterio de Felipe: no evalúa el QUÉ, evalúa el QUIÉN decide, CUÁNDO y bajo qué rótulo. Un lugar sin quién decide, sin antecedente y sin cómo se pide, rebota. Un mail de apertura que explica el modelo o tira un precio en frío, rebota. Contenido genérico (flyer, line-up, "vení"), rebota. Tiene que verse que On Air está ahí.

${VOZ_FELIPE}

REGLAS PARA LOS PROMPTS DE IA (teaser que pase por footage real, no por test de IA):
- Escribí los prompts en inglés. Fórmula de cuatro bloques en este orden: (1) "REAL LIVE-ACTION PHOTOGRAPH, not CGI, not a render." (2) Sujeto: qué pasa y quién, el DJ de espaldas o en silueta, nunca una cara nítida. (3) Lugar: rasgos concretos del lugar, "matching the reference photo of the location". (4) Cámara: cuerpo + focal + diafragma + soporte + luz disponible + tres o cuatro imperfecciones concretas (film grain, chromatic aberration, veiling glare, imperfect framing, focus hunts and settles, motion blur at 1/48 shutter, heavy grain from a pushed ISO).
- Nombrá equipo concreto: ARRI Alexa Mini LF, Sony FX3, 35mm T2.8, 21mm T2.8, 75mm T2.0. Luz: available light only, practical light, one strobe from behind, dense haze, the beam visible through the smoke.
- Prohibido: cinematic, epic, majestic, stunning, hyperrealistic, 8K, octane, unreal engine, masterpiece, perfect, flawless, dramatic lighting.
- El prompt de video describe movimiento y cámara, incluido lo que hace el operador ("the handheld operator bumps and reframes to keep him"). En planos de calma pedí que casi no pase nada. Cerrá con "Documentary realism, no CGI."

Devolvé SOLO un JSON válido con esta forma exacta, todo en español salvo los dos prompts:
{
  "titulo": "nombre corto de la session, con el lugar adentro",
  "tituloVideo": "el título del video de YouTube tal como se publicaría, con el lugar",
  "porQueElLugar": "2 o 3 oraciones, por qué este lugar es una session On Air y no una fiesta más",
  "tension": "la tensión cultural de la que parte, una oración",
  "formato": "un día o dos días, con qué pasa cada día y horario de sunset o noche",
  "planoApertura": "el primer plano del video, descrito como se filma",
  "artista": "tier y perfil, ej: internacional del tier Angiuli/Colyn/Budakid más un nacional, o dos nacionales de peso",
  "perfilArtista": "qué sonido pide el lugar y por qué, sin inventar nombres de artistas que no existan",
  "quienDecide": "hipótesis concreta de quién decide sobre este lugar (cargo, organismo, dueño) y bajo qué rótulo se le pide",
  "comoSePide": "el camino: qué se pide, a cambio de qué, qué aval escrito hace falta antes de anunciar",
  "riesgos": ["3 a 5 riesgos concretos: permisos, energía, acceso, clima, ruido, fecha que pisa otra cosa"],
  "trackDelLugar": "idea del track original inspirado en el lugar, qué se graba ahí (sonido del lugar) y qué productor tipo",
  "mailApertura": "el mail de apertura escrito en la voz de Felipe siguiendo todas las reglas, sin asunto, firma Felipe. Nunca inventes el nombre del destinatario: abrí con [nombre] querido, o con buenas si no hay nombre",
  "promptPlaca": "prompt de imagen en inglés con la fórmula de cuatro bloques",
  "promptVideo": "prompt de video en inglés, movimiento y cámara"
}`;

// GET /api/imaginar
// Sin parametros: chequeo de salud, confirma que la key esta cargada y que el modelo responde.
// Con ?lugar=Nombre&ciudad=...&provincia=...&tipo=publico|privado&categoria=...: imagina una
// session con los parametros por defecto (sirve de demo y para probar la voz del mail).
export async function GET(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: "GEMINI_API_KEY no configurada" }, { status: 500 });
  const q = req.nextUrl.searchParams;
  const nombre = q.get("lugar");
  if (nombre) {
    const tipo = q.get("tipo") === "privado" ? "privado" : "publico";
    const lugar: Lugar = {
      id: "demo",
      nombre,
      ciudad: q.get("ciudad") ?? "",
      provincia: q.get("provincia") ?? "",
      pais: q.get("pais") ?? "Argentina",
      lat: Number(q.get("lat") ?? 0),
      lng: Number(q.get("lng") ?? 0),
      ubicacionConfirmada: false,
      categoria: q.get("categoria") ?? "otro",
      tipo,
      estado: "imaginada",
      creadoEn: new Date().toISOString(),
    };
    const params: ParamsPresupuesto = { ...PARAMS_DEFAULT, tipoLugar: tipo, barraPropia: tipo === "publico" };
    return imaginar(apiKey, lugar, params, calcularPresupuesto(params), q.get("fecha") ?? undefined);
  }
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Respondé solo con la palabra: listo" }] }],
        generationConfig: { maxOutputTokens: 5, temperature: 0 },
      }),
    });
    const data = await res.json();
    const texto: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!res.ok) return NextResponse.json({ ok: false, model: GEMINI_MODEL, status: res.status, error: data?.error?.message ?? "sin detalle" }, { status: 502 });
    return NextResponse.json({ ok: true, model: GEMINI_MODEL, respuesta: texto.trim() });
  } catch (e) {
    return NextResponse.json({ ok: false, model: GEMINI_MODEL, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "GEMINI_API_KEY no configurada. Conseguí una gratis en https://aistudio.google.com/app/apikey y agregala como variable de entorno en Vercel o en .env.local",
        },
        { status: 500 }
      );
    }

    const body = (await req.json()) as {
      lugar: Lugar;
      params: ParamsPresupuesto;
      resultado: ResultadoPresupuesto;
      fecha?: string;
    };
    if (!body?.lugar?.nombre) {
      return NextResponse.json({ ok: false, error: "Falta el lugar" }, { status: 400 });
    }

    const { lugar, params, resultado, fecha } = body;
    return imaginar(apiKey, lugar, params, resultado, fecha);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

async function imaginar(apiKey: string, lugar: Lugar, params: ParamsPresupuesto, resultado: ResultadoPresupuesto, fecha?: string) {
  try {
    const numeros = {
      entradas: resultado.entradas,
      precioEntradaARS: params.precioEntrada,
      brutoUSD: Math.round(resultado.brutoUSD),
      netoTrasTicketingYDerechosUSD: Math.round(resultado.netoUSD),
      barraEstimadaUSD: Math.round(resultado.barraUSD),
      costoTotalUSD: `${resultado.costoTotalMin} a ${resultado.costoTotalMax}`,
      resultadoUSD: `${Math.round(resultado.resultadoMin)} a ${Math.round(resultado.resultadoMax)}`,
      veredicto: resultado.veredicto,
      internacional: params.internacional,
      cachetCubiertoPorTercero: params.cachetCubierto,
      rentalEnCanje: params.rentalCanje,
      tipoLugar: params.tipoLugar,
    };

    const userPrompt = `LUGAR:
${JSON.stringify(
  {
    nombre: lugar.nombre,
    ciudad: lugar.ciudad,
    provincia: lugar.provincia,
    pais: lugar.pais,
    categoria: lugar.categoria,
    tipo: lugar.tipo,
    estado: lugar.estado,
    coordenadas: `${lugar.lat.toFixed(4)}, ${lugar.lng.toFixed(4)}`,
    notas: lugar.notas || "",
  },
  null,
  2
)}

FECHA TENTATIVA: ${fecha || "sin definir, proponé una ventana"}

NÚMEROS YA CALCULADOS (no los cambies, usalos para decidir formato y artista):
${JSON.stringify(numeros, null, 2)}

Imaginá la session y devolvé el JSON pedido.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const geminiBody = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json(
        { ok: false, error: `Gemini respondió ${res.status}: ${txt.slice(0, 400)}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const raw: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    const limpio = raw.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "").trim();

    let concepto: ConceptoIA;
    try {
      concepto = JSON.parse(limpio) as ConceptoIA;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Gemini no devolvió JSON válido", raw: raw.slice(0, 800) },
        { status: 502 }
      );
    }

    if (!Array.isArray(concepto.riesgos)) concepto.riesgos = [];
    // Guardas de voz: si se le escapó una raya o un signo de apertura, se corrige acá.
    concepto.mailApertura = (concepto.mailApertura || "")
      .replace(/\s*—\s*/g, ", ")
      .replace(/–/g, ",")
      .replace(/¿/g, "")
      .replace(/;/g, ",");

    return NextResponse.json({ ok: true, concepto, model: GEMINI_MODEL });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
