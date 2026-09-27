import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Mapa OpenStreetMap: środek wyszukiwania, promień i znalezione firmy.
export default function MapView({ center, radiusKm, points = [], selected, onToggle }) {
  const el = useRef(null);
  const map = useRef(null);
  const areaLayer = useRef(null);
  const pointLayer = useRef(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current).setView([52.1, 19.4], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map.current);
    areaLayer.current = L.layerGroup().addTo(map.current);
    pointLayer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    areaLayer.current.clearLayers();
    if (!center?.lat) return;
    const circle = L.circle([center.lat, center.lon], {
      radius: radiusKm * 1000,
      color: '#15181c',
      weight: 1.5,
      dashArray: '6 6',
      fillColor: '#ffc400',
      fillOpacity: 0.07,
    }).addTo(areaLayer.current);
    L.circleMarker([center.lat, center.lon], { radius: 6, color: '#15181c', fillColor: '#15181c', fillOpacity: 1 }).addTo(areaLayer.current);
    map.current.fitBounds(circle.getBounds(), { padding: [10, 10] });
  }, [center?.lat, center?.lon, radiusKm]);

  useEffect(() => {
    if (!map.current) return;
    pointLayer.current.clearLayers();
    for (const p of points) {
      if (!p.lat) continue;
      const on = selected?.has(p.osmId);
      const mk = L.circleMarker([p.lat, p.lon], {
        radius: on ? 7 : 5,
        color: on ? '#15181c' : '#5b636d',
        weight: on ? 2 : 1,
        fillColor: on ? '#ffc400' : '#ffffff',
        fillOpacity: 1,
      }).addTo(pointLayer.current);
      mk.bindTooltip(`${p.name}${p.email ? ' · e-mail' : ''}${p.website ? ' · www' : ''}`);
      if (onToggle) mk.on('click', () => onToggle(p.osmId));
    }
  }, [points, selected, onToggle]);

  return <div ref={el} className="map" aria-label="Mapa wyników" />;
}
