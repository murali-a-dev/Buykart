import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MaterialIcon from '../common/MaterialIcon';

/**
 * Fully responsive Amazon-style "Choose on Map" location picker modal.
 * Adapts seamlessly across Mobile, Tablet, and Desktop.
 * Ensures action buttons (Cancel & Confirm Location) are always visible and pinned.
 */
const MapLocationPickerModal = ({
  isOpen,
  onClose,
  initialMapUrl = '',
  onConfirmLocation,
  title = 'Choose Delivery Address on Map',
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const geocodeTimeoutRef = useRef(null);

  // Default fallback: Tamil Nadu / Chennai coordinates
  const defaultCoords = { lat: 13.0827, lng: 80.2707 };
  const [coords, setCoords] = useState(defaultCoords);
  const [isMoving, setIsMoving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [detectedAddress, setDetectedAddress] = useState('');
  const [detectedPincode, setDetectedPincode] = useState('');
  const [detectedLandmark, setDetectedLandmark] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [geoError, setGeoError] = useState('');

  // Extract lat, lng from existing mapUrl if available
  const parseCoordinatesFromUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    const qMatch = url.match(/[?&]q=([-\d.]+),([-\d.]+)/);
    if (qMatch) {
      const lat = parseFloat(qMatch[1]);
      const lng = parseFloat(qMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
    const llMatch = url.match(/@([-\d.]+),([-\d.]+)/);
    if (llMatch) {
      const lat = parseFloat(llMatch[1]);
      const lng = parseFloat(llMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
    return null;
  };

  // Reverse geocode via Nominatim
  const reverseGeocode = async (lat, lng) => {
    setIsGeocoding(true);
    setGeoError('');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          setDetectedAddress(data.display_name);
          const addr = data.address || {};
          const pincode = addr.postcode || '';
          if (pincode) setDetectedPincode(pincode);

          const landmarkParts = [
            addr.neighbourhood || addr.suburb || addr.residential,
            addr.road,
            addr.city || addr.town || addr.village,
          ].filter(Boolean);
          if (landmarkParts.length > 0) {
            setDetectedLandmark(landmarkParts.slice(0, 2).join(', '));
          }
        }
      }
    } catch (err) {
      console.warn('Reverse geocoding error:', err);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!isOpen) return;

    let initialPos = defaultCoords;
    const parsed = parseCoordinatesFromUrl(initialMapUrl);
    if (parsed) {
      initialPos = parsed;
    }

    setCoords(initialPos);

    let handleResize = null;

    const initTimer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      // Clean up previous instance if any
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [initialPos.lat, initialPos.lng],
        zoom: 16,
        zoomControl: false,
      });

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // Add Zoom control on top-right (below search bar)
      L.control.zoom({ position: 'topright' }).addTo(map);

      mapInstanceRef.current = map;

      // Responsive resize listener
      handleResize = () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      };
      window.addEventListener('resize', handleResize);

      // Handle map movements
      map.on('movestart', () => {
        setIsMoving(true);
      });

      map.on('move', () => {
        const center = map.getCenter();
        setCoords({ lat: center.lat, lng: center.lng });
      });

      map.on('moveend', () => {
        setIsMoving(false);
        const center = map.getCenter();
        const curLat = center.lat;
        const curLng = center.lng;
        setCoords({ lat: curLat, lng: curLng });

        // Debounce reverse geocode
        if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
        geocodeTimeoutRef.current = setTimeout(() => {
          reverseGeocode(curLat, curLng);
        }, 500);
      });

      // Allow click to center
      map.on('click', (e) => {
        map.panTo(e.latlng);
      });

      // Force recalculate dimensions multiple times during modal transition
      map.invalidateSize();
      setTimeout(() => map.invalidateSize(), 300);

      // Trigger initial reverse geocode
      reverseGeocode(initialPos.lat, initialPos.lng);

      // If no initial mapUrl provided, attempt quick GPS auto-center
      if (!parsed && navigator.geolocation) {
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setIsLocating(false);
            const { latitude, longitude } = pos.coords;
            if (mapInstanceRef.current) {
              mapInstanceRef.current.flyTo([latitude, longitude], 17, { duration: 1 });
            }
          },
          () => {
            setIsLocating(false);
          },
          { timeout: 7000, enableHighAccuracy: true }
        );
      }
    }, 150);

    return () => {
      clearTimeout(initTimer);
      if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
      if (handleResize) window.removeEventListener('resize', handleResize);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen]);

  // Handle GPS "Locate Me" button
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setGeoError('GPS is not supported by your browser.');
      return;
    }
    setGeoError('');
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 17, { duration: 1.2 });
        }
      },
      (err) => {
        setIsLocating(false);
        setGeoError(err.message || 'Unable to access your GPS position. Please check location permissions.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Handle Search Places
  const handleSearchPlaces = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    setGeoError('');

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=5&countrycodes=in`,
        {
          headers: { 'Accept-Language': 'en' },
        }
      );
      if (res.ok) {
        const list = await res.json();
        setSearchResults(list || []);
        if (list.length === 0) {
          setGeoError('No places found. Try typing street, landmark or area name.');
        } else if (list.length === 1) {
          selectSearchResult(list[0]);
        }
      }
    } catch (err) {
      setGeoError('Search failed. Please try again or drag the pin.');
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    if (!isNaN(lat) && !isNaN(lng)) {
      setCoords({ lat, lng });
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([lat, lng], 17, { duration: 1 });
      }
      setSearchResults([]);
      setSearchQuery(item.display_name.split(',')[0] || '');
    }
  };

  // Confirm and return location data
  const handleConfirm = () => {
    const googleMapsUrl = `https://maps.google.com/?q=${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`;
    if (onConfirmLocation) {
      onConfirmLocation({
        mapUrl: googleMapsUrl,
        lat: coords.lat,
        lng: coords.lng,
        formattedAddress: detectedAddress,
        pincode: detectedPincode,
        landmark: detectedLandmark,
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      
      {/* Responsive Modal Container: Fullscreen on mobile, rounded high-res dialog on tablet/desktop */}
      <div className="relative w-full h-full sm:h-[88vh] sm:max-h-[740px] sm:max-w-3xl lg:max-w-4xl bg-white sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200/80">
        
        {/* Header (Amazon style) */}
        <div className="px-3.5 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 flex items-center justify-between bg-white z-10 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-50 text-[#0D4715] flex items-center justify-center shrink-0">
              <MaterialIcon name="place" size={20} className="sm:text-[24px]" filled />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
                {title}
              </h3>
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate hidden xs:block">
                Move map or pin to pinpoint your delivery address
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0 ml-2"
            title="Close"
          >
            <MaterialIcon name="close" size={18} className="sm:text-[20px]" />
          </button>
        </div>

        {/* Map Body Area (flex-1 min-h-0 ensures map flexes to available height without pushing footer out) */}
        <div className="relative flex-1 min-h-0 w-full bg-slate-100 overflow-hidden">
          
          {/* Search bar inside map */}
          <div className="absolute top-2.5 left-2.5 right-2.5 sm:top-3.5 sm:left-4 sm:right-16 z-1000 max-w-lg">
            <form onSubmit={handleSearchPlaces} className="relative shadow-md sm:shadow-lg rounded-2xl">
              <div className="relative flex items-center bg-white rounded-2xl border border-slate-200 focus-within:border-[#0D4715] focus-within:ring-2 focus-within:ring-emerald-100 transition overflow-hidden">
                <MaterialIcon name="search" size={18} className="ml-3 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search area, landmark or street..."
                  className="w-full px-2.5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 mr-1"
                  >
                    <MaterialIcon name="close" size={16} />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-3 sm:px-4 py-2 sm:py-2.5 bg-[#0D4715] hover:bg-[#1b5e20] text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-60 shrink-0"
                >
                  {isSearching ? (
                    <MaterialIcon name="progress_activity" size={15} className="animate-spin" />
                  ) : (
                    <span>Search</span>
                  )}
                </button>
              </div>
            </form>

            {/* Search Dropdown Results */}
            {searchResults.length > 0 && (
              <div className="mt-1 bg-white rounded-2xl shadow-xl border border-slate-100 divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {searchResults.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectSearchResult(item)}
                    className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 flex items-start gap-2 transition text-xs cursor-pointer"
                  >
                    <MaterialIcon name="location_on" size={15} className="text-[#0D4715] mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{item.display_name.split(',')[0]}</p>
                      <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">{item.display_name}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Leaflet Map DOM Element */}
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Center Pin Overlay (Amazon/Swiggy Pin with float animation) */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-900">
            <div className="relative flex flex-col items-center">
              
              {/* Floating Pin Bubble Tooltip */}
              <div
                className={`mb-1 px-2.5 py-0.5 sm:px-3 sm:py-1 bg-slate-900/90 text-white rounded-full text-[10px] sm:text-[11px] font-bold shadow-lg transition-transform duration-200 whitespace-nowrap flex items-center gap-1.5 ${
                  isMoving ? 'scale-110 -translate-y-2 bg-[#0D4715]' : 'scale-100'
                }`}
              >
                <span>{isMoving ? 'Release to set pin' : 'Delivery Location'}</span>
              </div>

              {/* Pin Icon with Drop Bounce */}
              <div
                className={`transition-all duration-200 transform origin-bottom ${
                  isMoving ? '-translate-y-3 scale-110' : 'translate-y-0 scale-100'
                }`}
              >
                <div className="text-red-600 drop-shadow-[0_4px_8px_rgba(0,0,0,0.35)]">
                  <MaterialIcon name="location_on" size={38} className="sm:text-[46px]" filled />
                </div>
              </div>

              {/* Pulse Shadow at the tip */}
              <div
                className={`w-3 h-1 sm:w-3.5 sm:h-1.5 bg-black/35 rounded-full transition-all duration-200 ${
                  isMoving ? 'scale-50 opacity-30' : 'scale-100 opacity-60'
                }`}
              />
            </div>
          </div>

          {/* Floating "Use Current Location" GPS Button (Amazon style) */}
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocating}
            className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-1000 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-white hover:bg-slate-50 text-slate-800 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200 flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold transition hover:shadow-2xl cursor-pointer disabled:opacity-60"
          >
            <MaterialIcon
              name="my_location"
              size={16}
              className={`text-[#0D4715] ${isLocating ? 'animate-spin' : ''}`}
            />
            <span>{isLocating ? 'Locating...' : 'Use Current Location'}</span>
          </button>
        </div>

        {/* Error notification banner if any */}
        {geoError && (
          <div className="px-4 py-1.5 bg-amber-50 border-t border-amber-200 text-amber-800 text-[11px] sm:text-xs font-semibold flex items-center gap-2 shrink-0">
            <MaterialIcon name="warning" size={15} />
            <span className="truncate">{geoError}</span>
          </div>
        )}

        {/* Footer: Selected Location Details & Always-Visible Action Buttons */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200/80 shrink-0 space-y-2.5 sm:space-y-3 z-20 shadow-lg">
          
          {/* Address & Coordinates Card */}
          <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200/60">
            <div className="mt-0.5 text-[#0D4715] shrink-0">
              <MaterialIcon name="explore" size={18} className="sm:text-[20px]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Selected Location
                </span>
                <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-800 mt-0.5 line-clamp-2">
                {isGeocoding ? (
                  <span className="text-slate-400 font-normal italic flex items-center gap-1">
                    <MaterialIcon name="progress_activity" size={12} className="animate-spin" />
                    Fetching street address...
                  </span>
                ) : detectedAddress ? (
                  detectedAddress
                ) : (
                  'Move pin to pinpoint exact address'
                )}
              </p>
            </div>
          </div>

          {/* Action Buttons Row - ALWAYS FULLY VISIBLE & ACCESSIBLE */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 py-2.5 sm:py-3 bg-[#0D4715] hover:bg-[#1b5e20] text-white font-black text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <MaterialIcon name="check_circle" size={17} className="sm:text-[18px]" />
              <span>Confirm Location</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

export default MapLocationPickerModal;
