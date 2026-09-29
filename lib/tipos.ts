export type TipoLugar = "publico" | "privado";
export type EstadoLugar = "hecha" | "imaginada" | "en conversacion";

export interface Lugar {
  id: string;
  nombre: string;
  ciudad: string;
  provincia: string;
  pais: string;
  lat: number;
  lng: number;
  ubicacionConfirmada: boolean;
  categoria: string;
  tipo: TipoLugar;
  estado: EstadoLugar;
  video?: string;
  notas?: string;
  creadoEn: string;
}

export interface ParamsPresupuesto {
  capacidad: number;
  ocupacion: number; // 0-1
  precioEntrada: number; // ARS
  tipoCambio: number; // ARS por USD
  tipoLugar: TipoLugar;
  internacional: boolean;
  cachetCubierto: boolean; // sponsor, ente, universidad o destino paga el internacional
  rentalCanje: boolean; // sonido, luces, LED y generador en canje por credito en el video
  locacionCanje: boolean; // publico: trueque por Forum. privado: pone lugar por la barra
  barraPropia: boolean; // OAM o socio local se queda con la barra
  ticketingPct: number; // 0.06 - 0.20
  derechosPct: number; // 0.12 - 0.24 (SADAIC + AADI-CAPIF)
}

export interface Rubro {
  nombre: string;
  min: number;
  max: number;
  quien: string;
  fuente: "tickets" | "tercero" | "canje" | "oam";
}

export interface ResultadoPresupuesto {
  entradas: number;
  brutoUSD: number;
  ticketingUSD: number;
  derechosUSD: number;
  netoUSD: number;
  barraUSD: number;
  rubros: Rubro[];
  costoTotalMin: number;
  costoTotalMax: number;
  costoTicketsMin: number;
  costoTicketsMax: number;
  costoOAMMin: number;
  costoOAMMax: number;
  resultadoMin: number; // neto + barra - costos que pagan tickets - lo que pone OAM
  resultadoMax: number;
  veredicto: "cierra" | "justo" | "no cierra";
}

export interface Escenario {
  clave: "A" | "B" | "C" | "D";
  nombre: string;
  params: ParamsPresupuesto;
  resultado: ResultadoPresupuesto;
}

export interface ConceptoIA {
  titulo: string;
  tituloVideo: string;
  porQueElLugar: string;
  tension: string;
  formato: string;
  planoApertura: string;
  artista: string;
  perfilArtista: string;
  quienDecide: string;
  comoSePide: string;
  riesgos: string[];
  trackDelLugar: string;
  mailApertura: string;
  promptPlaca: string;
  promptVideo: string;
}

export interface TestSeis {
  dueno: string;
  artefacto: string;
  fecha: string;
  aQuien: string;
  queCambia: string;
  queQueda: string;
}

export interface Session {
  id: string;
  lugarId: string;
  creadaEn: string;
  actualizadaEn: string;
  params: ParamsPresupuesto;
  concepto?: ConceptoIA;
  test: TestSeis;
}
