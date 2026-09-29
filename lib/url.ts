import { FECHA_DEFAULT, type Fecha } from "./modelo";

// La fecha vive en la URL. Sin base de datos: cada resultado es un link.
const CLAVES: Array<[keyof Fecha, string]> = [
  ["capacidad", "c"],
  ["ocupacion", "o"],
  ["precio", "p"],
  ["tipoCambio", "tc"],
  ["internacionalUSD", "i"],
  ["nacionalUSD", "n"],
  ["terceroCubre", "t3"],
  ["aporteTerceroUSD", "a3"],
  ["lugar", "lg"],
  ["locacionUSD", "lo"],
  ["locacionCanje", "lc"],
  ["tecnicaUSD", "te"],
  ["rentalCanje", "rc"],
  ["filmacion", "fi"],
  ["filmacionUSD", "fu"],
  ["seguridadUSD", "se"],
  ["permisosUSD", "pe"],
  ["pautaUSD", "pa"],
  ["produccionPct", "pp"],
  ["barraPropia", "bp"],
  ["consumoBarraARS", "cb"],
  ["margenBarra", "mb"],
  ["ticketingPct", "tk"],
  ["serviceARS", "sv"],
  ["categoria", "ca"],
  ["sadaicPct", "sd"],
  ["aadiPct", "ad"],
  ["ivaPct", "iv"],
  ["iibbPct", "ib"],
];

export function fechaAQuery(f: Fecha): string {
  const q = new URLSearchParams();
  for (const [k, s] of CLAVES) {
    const v = f[k];
    if (v === FECHA_DEFAULT[k]) continue;
    if (typeof v === "boolean") q.set(s, v ? "1" : "0");
    else q.set(s, String(v));
  }
  return q.toString();
}

export function queryAFecha(q: URLSearchParams | Record<string, string | string[] | undefined>): Fecha {
  const get = (s: string): string | null => {
    if (q instanceof URLSearchParams) return q.get(s);
    const v = q[s];
    return Array.isArray(v) ? v[0] ?? null : v ?? null;
  };
  const f: Fecha = { ...FECHA_DEFAULT };
  for (const [k, s] of CLAVES) {
    const raw = get(s);
    if (raw === null || raw === "") continue;
    const def = FECHA_DEFAULT[k];
    if (typeof def === "boolean") (f as unknown as Record<string, unknown>)[k] = raw === "1" || raw === "true";
    else if (typeof def === "number") {
      const n = Number(raw);
      if (Number.isFinite(n)) (f as unknown as Record<string, unknown>)[k] = n;
    } else (f as unknown as Record<string, unknown>)[k] = raw;
  }
  // limites sanos
  f.capacidad = Math.min(Math.max(f.capacidad, 20), 100000);
  f.ocupacion = Math.min(Math.max(f.ocupacion, 0.05), 1);
  f.precio = Math.min(Math.max(f.precio, 0), 5000000);
  f.tipoCambio = Math.min(Math.max(f.tipoCambio, 1), 100000);
  return f;
}
