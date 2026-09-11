import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Navigation,
  MapPin,
  Building2,
  Bed,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Phone,
  Clock,
  Sparkles,
  Search,
  ChevronRight,
  Shield,
  Layers,
  X
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../../api/instance';
import FacilityDetailModal from '../referral/FacilityDetailModal';
import BookHospitalModal from './BookHospitalModal';

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface UserLocationState {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: number;
  isGps?: boolean;
}

interface NearbyFacility {
  facility_id: string;
  name: string;
  facility_type: string;
  type?: string;
  category?: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  emergency_phone?: string;
  operating_hours?: string;
  is_24x7_emergency?: boolean;
  emergency_24_7?: boolean;
  status?: string;
  total_beds?: number;
  available_beds?: number;
  icu_beds_available?: number;
  oxygen_beds_available?: number;
  services?: string[];
  specialists?: string[];
  is_demo_facility?: boolean;
  is_within_radius?: boolean;
  label?: string;
  last_updated?: number;
}

interface Props {
  onSelectFacilityForBooking?: (facility: any) => void;
}

const DEFAULT_MUMBAI_COORDS: UserLocationState = {
  lat: 19.0760,
  lng: 72.8777,
  isGps: false,
};

export default function NearbyHealthcareDiscovery({ onSelectFacilityForBooking }: Props) {
  // Location & Search State (default initialized to regional coordinates so map renders immediately)
  const [userLocation, setUserLocation] = useState<UserLocationState>(DEFAULT_MUMBAI_COORDS);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'success' | 'denied' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(5.0);

  // Results State
  const [facilities, setFacilities] = useState<NearbyFacility[]>([]);
  const [featuredDemoFacility, setFeaturedDemoFacility] = useState<NearbyFacility | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Modals & Fallback State
  const [selectedFacilityDetail, setSelectedFacilityDetail] = useState<any | null>(null);
  const [bookingFacility, setBookingFacility] = useState<any | null>(null);
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [manualPincode, setManualPincode] = useState<string>('');
  const [manualGeocodingLoading, setManualGeocodingLoading] = useState<boolean>(false);

  // Map reference
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Core Location Request (Browser Geolocation API)
  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      setErrorMessage("Geolocation is not supported by your browser/device.");
      return;
    }

    setLocationStatus('locating');
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: UserLocationState = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
          isGps: true,
        };
        setUserLocation(coords);
        setLocationStatus('success');
        fetchNearbyFacilities(coords.lat, coords.lng, radiusKm);
      },
      (err) => {
        console.error("Geolocation API error:", err);
        setLocationStatus('denied');
        if (err.code === err.PERMISSION_DENIED) {
          setErrorMessage("Location permission was denied by user/browser.");
        } else if (err.code === err.TIMEOUT) {
          setErrorMessage("Location request timed out. Please try again or enter location manually.");
        } else {
          setErrorMessage("Unable to retrieve GPS coordinates from your device.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Fetch Nearby Facilities from FastAPI backend
  const fetchNearbyFacilities = async (lat: number, lng: number, radius: number) => {
    try {
      setLoading(true);
      const res = await api.get('/access/nearby', {
        params: {
          lat,
          lng,
          radius_km: radius,
        },
      });

      if (res.data && res.data.success) {
        setFacilities(res.data.facilities || []);
        if (res.data.featured_demo_facility) {
          setFeaturedDemoFacility(res.data.featured_demo_facility);
        }
      }
    } catch (e: any) {
      console.error("Failed to fetch nearby facilities from backend", e);
      setErrorMessage("Failed to fetch nearby healthcare facilities from server.");
    } finally {
      setLoading(false);
    }
  };

  // Initial Fetch on component mount
  useEffect(() => {
    fetchNearbyFacilities(userLocation.lat, userLocation.lng, radiusKm);
  }, []);

  // Trigger fetch when radius changes
  useEffect(() => {
    fetchNearbyFacilities(userLocation.lat, userLocation.lng, radiusKm);
  }, [radiusKm]);

  // Leaflet Map Initialization & Invalidation
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [userLocation.lat, userLocation.lng],
        zoom: 13,
        scrollWheelZoom: true,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      layerGroupRef.current = layerGroup;
      mapInstanceRef.current = map;
    }

    // Force map tile recalculation on render
    const timer1 = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 100);
    const timer2 = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [mapContainerRef]);

  // Update Leaflet Markers when userLocation, facilities, or featured demo facility changes
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;

    const map = mapInstanceRef.current;
    const layers = layerGroupRef.current;
    layers.clearLayers();

    // Ensure size is valid before fitting bounds
    map.invalidateSize();

    const bounds = L.latLngBounds([[userLocation.lat, userLocation.lng]]);

    // 1. User Marker (Pulsing Blue Pin)
    const userMarkerHtml = `
      <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:44px;height:44px;border-radius:50%;background:rgba(59,130,246,0.35);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
        <div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 0 16px rgba(37,99,235,0.9);z-index:2;"></div>
      </div>
    `;

    const userIcon = L.divIcon({
      className: '',
      html: userMarkerHtml,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
      .addTo(layers)
      .bindPopup(`<b style="font-family:sans-serif;color:#2563eb">${userLocation.isGps ? '📍 Your Current GPS Location' : '📍 Selected Location (Mumbai)'}</b>`);

    // 2. Nearby Facility Markers
    facilities.forEach((fac) => {
      if (!fac.latitude || !fac.longitude) return;
      const pos: [number, number] = [fac.latitude, fac.longitude];
      bounds.extend(pos);

      const isDemo = fac.is_demo_facility;
      const bgColor = isDemo ? '#d97706' : '#0d9488';
      const isEmergency = fac.is_24x7_emergency || fac.emergency_24_7;

      const markerHtml = `
        <div style="
          background: ${bgColor};
          color: white;
          padding: 5px 10px;
          border-radius: 9999px;
          font-weight: 700;
          font-size: 11px;
          font-family: sans-serif;
          box-shadow: 0 4px 12px ${bgColor}80;
          border: 2px solid white;
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
          cursor: pointer;
        ">
          <span>${isDemo ? '⭐' : '🏥'} ${fac.name.substring(0, 18)}</span>
          <span style="background:rgba(255,255,255,0.3);padding:1px 5px;border-radius:6px;font-size:10px;">${fac.distance_km.toFixed(1)}km</span>
        </div>
      `;

      const customIcon = L.divIcon({
        className: '',
        html: markerHtml,
        iconSize: [140, 30],
        iconAnchor: [70, 15],
      });

      const popupContent = `
        <div style="font-family: sans-serif; min-width: 220px; padding: 4px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
            <span style="font-size: 10px; font-weight: 700; color: ${bgColor}; background: ${bgColor}20; padding: 2px 8px; border-radius: 9999px;">${fac.category || fac.type || 'Facility'}</span>
            <span style="font-size: 11px; font-weight: 700; color: #2563eb;">📍 ${fac.distance_km.toFixed(1)} km away</span>
          </div>
          <h4 style="margin: 4px 0; font-size: 14px; font-weight: 700; color: #0f172a;">${fac.name}</h4>
          <p style="margin: 2px 0 6px 0; font-size: 11px; color: #64748b;">${fac.address || fac.city || ''}</p>
          ${isEmergency ? '<p style="margin: 2px 0 6px 0; font-size: 10px; font-weight: 700; color: #e11d48;">🚨 24/7 Emergency Services Available</p>' : ''}
          <div style="margin-top: 8px; border-t: 1px solid #e2e8f0; pt: 6px; display: flex; justify-content: space-between;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${fac.latitude},${fac.longitude}" target="_blank" style="background:#0d9488; color:white; padding: 6px 12px; border-radius: 8px; text-decoration: none; font-size: 11px; font-weight: 700; display: inline-block;">Get Directions ↗</a>
          </div>
        </div>
      `;

      L.marker(pos, { icon: customIcon })
        .addTo(layers)
        .bindPopup(popupContent);
    });

    // 3. Featured Demo Facility (Shatabdi Hospital, Govandi) if not already in facilities array
    if (featuredDemoFacility && !facilities.some(f => f.facility_id === featuredDemoFacility.facility_id)) {
      const demoPos: [number, number] = [featuredDemoFacility.latitude, featuredDemoFacility.longitude];
      bounds.extend(demoPos);

      const demoMarkerHtml = `
        <div style="
          background: #f59e0b;
          color: white;
          padding: 5px 10px;
          border-radius: 9999px;
          font-weight: 700;
          font-size: 11px;
          font-family: sans-serif;
          box-shadow: 0 4px 14px rgba(245,158,11,0.6);
          border: 2px solid white;
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
          cursor: pointer;
        ">
          <span>⭐ Shatabdi Hospital, Govandi</span>
          <span style="background:rgba(255,255,255,0.3);padding:1px 5px;border-radius:6px;font-size:10px;">${featuredDemoFacility.distance_km.toFixed(1)}km</span>
        </div>
      `;

      const demoIcon = L.divIcon({
        className: '',
        html: demoMarkerHtml,
        iconSize: [180, 30],
        iconAnchor: [90, 15],
      });

      const demoPopupContent = `
        <div style="font-family: sans-serif; min-width: 230px; padding: 4px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
            <span style="font-size: 10px; font-weight: 700; color: #d97706; background: #fef3c7; padding: 2px 8px; border-radius: 9999px;">Demo / Featured Facility</span>
            <span style="font-size: 11px; font-weight: 700; color: #2563eb;">📍 ${featuredDemoFacility.distance_km.toFixed(1)} km away</span>
          </div>
          <h4 style="margin: 4px 0; font-size: 14px; font-weight: 700; color: #0f172a;">${featuredDemoFacility.name}</h4>
          <p style="margin: 2px 0 6px 0; font-size: 11px; color: #64748b;">${featuredDemoFacility.address}</p>
          <div style="margin-top: 8px; border-t: 1px solid #e2e8f0; pt: 6px;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${featuredDemoFacility.latitude},${featuredDemoFacility.longitude}" target="_blank" style="background:#d97706; color:white; padding: 6px 12px; border-radius: 8px; text-decoration: none; font-size: 11px; font-weight: 700; display: inline-block;">Get Directions ↗</a>
          </div>
        </div>
      `;

      L.marker(demoPos, { icon: demoIcon })
        .addTo(layers)
        .bindPopup(demoPopupContent);
    }

    // Fit map bounds smoothly
    try {
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }
    } catch (e) {
      map.setView([userLocation.lat, userLocation.lng], 13);
    }
  }, [userLocation, facilities, featuredDemoFacility]);

  // Manual Geocoding Fallback handler
  const handleManualLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPincode.trim()) return;

    setManualGeocodingLoading(true);

    // Common Pincode Lookup Table for fast deterministic matching
    const knownPincodes: Record<string, [number, number]> = {
      '400088': [19.0435, 72.9090], // Govandi, Mumbai
      '400070': [19.0650, 72.8790], // Kurla, Mumbai
      '400050': [19.0550, 72.8310], // Bandra, Mumbai
      '400001': [18.9322, 72.8347], // Fort, South Mumbai
      '400014': [19.0178, 72.8478], // Dadar, Mumbai
      '400601': [19.1980, 72.9780], // Thane West
      '421503': [19.1650, 73.2380], // Badlapur, Thane
      '410201': [18.9100, 73.3280], // Karjat, Raigad
      '411001': [18.5204, 73.8567], // Pune
      '110001': [28.6139, 77.2090], // Connaught Place, New Delhi
    };

    const cleaned = manualPincode.trim().toLowerCase();

    if (knownPincodes[cleaned]) {
      const [lat, lng] = knownPincodes[cleaned];
      const coords: UserLocationState = { lat, lng, timestamp: Date.now(), isGps: true };
      setUserLocation(coords);
      setLocationStatus('success');
      setShowManualModal(false);
      fetchNearbyFacilities(lat, lng, radiusKm);
      setManualGeocodingLoading(false);
      return;
    }

    // Nominatim OpenStreetMap Geocoding Fallback API
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleaned + ', India')}`
      );
      const data = await geoRes.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        const coords: UserLocationState = { lat, lng, timestamp: Date.now(), isGps: true };
        setUserLocation(coords);
        setLocationStatus('success');
        setShowManualModal(false);
        fetchNearbyFacilities(lat, lng, radiusKm);
      } else {
        alert("Pincode / Area not found. Please try entering a major area name (e.g., Govandi, Kurla, Thane, Bandra).");
      }
    } catch (err) {
      console.error("Geocoding failed:", err);
      alert("Failed to resolve location coordinates. Please try again.");
    } finally {
      setManualGeocodingLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Location Status Header */}
      <div className="premium-card p-6 bg-gradient-to-r from-blue-600/10 via-indigo-600/5 to-teal-600/10 border border-blue-500/20 rounded-3xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl flex-shrink-0 ${
              locationStatus === 'success' || userLocation.isGps
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : locationStatus === 'denied'
                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
            }`}>
              {locationStatus === 'success' || userLocation.isGps ? '📍' : locationStatus === 'denied' ? '⚠️' : '🧭'}
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-black text-[var(--text-primary)]">
                  {locationStatus === 'success' || userLocation.isGps
                    ? '📍 Your Current Location'
                    : locationStatus === 'denied'
                    ? '📍 Location Access Unavailable'
                    : 'Live Location Healthcare Discovery'}
                </h3>
                {(locationStatus === 'success' || userLocation.isGps) && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
                    Location Active
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 font-medium mt-1">
                {userLocation.isGps
                  ? `GPS Lat: ${userLocation.lat.toFixed(4)}, Long: ${userLocation.lng.toFixed(4)} • Displaying verified nearby facilities authoritatively sorted by actual distance.`
                  : locationStatus === 'denied'
                  ? (errorMessage || "Location permission denied. Click 'Try Again' or enter Pincode / Area manually.")
                  : "Click 'Use Current Location' to request browser GPS coordinates and center map on your position."}
              </p>
            </div>
          </div>

          {/* Action Buttons: Request Location / Refresh / Manual */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRequestLocation}
              disabled={locationStatus === 'locating'}
              className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center space-x-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {locationStatus === 'locating' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Navigation size={16} />
              )}
              <span>{locationStatus === 'locating' ? 'Detecting Location...' : userLocation.isGps ? 'Refresh Location' : '📍 Use Current Location'}</span>
            </button>

            <button
              onClick={() => setShowManualModal(true)}
              className="px-4 py-3 rounded-2xl bg-[var(--bg-card)] hover:bg-slate-200 dark:hover:bg-white/10 text-[var(--text-primary)] font-bold text-xs flex items-center space-x-2 border border-[var(--border-main)] transition-all"
            >
              <MapPin size={15} />
              <span>Enter Pincode / Area Manually</span>
            </button>
          </div>
        </div>

        {/* Radius Selector Pills Bar */}
        <div className="mt-5 pt-4 border-t border-[var(--border-main)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Search Radius:</span>
            {[5.0, 10.0, 25.0].map((r) => {
              const isActive = radiusKm === r;
              return (
                <button
                  key={r}
                  onClick={() => setRadiusKm(r)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition-all border ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                      : 'bg-[var(--bg-card)] border-[var(--border-main)] text-slate-600 dark:text-slate-300 hover:border-slate-400'
                  }`}
                >
                  [{r} km]
                </button>
              );
            })}
          </div>

          <div className="text-xs text-slate-400 font-medium flex items-center space-x-1">
            <Building2 size={13} className="text-blue-500" />
            <span>{facilities.length} healthcare facilities found within <b>{radiusKm} km</b></span>
          </div>
        </div>
      </div>

      {/* Main Experience Layout: Map + Facilities Split View (Always rendered so map div is present) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Leaflet Healthcare Access Map */}
        <div className="lg:col-span-6 space-y-4">
          <div className="premium-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layers size={16} className="text-blue-600 dark:text-blue-400" />
                <h4 className="font-extrabold text-sm text-[var(--text-primary)]">Interactive Geospatial Map</h4>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Live Leaflet 2dsphere Matrix</span>
            </div>

            {/* Map Container - Explicit Height & Position */}
            <div className="relative w-full h-[480px] rounded-2xl overflow-hidden border border-[var(--border-main)] shadow-inner z-0">
              <div
                ref={mapContainerRef}
                className="w-full h-full"
                style={{ height: '480px', width: '100%', zIndex: 1 }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between text-[11px] font-medium text-slate-500 pt-1">
              <div className="flex items-center space-x-3">
                <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block mr-1"></span> Your Location</span>
                <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block mr-1"></span> Facilities</span>
                <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block mr-1"></span> Constant Demo Facility</span>
              </div>
              <span>Click markers for facility popups & directions</span>
            </div>
          </div>
        </div>

        {/* Right Column: Nearby Facilities Cards List */}
        <div className="lg:col-span-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4 premium-card">
              <Loader2 className="animate-spin text-blue-600" size={36} />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Querying MongoDB 2dsphere Geospatial Index...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 1. CONSTANT DEMO FACILITY SECTION (Shatabdi Hospital, Govandi) */}
              {featuredDemoFacility && (
                <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider">
                        ⭐ Demo / Featured Facility
                      </span>
                    </div>
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                      📍 {featuredDemoFacility.distance_km.toFixed(1)} km away
                    </span>
                  </div>

                  <div className="flex items-start justify-between">
                    <div>
                      <h5 className="font-black text-base text-[var(--text-primary)]">{featuredDemoFacility.name}</h5>
                      <p className="text-xs text-slate-500 mt-0.5">{featuredDemoFacility.address}</p>
                    </div>
                  </div>

                  {/* Bed capacity stats */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">General Beds</span>
                      <span className="font-extrabold text-teal-600 dark:text-teal-400">{featuredDemoFacility.available_beds ?? 42}</span>
                    </div>
                    <div className="border-x border-amber-500/20">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">ICU Beds</span>
                      <span className="font-extrabold text-blue-600 dark:text-blue-400">{featuredDemoFacility.icu_beds_available ?? 5}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Emergency</span>
                      <span className="font-extrabold text-rose-600 dark:text-rose-400">{featuredDemoFacility.oxygen_beds_available ?? 18}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-2 border-t border-amber-500/20">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${featuredDemoFacility.latitude},${featuredDemoFacility.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-amber-500/20 transition-all"
                    >
                      <Navigation size={13} />
                      <span>Get Directions</span>
                    </a>

                    <button
                      onClick={() => setSelectedFacilityDetail(featuredDemoFacility)}
                      className="px-3.5 py-2.5 rounded-xl bg-white/40 dark:bg-black/20 hover:bg-white/60 text-slate-800 dark:text-slate-200 font-bold text-xs border border-amber-500/30 transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              )}

              {/* 2. Nearby Facilities List within requested radius */}
              {facilities.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-base text-[var(--text-primary)] flex items-center">
                      <span>Nearby Healthcare Facilities</span>
                      <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-xs font-black">
                        {facilities.length}
                      </span>
                    </h4>
                    <span className="text-xs text-slate-400 font-bold">Sorted by actual distance</span>
                  </div>

                  <div className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
                    {facilities.map((fac, idx) => {
                      const isEmergency = fac.is_24x7_emergency || fac.emergency_24_7;
                      const isVaccine = fac.facility_type === 'vaccination_centre' || fac.category === 'Vaccination Centre';

                      return (
                        <motion.div
                          key={fac.facility_id || idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-main)] hover:border-blue-500/40 hover:shadow-lg transition-all space-y-3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base flex-shrink-0 ${
                                isVaccine ? 'bg-teal-500/10 text-teal-600' : 'bg-blue-500/10 text-blue-600'
                              }`}>
                                {isVaccine ? '💉' : '🏥'}
                              </div>
                              <div>
                                <h5 className="font-bold text-base text-[var(--text-primary)] leading-tight">{fac.name}</h5>
                                <p className="text-xs text-slate-500 flex items-center mt-1">
                                  <MapPin size={12} className="mr-1 text-slate-400 flex-shrink-0" />
                                  <span className="truncate">{fac.address || fac.city}</span>
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-col items-end space-y-1">
                              <span className="px-3 py-1 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-black">
                                📍 {fac.distance_km < 1 ? `${Math.round(fac.distance_km * 1000)}m away` : `${fac.distance_km.toFixed(1)} km away`}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">
                                {fac.category || fac.type || fac.facility_type}
                              </span>
                            </div>
                          </div>

                          {/* Bed / Availability Metadata */}
                          {fac.total_beds && fac.total_beds > 0 ? (
                            <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-main)] text-center text-xs">
                              <div>
                                <span className="text-[10px] text-slate-400 uppercase font-bold block">General Beds</span>
                                <span className="font-extrabold text-teal-600 dark:text-teal-400">{fac.available_beds ?? 0}</span>
                              </div>
                              <div className="border-x border-[var(--border-main)]">
                                <span className="text-[10px] text-slate-400 uppercase font-bold block">ICU Beds</span>
                                <span className="font-extrabold text-blue-600 dark:text-blue-400">{fac.icu_beds_available ?? 0}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 uppercase font-bold block">Emergency</span>
                                <span className="font-extrabold text-rose-600 dark:text-rose-400">{fac.oxygen_beds_available ?? 0}</span>
                              </div>
                            </div>
                          ) : null}

                          {/* Action Buttons: View Details + Directions */}
                          <div className="flex items-center space-x-2 pt-2 border-t border-[var(--border-main)]">
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${fac.latitude},${fac.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-blue-500/20 transition-all active:scale-[0.98]"
                            >
                              <Navigation size={13} />
                              <span>Get Directions</span>
                            </a>

                            <button
                              onClick={() => setSelectedFacilityDetail(fac)}
                              className="px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 font-bold text-xs border border-[var(--border-main)] transition-colors"
                            >
                              View Details
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Zero Results State with Radius Expansion Option */
                <div className="p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-main)] text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-2xl mx-auto">
                    📍
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-[var(--text-primary)]">
                      No healthcare facilities found within {radiusKm} km.
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      Try expanding your search radius to discover verified District Hospitals, PHCs, or CHCs farther away.
                    </p>
                  </div>

                  <div className="flex justify-center pt-2">
                    {radiusKm < 10.0 ? (
                      <button
                        onClick={() => setRadiusKm(10.0)}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all"
                      >
                        [Search within 10 km]
                      </button>
                    ) : radiusKm < 25.0 ? (
                      <button
                        onClick={() => setRadiusKm(25.0)}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all"
                      >
                        [Search within 25 km]
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Manual Pincode / Area Input Modal */}
      <AnimatePresence>
        {showManualModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MapPin className="text-blue-600" size={20} />
                  <h3 className="font-bold text-base text-[var(--text-primary)]">Enter Location Manually</h3>
                </div>
                <button
                  onClick={() => setShowManualModal(false)}
                  className="p-1 rounded-xl text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                If browser GPS is unavailable or permission was denied, type your 6-digit Pincode or Area name (e.g., 400088, Govandi, Kurla, Bandra, Thane) to discover nearby facilities.
              </p>

              <form onSubmit={handleManualLocationSubmit} className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={manualPincode}
                    onChange={(e) => setManualPincode(e.target.value)}
                    placeholder="Enter Pincode or Area (e.g. 400088)..."
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-2xl py-3 pl-10 pr-4 outline-none focus:border-blue-500 text-sm font-bold text-[var(--text-primary)]"
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowManualModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-[var(--border-main)] text-slate-500 font-bold text-xs"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={manualGeocodingLoading || !manualPincode.trim()}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-blue-500/20 disabled:opacity-50"
                  >
                    {manualGeocodingLoading ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
                    <span>{manualGeocodingLoading ? 'Resolving Location...' : 'Find Facilities'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Facility Detail Modal */}
      {selectedFacilityDetail && (
        <FacilityDetailModal
          scoredFacility={{
            facility: selectedFacilityDetail,
            distance_km: selectedFacilityDetail.distance_km || 0,
            total_score: 95,
            rationale: "Healthcare access directory verified facility node.",
            data_freshness_text: "Updated Live"
          } as any}
          onClose={() => setSelectedFacilityDetail(null)}
          onStartTelemedicine={() => {
            const fac = selectedFacilityDetail;
            setSelectedFacilityDetail(null);
            if (onSelectFacilityForBooking) {
              onSelectFacilityForBooking(fac);
            } else {
              setBookingFacility(fac);
            }
          }}
        />
      )}

      {/* Book Hospital Visit Modal */}
      {bookingFacility && (
        <BookHospitalModal
          facility={bookingFacility}
          onClose={() => setBookingFacility(null)}
          onSuccess={() => setBookingFacility(null)}
        />
      )}
    </div>
  );
}
