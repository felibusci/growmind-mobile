"use client";

import type { ParamsPresupuesto } from "@/lib/tipos";
import { calcularPresupuesto, escenarios, usd, ars } from "@/lib/presupuesto";

interface Props {
  params: ParamsPresupuesto;
  onChange: (p: ParamsPresupuesto) => void;
}

function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-box" />
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

export default function Presupuesto({ params, onChange }: Props) {
  const r = calcularPresupuesto(params);
  const esc = escenarios(params);
  const set = <K extends keyof ParamsPresupuesto>(k: K, v: ParamsPresupuesto[K]) => onChange({ ...params, [k]: v });

  return (
    <div className="bloque">
      <h3>Los números</h3>
      <p className="mudo">Rangos de la hoja de producción. Todo en US$ salvo la entrada. El precio no es el problema, el desglose sí.</p>

      <div className="grid2">
        <label>
          Capacidad
          <input type="number" min={100} step={50} value={params.capacidad} onChange={(e) => set("capacidad", Number(e.target.value))} />
        </label>
        <label>
          Ocupación
          <input type="number" min={0.1} max={1} step={0.05} value={params.ocupacion} onChange={(e) => set("ocupacion", Number(e.target.value))} />
        </label>
        <label>
          Entrada (ARS)
          <input type="number" min={1000} step={1000} value={params.precioEntrada} onChange={(e) => set("precioEntrada", Number(e.target.value))} />
        </label>
        <label>
          Tipo de cambio
          <input type="number" min={100} step={10} value={params.tipoCambio} onChange={(e) => set("tipoCambio", Number(e.target.value))} />
        </label>
        <label>
          Ticketing %
          <input type="number" min={0} max={0.3} step={0.01} value={params.ticketingPct} onChange={(e) => set("ticketingPct", Number(e.target.value))} />
        </label>
        <label>
          Derechos %
          <input type="number" min={0} max={0.3} step={0.01} value={params.derechosPct} onChange={(e) => set("derechosPct", Number(e.target.value))} />
        </label>
      </div>

      <div className="toggles">
        <Toggle label="Artista internacional" hint="tier Angiuli / Colyn / Budakid, US$ 8 a 10 mil con pasajes" value={params.internacional} onChange={(v) => set("internacional", v)} />
        {params.internacional && (
          <Toggle label="Un tercero paga el cachet" hint="sponsor, ente de turismo, universidad o destino" value={params.cachetCubierto} onChange={(v) => set("cachetCubierto", v)} />
        )}
        <Toggle label="Técnica en canje" hint="rental socio por crédito en el video" value={params.rentalCanje} onChange={(v) => set("rentalCanje", v)} />
        <Toggle
          label={params.tipoLugar === "publico" ? "Lugar por Forum" : "Lugar por la barra"}
          hint={params.tipoLugar === "publico" ? "la institución pone espacio y permisos" : "el privado pone lugar, barra y hospedaje"}
          value={params.locacionCanje}
          onChange={(v) => set("locacionCanje", v)}
        />
        <Toggle label="Barra propia" hint="estimada en la mitad de la ticketera" value={params.barraPropia} onChange={(v) => set("barraPropia", v)} />
      </div>

      <table className="tabla">
        <thead>
          <tr>
            <th>Rubro</th>
            <th>Rango</th>
            <th>Quién</th>
          </tr>
        </thead>
        <tbody>
          {r.rubros.map((x) => (
            <tr key={x.nombre} className={`f-${x.fuente}`}>
              <td>{x.nombre}</td>
              <td className="num">{x.max === 0 ? "0" : `${usd(x.min)} a ${usd(x.max)}`}</td>
              <td>{x.quien}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="kpis">
        <div>
          <small>{r.entradas} entradas a {ars(params.precioEntrada)}</small>
          <b>{usd(r.brutoUSD)}</b>
          <small>bruto ticketera</small>
        </div>
        <div>
          <small>menos ticketing y derechos</small>
          <b>{usd(r.netoUSD)}</b>
          <small>neto</small>
        </div>
        <div>
          <small>barra estimada</small>
          <b>{r.barraUSD ? usd(r.barraUSD) : "no es de OAM"}</b>
          <small>{params.barraPropia ? "factura como la ticketera" : "queda para el privado"}</small>
        </div>
        <div>
          <small>pagan los tickets</small>
          <b>{usd(r.costoTicketsMax)}</b>
          <small>hasta, más {usd(r.costoOAMMax)} que pone OAM</small>
        </div>
      </div>

      <div className={`veredicto v-${r.veredicto.replace(" ", "-")}`}>
        <span>{r.veredicto === "cierra" ? "Cierra" : r.veredicto === "justo" ? "Sale justo" : "No cierra"}</span>
        <b>
          {usd(r.resultadoMin)} a {usd(r.resultadoMax)}
        </b>
      </div>

      <h4>Escenarios</h4>
      <table className="tabla escenarios">
        <tbody>
          {esc.map((e) => (
            <tr key={e.clave} className={`v-${e.resultado.veredicto.replace(" ", "-")}`}>
              <td className="clave">{e.clave}</td>
              <td>{e.nombre}</td>
              <td className="num">
                {usd(e.resultado.resultadoMin)} a {usd(e.resultado.resultadoMax)}
              </td>
              <td className="ver">{e.resultado.veredicto}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mudo">Si no cierra en la hoja, la fecha se mueve. No se banca faltante entre socios.</p>
    </div>
  );
}
