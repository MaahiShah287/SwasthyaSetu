import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MedicineAvailabilityResult } from '../../types/medicine';
import { Navigation, MapPin } from 'lucide-react';

// Fix default Leaflet icon URLs
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MedicineAvailabilityMapProps {
  userLocation: { lat: number; lon: number };
  results: MedicineAvailabilityResult[];
  onSelectFacility?: (item: MedicineAvailabilityResult) => void;
}

export default function MedicineAvailabilityMap({
  userLocation,
  results,
  onSelectFacility
}: MedicineAvailabilityMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [userLocation.lat, userLocation.lon],
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
            <div style="position:absolute;width:40px;height:40px;border-radius:50%;background:rgba(59,130,246,0.3);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 16px rgba(59,130,246,0.9);z-index:2;"></div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      L.marker([userLocation.lat, userLocation.lon], { icon: userIcon })
        .addTo(map)
        .bindPopup('<b style="font-family:sans-serif;color:#3b82f6">📍 Your Current Location</b>');

      const markersGroup = L.layerGroup().addTo(map);
      markersGroupRef.current = markersGroup;
      mapInstanceRef.current = map;
    } else {
      mapInstanceRef.current.setView([userLocation.lat, userLocation.lon], 12);
    }

    return () => {
      // Keep instance or cleanup on unmount
    };
  }, [userLocation]);

  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;

    markersGroupRef.current.clearLayers();

    if (results.length === 0) return;

    const bounds = L.latLngBounds([[userLocation.lat, userLocation.lon]]);

    results.forEach((item) => {
      const { facility, status, quantity, medicine_name, strength, distance_km, last_updated_text } = item;
      const pos: [number, number] = [facility.latitude, facility.longitude];
      bounds.extend(pos);

      // Color mapping
      let color = '#10b981'; // Green (Available)
      let label = 'AVAILABLE';
      let iconEmoji = '🟢';

      if (status === 'LOW_STOCK') {
        color = '#f59e0b'; // Amber
        label = 'LOW STOCK';
        iconEmoji = '🟡';
      } else if (status === 'OUT_OF_STOCK') {
        color = '#ef4444'; // Red
        label = 'OUT OF STOCK';
        iconEmoji = '🔴';
      }

      const markerHtml = `
        <div style="
          background: ${color};
          color: white;
          padding: 5px 10px;
          border-radius: 9999px;
          font-weight: 800;
          font-size: 11px;
          font-family: system-ui, -apple-system, sans-serif;
          box-shadow: 0 4px 14px ${color}80;
          border: 2px solid white;
          display: flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
          cursor: pointer;
        ">
          <span>${iconEmoji} ${label}</span>
          <span style="background:rgba(255,255,255,0.25);padding:1px 6px;border-radius:8px;font-size:10px;">${distance_km.toFixed(1)} km</span>
        </div>
      `;

      const customIcon = L.divIcon({
        className: '',
        html: markerHtml,
        iconSize: [120, 32],
        iconAnchor: [60, 16],
      });

      const marker = L.marker(pos, { icon: customIcon }).addTo(markersGroupRef.current!);

      const popupContent = `
        <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 220px; padding: 4px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
            <span style="font-size: 11px; font-weight: 800; color: ${color}; background: ${color}20; padding: 2px 8px; border-radius: 9999px;">
              ${label} • ${quantity} units
            </span>
            <span style="font-size: 11px; font-weight: 700; color: #475569;">${distance_km.toFixed(1)} km</span>
          </div>
          <h4 style="margin: 4px 0 2px 0; font-size: 14px; font-weight: 800; color: #0f172a;">${facility.name}</h4>
          <p style="margin: 0 0 6px 0; font-size: 11px; color: #64748b;">${facility.type} • ${facility.city || 'Mumbai'}</p>
          
          <div style="padding: 6px 8px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 8px; font-size: 11px;">
            <b>💊 ${medicine_name} ${strength}</b><br/>
            <span style="color: #64748b; font-size: 10px;">🕒 Updated: ${last_updated_text}</span>
          </div>

          <div style="display:flex; gap: 6px;">
            <a 
              href="https://www.google.com/maps/dir/?api=1&destination=${facility.latitude},${facility.longitude}" 
              target="_blank" 
              rel="noreferrer"
              style="flex: 1; text-align: center; background: #2563eb; color: white; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; text-decoration: none;"
            >
              🧭 Get Directions
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.on('click', () => {
        if (onSelectFacility) onSelectFacility(item);
      });
    });

    try {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    } catch (e) {
      console.warn("Could not fit map bounds", e);
    }
  }, [results, userLocation, onSelectFacility]);

  return (
    <div className="relative w-full h-[520px] rounded-3xl overflow-hidden border border-[var(--border-main)] shadow-xl z-0">
      <div ref={mapContainerRef} className="w-full h-full" />
      
      {/* Legend Overlay */}
      <div className="absolute top-3 right-3 z-[1000] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg text-xs space-y-1.5 pointer-events-none sm:pointer-events-auto">
        <p className="font-extrabold uppercase tracking-wider text-[10px] text-slate-400">Stock Availability</p>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">Available (&gt; min)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">Low Stock (&le; min)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">Out of Stock (0 units)</span>
        </div>
      </div>
    </div>
  );
}
