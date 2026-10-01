"use client";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import { RISK_STYLE } from "@/lib/constants";
import type { Child } from "@/lib/types";

const KHLONG_HAT_CENTER: [number, number] = [13.45, 102.29];

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

// OpenStreetMap with one circle per child, colored by risk level.
export default function ChildrenMap({ items, onSelect }: { items: Child[]; onSelect: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    // Leaflet touches `window` on import, so load it only in the browser.
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(KHLONG_HAT_CENTER, 12);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      drawMarkers(L);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map is created once
  }, []);

  function drawMarkers(L: typeof import("leaflet")) {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    const points: [number, number][] = [];
    for (const c of items) {
      if (c.latitude == null || c.longitude == null) continue;
      const pos: [number, number] = [c.latitude, c.longitude];
      points.push(pos);
      L.circleMarker(pos, {
        radius: 8, weight: 2, color: "#fff", fillColor: RISK_STYLE[c.risk_level].color, fillOpacity: 0.9,
      })
        .bindTooltip(`<b>${escapeHtml(c.name)}</b><br>${escapeHtml(c.village_name || "-")} · ${c.risk_level} (${c.total_score}/10)<br>Hct ${c.hct ?? "-"}%`)
        .on("click", () => onSelectRef.current(c.id))
        .addTo(layer);
    }
    if (points.length) map.fitBounds(points, { padding: [30, 30], maxZoom: 15 });
  }

  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => drawMarkers(L));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redraw when the data changes
  }, [items]);

  return <div ref={containerRef} className="h-[460px] w-full rounded-b-xl relative z-0 isolate" />;
}
