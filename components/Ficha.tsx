"use client";

import { useState } from "react";
import type { ConceptoIA, Lugar, Session, TestSeis } from "@/lib/tipos";
import { CATEGORIAS } from "@/lib/lugares";
import { calcularPresupuesto, escenarios } from "@/lib/presupuesto";
import { fichaMarkdown, PREGUNTAS } from "@/lib/markdown";
import Presupuesto from "./Presupuesto";

interface Props {
  lugar: Lugar;
  session: Session;
  onLugar: (l: Lugar) => void;
  onSession: (s: Session) => void;
  onEliminar: () => void;
  onVolver: () => void;
}

async function copiar(txt: string) {
  try {
    await navigator.clipboard.writeText(txt);
    return true;
  } catch {
    return false;
  }
}

function Copiar({ texto, label = "Copiar" }: { texto: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="btn-chico"
      onClick={async () => {
        if (await copiar(texto)) {
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        }
      }}
    >
      {ok ? "Listo" : label}
    </button>
  );
}

export default function Ficha({ lugar, session, onLugar, onSession, onEliminar, onVolver }: Props) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);

  const r = calcularPresupuesto(session.params);
  const esc = escenarios(session.params);
  const c = session.concepto;

  const setTest = (k: keyof TestSeis, v: string) => onSession({ ...session, test: { ...session.test, [k]: v } });
  const completas = PREGUNTAS.filter(([k]) => session.test[k].trim().length > 0).length;

  async function imaginar() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/imaginar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lugar, params: session.params, resultado: r, fecha: session.test.fecha || undefined }),
      });
      const data = (await res.json()) as { ok: boolean; concepto?: ConceptoIA; error?: string };
      if (!data.ok || !data.concepto) throw new Error(data.error || "No vino nada");
      onSession({ ...session, concepto: data.concepto });
      if (lugar.estado !== "hecha" && lugar.estado !== "en conversacion") onLugar({ ...lugar, estado: "imaginada" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }

  function bajarMd() {
    const md = fichaMarkdown(lugar, session, r, esc);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${lugar.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="ficha">
      <div className="ficha-top">
        <button className="btn-link" onClick={onVolver}>
          ← Lugares
        </button>
        <div className="acciones">
          <Copiar texto={fichaMarkdown(lugar, session, r, esc)} label="Copiar ficha" />
          <button className="btn-chico" onClick={bajarMd}>
            Bajar .md
          </button>
        </div>
      </div>

      <header className="ficha-head">
        <span className={`chip chip-${lugar.estado.replace(" ", "-")}`}>{lugar.estado}</span>
        <h2>{c?.titulo ?? lugar.nombre}</h2>
        <p className="mudo">
          {[lugar.nombre, [lugar.ciudad, lugar.provincia].filter(Boolean).join(", "), lugar.categoria, lugar.tipo].filter(Boolean).join(" · ")}
          {!lugar.ubicacionConfirmada && <span className="alerta"> · pin a ojo, arrastralo</span>}
        </p>
        <button className="btn-link" onClick={() => setEditando(!editando)}>
          {editando ? "Cerrar edición" : "Editar lugar"}
        </button>
      </header>

      {editando && (
        <div className="bloque edicion">
          <div className="grid2">
            <label>
              Nombre
              <input value={lugar.nombre} onChange={(e) => onLugar({ ...lugar, nombre: e.target.value })} />
            </label>
            <label>
              Ciudad
              <input value={lugar.ciudad} onChange={(e) => onLugar({ ...lugar, ciudad: e.target.value })} />
            </label>
            <label>
              Provincia
              <input value={lugar.provincia} onChange={(e) => onLugar({ ...lugar, provincia: e.target.value })} />
            </label>
            <label>
              País
              <input value={lugar.pais} onChange={(e) => onLugar({ ...lugar, pais: e.target.value })} />
            </label>
            <label>
              Categoría
              <select value={lugar.categoria} onChange={(e) => onLugar({ ...lugar, categoria: e.target.value })}>
                {CATEGORIAS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Estado
              <select value={lugar.estado} onChange={(e) => onLugar({ ...lugar, estado: e.target.value as Lugar["estado"] })}>
                <option value="imaginada">imaginada</option>
                <option value="en conversacion">en conversacion</option>
                <option value="hecha">hecha</option>
              </select>
            </label>
            <label>
              Tipo
              <select
                value={lugar.tipo}
                onChange={(e) => {
                  const tipo = e.target.value as Lugar["tipo"];
                  onLugar({ ...lugar, tipo });
                  onSession({ ...session, params: { ...session.params, tipoLugar: tipo, barraPropia: tipo === "publico" } });
                }}
              >
                <option value="publico">público</option>
                <option value="privado">privado</option>
              </select>
            </label>
            <label>
              Pin confirmado
              <select value={lugar.ubicacionConfirmada ? "si" : "no"} onChange={(e) => onLugar({ ...lugar, ubicacionConfirmada: e.target.value === "si" })}>
                <option value="si">sí</option>
                <option value="no">no</option>
              </select>
            </label>
            <label>
              Lat
              <input type="number" step={0.0001} value={lugar.lat} onChange={(e) => onLugar({ ...lugar, lat: Number(e.target.value) })} />
            </label>
            <label>
              Lng
              <input type="number" step={0.0001} value={lugar.lng} onChange={(e) => onLugar({ ...lugar, lng: Number(e.target.value) })} />
            </label>
          </div>
          <label>
            Video (link)
            <input value={lugar.video ?? ""} onChange={(e) => onLugar({ ...lugar, video: e.target.value })} placeholder="youtube.com/..." />
          </label>
          <label>
            Notas
            <textarea rows={3} value={lugar.notas ?? ""} onChange={(e) => onLugar({ ...lugar, notas: e.target.value })} />
          </label>
          <button className="btn-peligro" onClick={onEliminar}>
            Borrar lugar
          </button>
        </div>
      )}

      <Presupuesto params={session.params} onChange={(p) => onSession({ ...session, params: p })} />

      <div className="bloque">
        <h3>Imaginar la session</h3>
        <p className="mudo">Gemini toma el lugar y los números y arma concepto, artista, quién decide, el mail en tu voz y los prompts del teaser.</p>
        <button className="btn-primario" onClick={imaginar} disabled={cargando}>
          {cargando ? "Imaginando…" : c ? "Imaginar de nuevo" : "Imaginar acá"}
        </button>
        {error && <p className="error">{error}</p>}
      </div>

      {c && (
        <>
          <div className="bloque concepto">
            <h3>La session</h3>
            <dl>
              <dt>Video</dt>
              <dd>{c.tituloVideo}</dd>
              <dt>Por qué el lugar</dt>
              <dd>{c.porQueElLugar}</dd>
              <dt>Tensión</dt>
              <dd>{c.tension}</dd>
              <dt>Formato</dt>
              <dd>{c.formato}</dd>
              <dt>Plano de apertura</dt>
              <dd>{c.planoApertura}</dd>
              <dt>Artista</dt>
              <dd>
                {c.artista}. {c.perfilArtista}
              </dd>
              <dt>Track del lugar</dt>
              <dd>{c.trackDelLugar}</dd>
              <dt>Quién decide</dt>
              <dd>{c.quienDecide}</dd>
              <dt>Cómo se pide</dt>
              <dd>{c.comoSePide}</dd>
              <dt>Riesgos</dt>
              <dd>
                <ul>
                  {c.riesgos.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </dd>
            </dl>
          </div>

          <div className="bloque">
            <div className="titulo-con-accion">
              <h3>Mail de apertura</h3>
              <Copiar texto={c.mailApertura} />
            </div>
            <p className="mudo">Tres datos, qué se quiere hacer y dónde, pide reunión. El modelo se muestra en la reunión. Editalo antes de mandar.</p>
            <textarea
              className="mail"
              rows={12}
              value={c.mailApertura}
              onChange={(e) => onSession({ ...session, concepto: { ...c, mailApertura: e.target.value } })}
            />
          </div>

          <div className="bloque">
            <h3>Teaser con IA</h3>
            <p className="mudo">Prompts que buscan footage real, no test de IA. Placa primero en imagen, después el video con la placa de referencia.</p>
            <div className="titulo-con-accion">
              <h4>Placa</h4>
              <Copiar texto={c.promptPlaca} />
            </div>
            <pre>{c.promptPlaca}</pre>
            <div className="titulo-con-accion">
              <h4>Video</h4>
              <Copiar texto={c.promptVideo} />
            </div>
            <pre>{c.promptVideo}</pre>
          </div>
        </>
      )}

      <div className="bloque">
        <div className="titulo-con-accion">
          <h3>Test de las seis</h3>
          <span className={`contador ${completas === 6 ? "ok" : ""}`}>{completas}/6</span>
        </div>
        <p className="mudo">Si alguna queda vacía, no está lista para mandar. Una idea mediocre con dueño, fecha y artefacto pasa. Una excelente sin eso, no.</p>
        {PREGUNTAS.map(([k, q]) => (
          <label key={k}>
            {q}
            <input value={session.test[k]} onChange={(e) => setTest(k, e.target.value)} placeholder={k === "artefacto" ? "link, screen, número, planilla" : k === "dueno" ? "nombre, no área" : ""} />
          </label>
        ))}
        <p className="mudo septima">Y la séptima, que no se dice: esto lo vas a tener que terminar tapando vos?</p>
      </div>
    </div>
  );
}
