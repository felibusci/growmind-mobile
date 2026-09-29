import type { Lugar, Session } from "./tipos";
import { LUGARES_SEMILLA } from "./lugares";

const K_LUGARES = "oam-atlas:lugares";
const K_SESSIONS = "oam-atlas:sessions";

function leer<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function escribir<T>(k: string, v: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // sin drama, se sigue en memoria
  }
}

export function cargarLugares(): Lugar[] {
  const guardados = leer<Lugar[] | null>(K_LUGARES, null);
  if (guardados && guardados.length) return guardados;
  escribir(K_LUGARES, LUGARES_SEMILLA);
  return LUGARES_SEMILLA;
}

export function guardarLugares(l: Lugar[]) {
  escribir(K_LUGARES, l);
}

export function cargarSessions(): Session[] {
  return leer<Session[]>(K_SESSIONS, []);
}

export function guardarSessions(s: Session[]) {
  escribir(K_SESSIONS, s);
}

export function nuevoId(prefijo: string): string {
  return prefijo + "-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}
