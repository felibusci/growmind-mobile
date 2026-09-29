import type { Escenario, Lugar, ResultadoPresupuesto, Session } from "./tipos";
import { usd } from "./presupuesto";

export const PREGUNTAS: Array<[keyof Session["test"], string]> = [
  ["dueno", "Quién es dueño de esto después del sí"],
  ["artefacto", "Qué objeto se puede abrir para verificar que existe"],
  ["fecha", "Qué día sale y contra qué compite"],
  ["aQuien", "A quién le llega y cuánto tarda en tener lo que necesita"],
  ["queCambia", "Qué cambia si esto pasa"],
  ["queQueda", "Qué queda después"],
];

export function fichaMarkdown(lugar: Lugar, s: Session, r: ResultadoPresupuesto, esc: Escenario[]): string {
  const c = s.concepto;
  const L: string[] = [];
  L.push(`# ${c?.titulo ?? lugar.nombre}`);
  L.push("");
  L.push(`Lugar: ${lugar.nombre}, ${lugar.ciudad}, ${lugar.provincia}, ${lugar.pais}`);
  L.push(`Tipo: ${lugar.tipo} · Categoría: ${lugar.categoria} · Estado: ${lugar.estado}`);
  L.push(`Pin: ${lugar.lat.toFixed(5)}, ${lugar.lng.toFixed(5)}${lugar.ubicacionConfirmada ? "" : " (a ojo, sin confirmar)"}`);
  if (lugar.notas) L.push(`Notas: ${lugar.notas}`);
  L.push("");
  if (c) {
    L.push(`## La session`);
    L.push("");
    L.push(`Video: ${c.tituloVideo}`);
    L.push("");
    L.push(`Por qué el lugar: ${c.porQueElLugar}`);
    L.push("");
    L.push(`Tensión: ${c.tension}`);
    L.push("");
    L.push(`Formato: ${c.formato}`);
    L.push("");
    L.push(`Plano de apertura: ${c.planoApertura}`);
    L.push("");
    L.push(`Artista: ${c.artista}. ${c.perfilArtista}`);
    L.push("");
    L.push(`Track del lugar: ${c.trackDelLugar}`);
    L.push("");
    L.push(`Quién decide: ${c.quienDecide}`);
    L.push("");
    L.push(`Cómo se pide: ${c.comoSePide}`);
    L.push("");
    L.push(`Riesgos:`);
    c.riesgos.forEach((x) => L.push(`- ${x}`));
    L.push("");
  }
  L.push(`## Los números (${r.entradas} entradas, tipo de cambio ${s.params.tipoCambio})`);
  L.push("");
  L.push(`| Rubro | Rango | Quién |`);
  L.push(`| --- | --- | --- |`);
  r.rubros.forEach((x) => L.push(`| ${x.nombre} | ${usd(x.min)} a ${usd(x.max)} | ${x.quien} |`));
  L.push("");
  L.push(`Bruto ticketera: ${usd(r.brutoUSD)} · Ticketing: ${usd(r.ticketingUSD)} · Derechos: ${usd(r.derechosUSD)} · Neto: ${usd(r.netoUSD)}`);
  if (r.barraUSD) L.push(`Barra estimada: ${usd(r.barraUSD)}`);
  L.push(`Lo que pagan los tickets: ${usd(r.costoTicketsMin)} a ${usd(r.costoTicketsMax)}`);
  L.push(`Lo que pone OAM (video y convocatoria): ${usd(r.costoOAMMin)} a ${usd(r.costoOAMMax)}`);
  L.push(`Resultado: ${usd(r.resultadoMin)} a ${usd(r.resultadoMax)} → ${r.veredicto.toUpperCase()}`);
  L.push("");
  L.push(`## Escenarios`);
  L.push("");
  L.push(`| | Escenario | Resultado | Veredicto |`);
  L.push(`| --- | --- | --- | --- |`);
  esc.forEach((e) =>
    L.push(`| ${e.clave} | ${e.nombre} | ${usd(e.resultado.resultadoMin)} a ${usd(e.resultado.resultadoMax)} | ${e.resultado.veredicto} |`)
  );
  L.push("");
  L.push(`## Test de las seis`);
  L.push("");
  PREGUNTAS.forEach(([k, q]) => L.push(`- ${q}: ${s.test[k] ? s.test[k] : "(vacío)"}`));
  L.push("");
  if (c) {
    L.push(`## Mail de apertura`);
    L.push("");
    L.push(c.mailApertura);
    L.push("");
    L.push(`## Teaser con IA`);
    L.push("");
    L.push(`Placa (imagen):`);
    L.push("");
    L.push("```");
    L.push(c.promptPlaca);
    L.push("```");
    L.push("");
    L.push(`Video:`);
    L.push("");
    L.push("```");
    L.push(c.promptVideo);
    L.push("```");
  }
  return L.join("\n");
}
