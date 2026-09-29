import type { Escenario, ParamsPresupuesto, ResultadoPresupuesto, Rubro } from "./tipos";

// Hoja de produccion de una session On Air (600-1.000 personas).
// Rangos en USD. Cada rubro dice quien lo cubre segun los toggles.

export function calcularPresupuesto(p: ParamsPresupuesto): ResultadoPresupuesto {
  const entradas = Math.round(p.capacidad * p.ocupacion);
  const brutoUSD = (entradas * p.precioEntrada) / p.tipoCambio;
  const ticketingUSD = brutoUSD * p.ticketingPct;
  const derechosUSD = brutoUSD * p.derechosPct;
  const netoUSD = brutoUSD - ticketingUSD - derechosUSD;
  // En Rosario 2025 puerta y barra facturaron ~70% de lo que hizo la ticketera.
  // Se toma la mitad del bruto como estimacion conservadora.
  const barraUSD = p.barraPropia ? brutoUSD * 0.5 : 0;

  const rubros: Rubro[] = [];

  if (p.internacional) {
    rubros.push({
      nombre: "Artista internacional con pasajes, hotel y visa",
      min: 8000,
      max: 10000,
      quien: p.cachetCubierto ? "Sponsor, ente de turismo, universidad o destino" : "Tickets (no cierra así, buscá el tercero)",
      fuente: p.cachetCubierto ? "tercero" : "tickets",
    });
    rubros.push({ nombre: "Artista nacional", min: 800, max: 2000, quien: "Tickets", fuente: "tickets" });
  } else {
    rubros.push({ nombre: "Dos artistas nacionales de peso", min: 1600, max: 4000, quien: "Tickets", fuente: "tickets" });
  }

  rubros.push({
    nombre: "Sonido line array + luces + LED + generador",
    min: 4000,
    max: 6000,
    quien: p.rentalCanje ? "Rental socio en canje por crédito en el video" : "Tickets",
    fuente: p.rentalCanje ? "canje" : "tickets",
  });

  if (p.tipoLugar === "publico") {
    rubros.push({
      nombre: "Locación",
      min: 0,
      max: p.locacionCanje ? 0 : 2500,
      quien: p.locacionCanje ? "Institución, a cambio del Forum y la comunicación cruzada" : "Tickets",
      fuente: p.locacionCanje ? "canje" : "tickets",
    });
  } else {
    rubros.push({
      nombre: "Locación",
      min: 0,
      max: p.locacionCanje ? 0 : 2500,
      quien: p.locacionCanje ? "Privado pone lugar, barra y hospedaje y se queda con la barra" : "Tickets",
      fuente: p.locacionCanje ? "canje" : "tickets",
    });
  }

  rubros.push({
    nombre: "Filmación 4 cámaras + drone + color + edición",
    min: 3000,
    max: 4500,
    quien: "OAM o crew socio por porcentaje del video",
    fuente: "oam",
  });
  rubros.push({
    nombre: "Seguridad, ambulancia, baños, limpieza, policía adicional",
    min: 1500,
    max: 2500,
    quien: "Tickets",
    fuente: "tickets",
  });
  rubros.push({ nombre: "Pauta y contenido de convocatoria", min: 800, max: 1500, quien: "OAM", fuente: "oam" });
  rubros.push({
    nombre: "Producción, viajes, hospitality, imprevistos 10%",
    min: 1500,
    max: 2500,
    quien: "Tickets",
    fuente: "tickets",
  });

  const suma = (f: (r: Rubro) => boolean, k: "min" | "max") =>
    rubros.filter(f).reduce((a, r) => a + r[k], 0);

  const costoTotalMin = suma(() => true, "min");
  const costoTotalMax = suma(() => true, "max");
  const costoTicketsMin = suma((r) => r.fuente === "tickets", "min");
  const costoTicketsMax = suma((r) => r.fuente === "tickets", "max");
  const costoOAMMin = suma((r) => r.fuente === "oam", "min");
  const costoOAMMax = suma((r) => r.fuente === "oam", "max");

  const ingreso = netoUSD + barraUSD;
  const resultadoMin = ingreso - costoTicketsMax - costoOAMMax;
  const resultadoMax = ingreso - costoTicketsMin - costoOAMMin;

  let veredicto: ResultadoPresupuesto["veredicto"] = "no cierra";
  if (resultadoMin >= 0) veredicto = "cierra";
  else if (resultadoMax >= 0) veredicto = "justo";

  return {
    entradas,
    brutoUSD,
    ticketingUSD,
    derechosUSD,
    netoUSD,
    barraUSD,
    rubros,
    costoTotalMin,
    costoTotalMax,
    costoTicketsMin,
    costoTicketsMax,
    costoOAMMin,
    costoOAMMax,
    resultadoMin,
    resultadoMax,
    veredicto,
  };
}

// Los cuatro escenarios de la hoja: como esta, con el cachet puesto por un
// tercero, con dos nacionales, o 1.200 entradas a $30.000 en una plaza que las venda.
export function escenarios(p: ParamsPresupuesto): Escenario[] {
  const base: ParamsPresupuesto = { ...p };
  const conTercero: ParamsPresupuesto = { ...p, internacional: true, cachetCubierto: true };
  const dosNacionales: ParamsPresupuesto = { ...p, internacional: false, cachetCubierto: false };
  const plazaGrande: ParamsPresupuesto = { ...p, capacidad: 1200, ocupacion: 1, precioEntrada: 30000 };
  return [
    { clave: "A", nombre: "Como está", params: base, resultado: calcularPresupuesto(base) },
    { clave: "B", nombre: "Un tercero paga el internacional", params: conTercero, resultado: calcularPresupuesto(conTercero) },
    { clave: "C", nombre: "Dos nacionales de peso", params: dosNacionales, resultado: calcularPresupuesto(dosNacionales) },
    { clave: "D", nombre: "1.200 entradas a $30.000", params: plazaGrande, resultado: calcularPresupuesto(plazaGrande) },
  ];
}

export function usd(n: number): string {
  const r = Math.round(n);
  const s = Math.abs(r).toLocaleString("es-AR");
  return (r < 0 ? "-" : "") + "US$ " + s;
}

export function ars(n: number): string {
  return "$ " + Math.round(n).toLocaleString("es-AR");
}
