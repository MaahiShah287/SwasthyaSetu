import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { ScoredFacility } from '../../types/referral';

// Fix default Leaflet icon URLs
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface CarePathwayMapProps {
  userLocation: [number, number];
  bestMatch?: ScoredFacility | null;
  secondOption?: ScoredFacility | null;
  thirdOption?: ScoredFacility | null;
  fallbackOptions?: ScoredFacility[];
  selectedFacility?: ScoredFacility | null;
  onSelectFacility?: (facility: ScoredFacility) => void;
}

const CarePathwayMap: React.FC<CarePathwayMapProps> = ({
  userLocation,
  bestMatch,
  secondOption,
  thirdOption,
  fallbackOptions = [],
  onSelectFacility
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map('carePathwayMapContainer', {
      center: userLocation,
      zoom: 12,
      scrollWheelZoom: true,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // User location marker
    const userIcon = L.divIcon({
      className: '',
      html: `
        <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;width:40px;height:40px;border-radius:50%;background:rgba(59,130,246,0.25);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 16px rgba(59,130,246,0.9);z-index:2;"></div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    L.marker(userLocation, { icon: userIcon })
      .addTo(map)
      .bindPopup('<b style="font-family:sans-serif;color:#3b82f6">📍 Your Location</b>');

    const markers = L.layerGroup().addTo(map);
    markersRef.current = markers;
    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;

    markersRef.current.clearLayers();
    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    const allOptions: { item: ScoredFacility; label: string; color: string }[] = [];

    if (bestMatch) {
      allOptions.push({ item: bestMatch, label: '#1 Best Match', color: '#10b981' });
    }
    if (secondOption) {
      allOptions.push({ item: secondOption, label: '#2 Alternative', color: '#06b6d4' });
    }
    if (thirdOption) {
      allOptions.push({ item: thirdOption, label: '#3 Alternative', color: '#8b5cf6' });
    }
    if (allOptions.length === 0 && fallbackOptions.length > 0) {
      fallbackOptions.forEach((f, idx) => {
        allOptions.push({ item: f, label: `Nearest #${idx + 1}`, color: '#f59e0b' });
      });
    }

    const bounds = L.latLngBounds([userLocation]);

    allOptions.forEach(({ item, label, color }) => {
      const { facility, distance_km, total_score, is_stale } = item;
      const pos: [number, number] = [facility.latitude, facility.longitude];
      bounds.extend(pos);

      const markerHtml = `
        <div style="
          background: ${color};
          color: white;
          padding: 4px 10px;
          border-radius: 9999px;
          font-weight: 700;
          font-size: 11px;
          font-family: sans-serif;
          box-shadow: 0 4px 12px ${color}80;
          border: 2px solid white;
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        ">
          <span>${label}</span>
          <span style="background:rgba(255,255,255,0.3);padding:1px 5px;border-radius:8px;">${total_score}%</span>
        </div>
      `;

      const customIcon = L.divIcon({
        className: '',
        html: markerHtml,
        iconSize: [110, 30],
        iconAnchor: [55, 15],
      });

      const marker = L.marker(pos, { icon: customIcon }).addTo(markersRef.current!);

      const popupContent = `
        <div style="font-family: Outfit, sans-serif; min-width: 200px; padding: 4px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
            <span style="font-size: 11px; font-weight: 700; color: ${color}; background: ${color}20; padding: 2px 8px; border-radius: 9999px;">${label}</span>
            <span style="font-size: 11px; font-weight: 600; color: #64748b;">${distance_km} km away</span>
          </div>
          <h4 style="margin: 4px 0; font-size: 14px; font-weight: 700; color: #0f172a;">${facility.name}</h4>
          <p style="margin: 2px 0 6px 0; font-size: 11px; color: #64748b;">${facility.type} • ${facility.status}</p>
          ${is_stale ? `<div style="font-size: 10px; color: #d97706; background: #fef3c7; padding: 2px 6px; border-radius: 4px; margin-bottom: 6px;">⚠️ Stale Data (>24h)</div>` : ''}
          <div style="font-size: 11px; color: #334155; margin-bottom: 8px;">
            <b>Available Beds:</b> ${facility.available_beds} / ${facility.total_beds}<br/>
            <b>24/7 ER:</b> ${facility.is_24x7_emergency ? 'Yes ✅' : 'No'}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.on('click', () => {
        if (onSelectFacility) onSelectFacility(item);
      });
    });

    // Draw route line to best match if available
    if (bestMatch) {
      const bestPos: [number, number] = [bestMatch.facility.latitude, bestMatch.facility.longitude];
      const routeLine = L.polyline([userLocation, bestPos], {
        color: '#10b981',
        weight: 4,
        dashArray: '6, 8',
        opacity: 0.85
      }).addTo(mapRef.current);
      routeLineRef.current = routeLine;
    }

    if (allOptions.length > 0) {
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [userLocation, bestMatch, secondOption, thirdOption, fallbackOptions]);

  return (
    <div className="relative w-full h-[360px] md:h-[420px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md">
      <div id="carePathwayMapContainer" className="w-full h-full z-0" />
      <div className="absolute top-3 right-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 shadow-sm z-[1000] flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
        Interactive Rural Access Map
      </div>
    </div>
  );
};

export default CarePathwayMap;
