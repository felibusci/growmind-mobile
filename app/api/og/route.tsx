import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { calcular, usd, ars } from "@/lib/modelo";
import { queryAFecha } from "@/lib/url";

export const runtime = "edge";

// La tarjeta que se comparte: el veredicto, el número y el rubro que mata.
export async function GET(req: NextRequest) {
  const f = queryAFecha(req.nextUrl.searchParams);
  const r = calcular(f);
  const color = r.veredicto === "cierra" ? "#2fd27a" : r.veredicto === "justo" ? "#f5b700" : "#ff2d2d";
  const titulo = r.veredicto === "cierra" ? "CIERRA" : r.veredicto === "justo" ? "SALE JUSTO" : "NO CIERRA";
  const sub = `${r.entradas.toLocaleString("es-AR")} entradas a ${ars(f.precio)}${f.internacionalUSD > 0 ? " · con internacional" : ""}${f.terceroCubre ? " · con un tercero en el cachet" : ""}`;
  const mata = r.peor ? `Lo que más pesa: ${r.peor.nombre.toLowerCase()} (${usd(r.peor.usd)})` : "";
  const equilibrio = r.equilibrioEntradas ? `Punto de equilibrio: ${r.equilibrioEntradas.toLocaleString("es-AR")} entradas` : "No cierra a este precio ni vendiendo todo";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0b0b0c",
          color: "#f2f0eb",
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, letterSpacing: 6, color: "#8f8d87" }}>
          <div style={{ width: 16, height: 16, borderRadius: 999, background: "#ff2d2d" }} />
          CIERRA?
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 132, fontWeight: 800, lineHeight: 1, color, letterSpacing: -4 }}>{titulo}</div>
          <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -2 }}>{usd(r.resultadoUSD)}</div>
          <div style={{ fontSize: 30, color: "#c9c6bf" }}>{sub}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 26, color: "#8f8d87" }}>
          <div>{mata}</div>
          <div>{equilibrio}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
