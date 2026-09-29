import { NextRequest, NextResponse } from "next/server";
import { calcular, palancasAplicables, usd, ars, pct } from "@/lib/modelo";
import { queryAFecha } from "@/lib/url";
import { generar } from "@/lib/gemini";

// POST /api/cerrar  body: { query: string }  (la fecha codificada como en la URL)
// Devuelve { ok, plan: { diagnostico, pasos[], mails: { lugar, rental, sponsor } }, modelo }

const SYSTEM = `Sos un productor de fiestas electrónicas en Argentina con veinte años de fechas encima, que habla de números sin vueltas. Escribís en español rioplatense, voseo, directo, sin adjetivos de relleno, sin emojis, sin signos de apertura "¿" ni "¡", sin guiones largos "—", sin punto y coma. Frases cortas. Nada de "estimado", "espero que estés bien", "quedo a disposición", "propongo", "sugiero". Cerrás con un pedido concreto.

Te pasan la hoja de una fecha ya calculada. No recalculás nada, no inventás precios: usás los números que te dan. Tu laburo es decir cómo se cierra esa fecha en el orden en que lo cierran los que cierran: primero quién paga el cartel (sponsor, ente de turismo, universidad, destino), después los canjes (rental por crédito en el video, lugar por una jornada abierta o por la barra), después la categorización ante SADAIC (espectáculo, no baile, pedida por escrito antes), y recién al final tocar precio o capacidad. Preventa que financie las señas. Nunca bancar un faltante entre socios: si el número no cierra en la hoja, la fecha se mueve.

Los mails de apertura no explican el modelo ni tiran un precio en frío: se presentan con dos o tres datos duros, dicen qué se quiere hacer y dónde, y piden una reunión con día. Entre 70 y 120 palabras cada uno. Sin asunto. Firma "[tu nombre]". Nunca inventes el nombre del destinatario: abrí con "Hola [nombre]" o "Buenas".

Devolvé SOLO JSON válido con esta forma:
{
  "diagnostico": "2 o 3 oraciones: qué pasa con esta fecha y cuál es el rubro que la mata",
  "pasos": ["5 pasos concretos, cada uno con el número que cambia, en orden"],
  "mails": {
    "lugar": "mail de apertura al lugar (institución si es público, dueño si es privado)",
    "rental": "mail al rental de sonido y luces proponiendo el canje",
    "sponsor": "mail a una marca o ente de turismo para que cubra el cachet"
  }
}`;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { query?: string };
    const f = queryAFecha(new URLSearchParams(body.query ?? ""));
    const r = calcular(f);
    const palancas = palancasAplicables(f).slice(0, 4);

    const hoja = {
      entradas: r.entradas,
      capacidad: f.capacidad,
      precioEntrada: ars(f.precio),
      lugar: f.lugar,
      artistaInternacional: f.internacionalUSD > 0 ? usd(f.internacionalUSD) : "no hay",
      artistasNacionales: usd(f.nacionalUSD),
      terceroCubreCachet: f.terceroCubre ? usd(f.aporteTerceroUSD) : "no",
      brutoTicketera: usd(r.brutoUSD),
      cargaSobreBruto: pct(r.cargaSobreBrutoPct) + " (ticketing " + pct(f.ticketingPct) + ", SADAIC " + pct(f.sadaicPct) + ", AADI-CAPIF " + pct(f.aadiPct) + ")",
      categoriaSADAIC: f.categoria,
      netoTickets: usd(r.netoTicketsUSD),
      barra: f.barraPropia ? usd(r.barraUSD) : "no es del productor",
      ingresos: usd(r.ingresosUSD),
      costos: r.lineas.map((l) => `${l.nombre}: ${usd(l.usd)}${l.nota ? " (" + l.nota + ")" : ""}`),
      produccionEImprevistos: usd(r.produccionUSD),
      costoTotal: usd(r.costoUSD),
      resultado: usd(r.resultadoUSD),
      veredicto: r.veredicto,
      rubroMasGrande: r.peor ? `${r.peor.nombre} ${usd(r.peor.usd)}` : "",
      puntoDeEquilibrio: r.equilibrioEntradas ? `${r.equilibrioEntradas} entradas` : "no se alcanza con este precio",
      precioMinimoParaCerrar: r.precioMinimoARS ? ars(r.precioMinimoARS) : "no aplica",
      palancasQueMasCambian: palancas.map((p) => `${p.palanca.nombre}: pasa a ${usd(p.resultado.resultadoUSD)} (${p.delta >= 0 ? "+" : ""}${usd(p.delta)})`),
    };

    const { texto, modelo } = await generar(SYSTEM, "HOJA DE LA FECHA:\n" + JSON.stringify(hoja, null, 2) + "\n\nDecime cómo se cierra y devolvé el JSON.", {
      json: true,
      maxTokens: 3000,
      temperatura: 0.6,
    });
    const limpio = texto.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "").trim();
    let plan: { diagnostico: string; pasos: string[]; mails: { lugar: string; rental: string; sponsor: string } };
    try {
      plan = JSON.parse(limpio);
    } catch {
      return NextResponse.json({ ok: false, error: "El modelo no devolvió JSON válido. Probá de nuevo." }, { status: 502 });
    }
    const limpiar = (s: string) => (s || "").replace(/\s*—\s*/g, ", ").replace(/–/g, ",").replace(/[¿¡]/g, "").replace(/;/g, ",");
    plan.diagnostico = limpiar(plan.diagnostico);
    plan.pasos = (plan.pasos || []).map(limpiar);
    plan.mails = { lugar: limpiar(plan.mails?.lugar), rental: limpiar(plan.mails?.rental), sponsor: limpiar(plan.mails?.sponsor) };
    return NextResponse.json({ ok: true, plan, modelo });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
