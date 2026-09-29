// Motor de "Cierra?": la hoja de produccion de una fecha en Argentina, en codigo.
// Todo en USD adentro; las entradas y la barra se cargan en pesos.

export type TipoLugar = "publico" | "privado" | "club" | "aire-libre";
export type Categoria = "baile" | "espectaculo";

export interface Fecha {
  capacidad: number;
  ocupacion: number; // 0-1
  precio: number; // ARS por entrada, promedio
  tipoCambio: number; // ARS por USD

  internacionalUSD: number; // cachet + pasajes + hotel + visa. 0 si no hay
  nacionalUSD: number; // uno o varios nacionales / locales
  terceroCubre: boolean; // sponsor, ente, universidad o destino pone plata
  aporteTerceroUSD: number; // cuanto pone ese tercero

  lugar: TipoLugar;
  locacionUSD: number;
  locacionCanje: boolean; // publico por Forum / privado por barra

  tecnicaUSD: number; // sonido + luces + LED + generador
  rentalCanje: boolean; // rental socio por credito en el video, queda un fijo chico

  filmacion: boolean;
  filmacionUSD: number;

  seguridadUSD: number; // seguridad, ambulancia, banos, limpieza, policia adicional
  permisosUSD: number; // habilitacion, seguro RC, tramites
  pautaUSD: number; // pauta y contenido de convocatoria
  produccionPct: number; // viajes, hospitality, imprevistos, sobre los costos

  barraPropia: boolean;
  consumoBarraARS: number; // gasto promedio por persona en barra
  margenBarra: number; // 0-1

  ticketingPct: number; // comision de la ticketera sobre el bruto
  serviceARS: number; // costo fijo por QR que absorbe el productor (0 si lo paga el comprador)
  categoria: Categoria; // como se categoriza ante SADAIC
  sadaicPct: number;
  aadiPct: number; // AADI-CAPIF
  ivaPct: number; // 0 si exento, 0.21 si baile con IVA
  iibbPct: number;
}

export const FECHA_DEFAULT: Fecha = {
  capacidad: 800,
  ocupacion: 0.85,
  precio: 25000,
  tipoCambio: 1500,

  internacionalUSD: 9000,
  nacionalUSD: 1500,
  terceroCubre: false,
  aporteTerceroUSD: 9000,

  lugar: "publico",
  locacionUSD: 1600,
  locacionCanje: false,

  tecnicaUSD: 5000,
  rentalCanje: false,

  filmacion: true,
  filmacionUSD: 3500,

  seguridadUSD: 2000,
  permisosUSD: 800,
  pautaUSD: 1000,
  produccionPct: 0.1,

  barraPropia: true,
  consumoBarraARS: 10000,
  margenBarra: 0.55,

  ticketingPct: 0.1,
  serviceARS: 0,
  categoria: "baile",
  sadaicPct: 0.16,
  aadiPct: 0.08,
  ivaPct: 0,
  iibbPct: 0,
};

export interface Linea {
  clave: string;
  nombre: string;
  usd: number;
  nota?: string;
  grupo: "artistas" | "lugar" | "tecnica" | "operacion" | "video" | "convocatoria";
}

export interface Resultado {
  entradas: number;
  brutoUSD: number;
  ticketingUSD: number;
  derechosUSD: number;
  impuestosUSD: number;
  netoTicketsUSD: number;
  barraUSD: number;
  terceroUSD: number;
  ingresosUSD: number;
  lineas: Linea[];
  produccionUSD: number;
  costoUSD: number;
  resultadoUSD: number;
  margenPct: number; // resultado / ingresos
  veredicto: "cierra" | "justo" | "no cierra";
  netoPorEntradaUSD: number;
  equilibrioEntradas: number | null; // null si no hay contribucion positiva
  precioMinimoARS: number | null; // precio que cierra con las entradas actuales
  peor: Linea | null; // el rubro mas grande
  cargaSobreBrutoPct: number; // ticketing + derechos + impuestos
}

export function calcular(f: Fecha): Resultado {
  const tc = f.tipoCambio || 1;
  const entradas = Math.max(0, Math.round(f.capacidad * f.ocupacion));
  const brutoUSD = (entradas * f.precio) / tc;
  const ticketingUSD = brutoUSD * f.ticketingPct + (entradas * f.serviceARS) / tc;
  const derechosUSD = brutoUSD * (f.sadaicPct + f.aadiPct);
  const ivaUSD = f.ivaPct > 0 ? brutoUSD - brutoUSD / (1 + f.ivaPct) : 0;
  const iibbUSD = brutoUSD * f.iibbPct;
  const impuestosUSD = ivaUSD + iibbUSD;
  const netoTicketsUSD = brutoUSD - ticketingUSD - derechosUSD - impuestosUSD;
  const barraUSD = f.barraPropia ? ((entradas * f.consumoBarraARS) / tc) * f.margenBarra : 0;
  const terceroUSD = f.terceroCubre ? f.aporteTerceroUSD : 0;
  const ingresosUSD = netoTicketsUSD + barraUSD + terceroUSD;

  const lineas: Linea[] = [];
  if (f.internacionalUSD > 0)
    lineas.push({ clave: "internacional", nombre: "Artista internacional, con pasajes, hotel y visa", usd: f.internacionalUSD, grupo: "artistas" });
  if (f.nacionalUSD > 0) lineas.push({ clave: "nacional", nombre: "Artistas nacionales y locales", usd: f.nacionalUSD, grupo: "artistas" });

  const locNota =
    f.locacionCanje
      ? f.lugar === "publico"
        ? "en canje: la institución pone el espacio a cambio de una jornada abierta"
        : "en canje: el privado pone el lugar y se queda con la barra"
      : undefined;
  lineas.push({ clave: "locacion", nombre: "Locación", usd: f.locacionCanje ? 0 : f.locacionUSD, nota: locNota, grupo: "lugar" });

  lineas.push({
    clave: "tecnica",
    nombre: "Sonido, luces, LED y generador",
    usd: f.rentalCanje ? Math.round(f.tecnicaUSD * 0.25) : f.tecnicaUSD,
    nota: f.rentalCanje ? "rental socio en canje por crédito en el video, queda un fijo del 25%" : undefined,
    grupo: "tecnica",
  });

  if (f.filmacion) lineas.push({ clave: "filmacion", nombre: "Filmación, drone, color y edición", usd: f.filmacionUSD, grupo: "video" });
  lineas.push({ clave: "seguridad", nombre: "Seguridad, ambulancia, baños, limpieza, policía adicional", usd: f.seguridadUSD, grupo: "operacion" });
  lineas.push({ clave: "permisos", nombre: "Habilitación, seguro de responsabilidad civil, trámites", usd: f.permisosUSD, grupo: "operacion" });
  lineas.push({ clave: "pauta", nombre: "Pauta y contenido de convocatoria", usd: f.pautaUSD, grupo: "convocatoria" });

  const subtotal = lineas.reduce((a, l) => a + l.usd, 0);
  const produccionUSD = subtotal * f.produccionPct;
  const costoUSD = subtotal + produccionUSD;
  const resultadoUSD = ingresosUSD - costoUSD;
  const margenPct = ingresosUSD > 0 ? resultadoUSD / ingresosUSD : -1;

  let veredicto: Resultado["veredicto"] = "no cierra";
  if (resultadoUSD >= 0) veredicto = "cierra";
  else if (resultadoUSD >= -0.1 * costoUSD) veredicto = "justo";

  // contribucion neta por entrada vendida
  const cargaPct = f.ticketingPct + f.sadaicPct + f.aadiPct + (f.ivaPct > 0 ? 1 - 1 / (1 + f.ivaPct) : 0) + f.iibbPct;
  const netoPorEntradaUSD =
    (f.precio / tc) * (1 - cargaPct) - f.serviceARS / tc + (f.barraPropia ? (f.consumoBarraARS / tc) * f.margenBarra : 0);
  const fijoUSD = costoUSD - terceroUSD;
  const equilibrioEntradas = netoPorEntradaUSD > 0 ? Math.ceil(fijoUSD / netoPorEntradaUSD) : null;

  // precio que cierra con las entradas actuales
  let precioMinimoARS: number | null = null;
  if (entradas > 0 && 1 - cargaPct > 0) {
    const barraPorEntrada = f.barraPropia ? (f.consumoBarraARS / tc) * f.margenBarra : 0;
    const necesitoPorEntrada = fijoUSD / entradas - barraPorEntrada + f.serviceARS / tc;
    precioMinimoARS = Math.max(0, Math.ceil((necesitoPorEntrada / (1 - cargaPct)) * tc));
  }

  const peor = lineas.length ? lineas.reduce((a, l) => (l.usd > a.usd ? l : a)) : null;

  return {
    entradas,
    brutoUSD,
    ticketingUSD,
    derechosUSD,
    impuestosUSD,
    netoTicketsUSD,
    barraUSD,
    terceroUSD,
    ingresosUSD,
    lineas,
    produccionUSD,
    costoUSD,
    resultadoUSD,
    margenPct,
    veredicto,
    netoPorEntradaUSD,
    equilibrioEntradas,
    precioMinimoARS,
    peor,
    cargaSobreBrutoPct: cargaPct,
  };
}

export interface Palanca {
  clave: string;
  nombre: string;
  explicacion: string;
  aplica: (f: Fecha) => Fecha;
  disponible: (f: Fecha) => boolean;
}

// Lo que cambia el numero, en el orden en que lo cierran los que cierran.
export const PALANCAS: Palanca[] = [
  {
    clave: "tercero",
    nombre: "Un tercero paga el cachet",
    explicacion: "Sponsor, ente de turismo, universidad o destino. Es la línea que compran, porque es el nombre.",
    disponible: (f) => !f.terceroCubre && f.internacionalUSD > 0,
    aplica: (f) => ({ ...f, terceroCubre: true, aporteTerceroUSD: f.internacionalUSD }),
  },
  {
    clave: "rental",
    nombre: "Técnica en canje",
    explicacion: "Un rental socio pone sonido, luces y LED por crédito en el video y en el canal, con un fijo chico.",
    disponible: (f) => !f.rentalCanje,
    aplica: (f) => ({ ...f, rentalCanje: true }),
  },
  {
    clave: "lugar",
    nombre: "Lugar en canje",
    explicacion: "Al público se le pide el espacio a cambio de una jornada abierta. Al privado se le cobra la postal: pone lugar y se queda con la barra.",
    disponible: (f) => !f.locacionCanje && f.locacionUSD > 0,
    aplica: (f) => ({ ...f, locacionCanje: true, barraPropia: f.lugar === "publico" ? f.barraPropia : false }),
  },
  {
    clave: "espectaculo",
    nombre: "Categorizar como espectáculo, no como baile",
    explicacion: "Pedirlo por escrito antes del evento. Baja los derechos del 24% al 18% del bruto.",
    disponible: (f) => f.categoria === "baile",
    aplica: (f) => ({ ...f, categoria: "espectaculo", sadaicPct: 0.12, aadiPct: 0.06 }),
  },
  {
    clave: "dosNacionales",
    nombre: "Dos nacionales de peso en vez del internacional",
    explicacion: "Hasta que aparezca el tercero. El internacional va a la segunda fecha.",
    disponible: (f) => f.internacionalUSD > 0 && !f.terceroCubre,
    aplica: (f) => ({ ...f, internacionalUSD: 0, nacionalUSD: Math.max(f.nacionalUSD, 3000), terceroCubre: false }),
  },
  {
    clave: "precio",
    nombre: "Subir la entrada un 20%",
    explicacion: "Solo si la plaza lo aguanta. Mirá qué cobran las fechas comparables de tu ciudad.",
    disponible: () => true,
    aplica: (f) => ({ ...f, precio: Math.round((f.precio * 1.2) / 500) * 500 }),
  },
  {
    clave: "llenar",
    nombre: "Vender todo",
    explicacion: "Ocupación 100%. Solo pasa con preventa que financie las señas y una convocatoria que se vea.",
    disponible: (f) => f.ocupacion < 1,
    aplica: (f) => ({ ...f, ocupacion: 1 }),
  },
  {
    clave: "sinVideo",
    nombre: "Sacar la filmación",
    explicacion: "Ahorra hoy, pero el video es lo único que queda después de la fecha.",
    disponible: (f) => f.filmacion,
    aplica: (f) => ({ ...f, filmacion: false }),
  },
];

export function palancasAplicables(f: Fecha): Array<{ palanca: Palanca; resultado: Resultado; delta: number }> {
  const base = calcular(f).resultadoUSD;
  return PALANCAS.filter((p) => p.disponible(f))
    .map((palanca) => {
      const resultado = calcular(palanca.aplica(f));
      return { palanca, resultado, delta: resultado.resultadoUSD - base };
    })
    .sort((a, b) => b.delta - a.delta);
}

export function usd(n: number): string {
  const r = Math.round(n);
  return (r < 0 ? "-" : "") + "US$ " + Math.abs(r).toLocaleString("es-AR");
}
export function ars(n: number): string {
  return "$ " + Math.round(n).toLocaleString("es-AR");
}
export function pct(n: number): string {
  return Math.round(n * 100) + "%";
}
