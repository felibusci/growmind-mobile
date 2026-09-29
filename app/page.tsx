"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Lugar, Session } from "@/lib/tipos";
import { CATEGORIAS, PARAMS_DEFAULT, TEST_VACIO } from "@/lib/lugares";
import { cargarLugares, cargarSessions, guardarLugares, guardarSessions, nuevoId } from "@/lib/storage";
import Ficha from "@/components/Ficha";

const Mapa = dynamic(() => import("@/components/Mapa"), { ssr: false });

type Modo = "lista" | "nuevo" | "ficha";

interface Borrador {
  nombre: string;
  ciudad: string;
  provincia: string;
  pais: string;
  categoria: string;
  tipo: Lugar["tipo"];
  lat: number;
  lng: number;
}

const ORDEN_ESTADO: Record<Lugar["estado"], number> = { "en conversacion": 0, imaginada: 1, hecha: 2 };

export default function Home() {
  const [listo, setListo] = useState(false);
  const [lugares, setLugares] = useState<Lugar[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [modo, setModo] = useState<Modo>("lista");
  const [selId, setSelId] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [geocodeando, setGeocodeando] = useState(false);
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    setLugares(cargarLugares());
    setSessions(cargarSessions());
    setListo(true);
  }, []);

  useEffect(() => {
    if (listo) guardarLugares(lugares);
  }, [lugares, listo]);
  useEffect(() => {
    if (listo) guardarSessions(sessions);
  }, [sessions, listo]);

  const sel = useMemo(() => lugares.find((l) => l.id === selId) ?? null, [lugares, selId]);

  function sessionDe(lugarId: string, tipo: Lugar["tipo"]): Session {
    const s = sessions.find((x) => x.lugarId === lugarId);
    if (s) return s;
    const ahora = new Date().toISOString();
    const nueva: Session = {
      id: nuevoId("s"),
      lugarId,
      creadaEn: ahora,
      actualizadaEn: ahora,
      params: { ...PARAMS_DEFAULT, tipoLugar: tipo, barraPropia: tipo === "publico" },
      test: { ...TEST_VACIO },
    };
    setSessions((prev) => [...prev, nueva]);
    return nueva;
  }

  function abrir(id: string) {
    const l = lugares.find((x) => x.id === id);
    if (!l) return;
    sessionDe(id, l.tipo);
    setSelId(id);
    setBorrador(null);
    setModo("ficha");
  }

  async function clickMapa(lat: number, lng: number) {
    if (modo === "ficha") return; // en la ficha el click no crea, se arrastra el pin
    setSelId(null);
    const b: Borrador = { nombre: "", ciudad: "", provincia: "", pais: "Argentina", categoria: "otro", tipo: "publico", lat, lng };
    setBorrador(b);
    setModo("nuevo");
    setGeocodeando(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=es&zoom=14`,
        { headers: { Accept: "application/json" } }
      );
      if (res.ok) {
        const d = (await res.json()) as { name?: string; address?: Record<string, string> };
        const a = d.address ?? {};
        setBorrador((prev) =>
          prev && prev.lat === lat && prev.lng === lng
            ? {
                ...prev,
                nombre: prev.nombre || d.name || "",
                ciudad: a.city || a.town || a.village || a.municipality || a.county || "",
                provincia: a.state || a.province || a.region || "",
                pais: a.country || prev.pais,
              }
            : prev
        );
      }
    } catch {
      // sin geocoding, se carga a mano
    } finally {
      setGeocodeando(false);
    }
  }

  function guardarNuevo() {
    if (!borrador || !borrador.nombre.trim()) return;
    const l: Lugar = {
      id: nuevoId("l"),
      nombre: borrador.nombre.trim(),
      ciudad: borrador.ciudad.trim(),
      provincia: borrador.provincia.trim(),
      pais: borrador.pais.trim(),
      lat: borrador.lat,
      lng: borrador.lng,
      ubicacionConfirmada: true,
      categoria: borrador.categoria,
      tipo: borrador.tipo,
      estado: "imaginada",
      creadoEn: new Date().toISOString(),
    };
    setLugares((prev) => [...prev, l]);
    setBorrador(null);
    const ahora = new Date().toISOString();
    setSessions((prev) => [
      ...prev,
      {
        id: nuevoId("s"),
        lugarId: l.id,
        creadaEn: ahora,
        actualizadaEn: ahora,
        params: { ...PARAMS_DEFAULT, tipoLugar: l.tipo, barraPropia: l.tipo === "publico" },
        test: { ...TEST_VACIO },
      },
    ]);
    setSelId(l.id);
    setModo("ficha");
  }

  function actualizarLugar(l: Lugar) {
    setLugares((prev) => prev.map((x) => (x.id === l.id ? l : x)));
  }
  function actualizarSession(s: Session) {
    setSessions((prev) => prev.map((x) => (x.id === s.id ? { ...s, actualizadaEn: new Date().toISOString() } : x)));
  }
  function eliminarLugar(id: string) {
    if (!window.confirm("Borrar este lugar y su session? No se puede deshacer.")) return;
    setLugares((prev) => prev.filter((x) => x.id !== id));
    setSessions((prev) => prev.filter((x) => x.lugarId !== id));
    setSelId(null);
    setModo("lista");
  }

  const listaFiltrada = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return [...lugares]
      .filter((l) => !q || `${l.nombre} ${l.ciudad} ${l.provincia} ${l.categoria}`.toLowerCase().includes(q))
      .sort((a, b) => ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] || a.nombre.localeCompare(b.nombre));
  }, [lugares, filtro]);

  const sesionSel = sel ? sessions.find((s) => s.lugarId === sel.id) ?? null : null;

  return (
    <main className="shell">
      <section className="mapa-wrap">
        <Mapa
          lugares={lugares}
          seleccionado={selId}
          temporal={borrador ? { lat: borrador.lat, lng: borrador.lng } : null}
          onSeleccionar={abrir}
          onClickMapa={clickMapa}
          onMover={(id, lat, lng) => {
            const l = lugares.find((x) => x.id === id);
            if (l) actualizarLugar({ ...l, lat, lng, ubicacionConfirmada: true });
          }}
        />
        <div className="marca">
          <span className="luz" />
          <b>ON AIR</b> <span>atlas</span>
        </div>
        {modo !== "ficha" && <div className="ayuda">Tocá cualquier punto del mapa e imaginá la session ahí</div>}
      </section>

      <aside className="panel">
        {modo === "lista" && (
          <div className="lista">
            <header className="panel-head">
              <h1>Lugares imposibles</h1>
              <p className="mudo">
                {lugares.filter((l) => l.estado === "hecha").length} hechas · {lugares.filter((l) => l.estado === "en conversacion").length} en conversación ·{" "}
                {lugares.filter((l) => l.estado === "imaginada").length} imaginadas
              </p>
              <input className="buscar" placeholder="Buscar lugar, ciudad, categoría" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
            </header>
            <ul>
              {listaFiltrada.map((l) => {
                const s = sessions.find((x) => x.lugarId === l.id);
                return (
                  <li key={l.id} onClick={() => abrir(l.id)}>
                    <span className={`punto p-${l.estado.replace(" ", "-")}`} />
                    <div>
                      <b>{s?.concepto?.titulo ?? l.nombre}</b>
                      <small>
                        {l.ciudad}, {l.provincia} · {l.categoria}
                        {!l.ubicacionConfirmada && " · pin a ojo"}
                      </small>
                    </div>
                    <span className="flecha">→</span>
                  </li>
                );
              })}
            </ul>
            {listaFiltrada.length === 0 && <p className="mudo vacio">Nada con ese nombre. Tocá el mapa y sumalo.</p>}
            <footer className="panel-foot mudo">
              Todo queda en este navegador, nada sale de acá salvo lo que le mandás a Gemini para imaginar. Copiá la ficha a la carpeta del plan.
            </footer>
          </div>
        )}

        {modo === "nuevo" && borrador && (
          <div className="nuevo">
            <button className="btn-link" onClick={() => { setBorrador(null); setModo("lista"); }}>
              ← Cancelar
            </button>
            <h2>Nuevo lugar</h2>
            <p className="mudo">
              {borrador.lat.toFixed(4)}, {borrador.lng.toFixed(4)} {geocodeando && "· buscando el nombre…"}
            </p>
            <label>
              Nombre del lugar
              <input autoFocus value={borrador.nombre} onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })} placeholder="Dique, bodega, museo, hangar…" />
            </label>
            <div className="grid2">
              <label>
                Ciudad
                <input value={borrador.ciudad} onChange={(e) => setBorrador({ ...borrador, ciudad: e.target.value })} />
              </label>
              <label>
                Provincia
                <input value={borrador.provincia} onChange={(e) => setBorrador({ ...borrador, provincia: e.target.value })} />
              </label>
              <label>
                País
                <input value={borrador.pais} onChange={(e) => setBorrador({ ...borrador, pais: e.target.value })} />
              </label>
              <label>
                Categoría
                <select value={borrador.categoria} onChange={(e) => setBorrador({ ...borrador, categoria: e.target.value })}>
                  {CATEGORIAS.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="segmentado">
              <button className={borrador.tipo === "publico" ? "on" : ""} onClick={() => setBorrador({ ...borrador, tipo: "publico" })}>
                Público
                <small>universidad, museo, municipio: espacio por Forum</small>
              </button>
              <button className={borrador.tipo === "privado" ? "on" : ""} onClick={() => setBorrador({ ...borrador, tipo: "privado" })}>
                Privado
                <small>bodega, hotel, estancia: pone lugar por la barra</small>
              </button>
            </div>
            <button className="btn-primario" onClick={guardarNuevo} disabled={!borrador.nombre.trim()}>
              Abrir la ficha
            </button>
          </div>
        )}

        {modo === "ficha" && sel && sesionSel && (
          <Ficha
            lugar={sel}
            session={sesionSel}
            onLugar={actualizarLugar}
            onSession={actualizarSession}
            onEliminar={() => eliminarLugar(sel.id)}
            onVolver={() => {
              setSelId(null);
              setModo("lista");
            }}
          />
        )}
      </aside>
    </main>
  );
}
