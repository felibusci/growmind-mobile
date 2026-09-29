"use client";

import { useEffect, useRef } from "react";
import type { Map as LMap, LayerGroup, Marker } from "leaflet";
import type { Lugar } from "@/lib/tipos";
import "leaflet/dist/leaflet.css";

interface Props {
  lugares: Lugar[];
  seleccionado: string | null;
  temporal: { lat: number; lng: number } | null;
  onSeleccionar: (id: string) => void;
  onClickMapa: (lat: number, lng: number) => void;
  onMover: (id: string, lat: number, lng: number) => void;
}

export default function Mapa({ lugares, seleccionado, temporal, onSeleccionar, onClickMapa, onMover }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const capaRef = useRef<LayerGroup | null>(null);
  const tempRef = useRef<Marker | null>(null);
  const cbRef = useRef({ onSeleccionar, onClickMapa, onMover });
  cbRef.current = { onSeleccionar, onClickMapa, onMover };

  // Crear el mapa una sola vez
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelado || !divRef.current || mapRef.current) return;
      const map = L.map(divRef.current, {
        center: [-34.5, -64.5],
        zoom: 5,
        zoomControl: false,
        attributionControl: true,
        worldCopyJump: true,
      });
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);
      map.on("click", (e) => cbRef.current.onClickMapa(e.latlng.lat, e.latlng.lng));
      capaRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      // fuerza a redibujar cuando el panel cambia de tamaño
      setTimeout(() => map.invalidateSize(), 50);
      dibujar();
    })();
    return () => {
      cancelado = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        capaRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function dibujar() {
    const map = mapRef.current;
    const capa = capaRef.current;
    if (!map || !capa) return;
    const L = (await import("leaflet")).default;
    capa.clearLayers();
    for (const l of lugares) {
      const sel = l.id === seleccionado;
      const icono = L.divIcon({
        className: "",
        html: `<span class="pin pin-${l.estado.replace(" ", "-")}${sel ? " pin-sel" : ""}${l.ubicacionConfirmada ? "" : " pin-dudoso"}"><i></i></span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const m = L.marker([l.lat, l.lng], { icon: icono, draggable: sel, title: l.nombre });
      m.on("click", () => cbRef.current.onSeleccionar(l.id));
      if (sel) m.on("dragend", () => {
        const p = m.getLatLng();
        cbRef.current.onMover(l.id, p.lat, p.lng);
      });
      m.bindTooltip(`${l.nombre}<br><small>${l.ciudad}</small>`, { direction: "top", offset: [0, -12], className: "tip" });
      m.addTo(capa);
    }
    if (tempRef.current) {
      tempRef.current.remove();
      tempRef.current = null;
    }
    if (temporal) {
      const icono = L.divIcon({
        className: "",
        html: `<span class="pin pin-temp"><i></i></span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      tempRef.current = L.marker([temporal.lat, temporal.lng], { icon: icono, interactive: false }).addTo(map);
    }
  }

  useEffect(() => {
    dibujar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lugares, seleccionado, temporal]);

  // Volar al seleccionado
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !seleccionado) return;
    const l = lugares.find((x) => x.id === seleccionado);
    if (!l) return;
    map.flyTo([l.lat, l.lng], Math.max(map.getZoom(), 9), { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionado]);

  return <div ref={divRef} className="mapa" />;
}
