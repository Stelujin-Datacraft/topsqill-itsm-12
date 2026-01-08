import React, { useState, useEffect, useRef } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Loader2, Map, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface GeoLocationFieldProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
  disabled?: boolean;
}

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  accuracy?: number;
  timestamp?: number;
}

export function GeoLocationField({ field, value, onChange, error, disabled }: GeoLocationFieldProps) {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(value || null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [manualCoords, setManualCoords] = useState({ lat: '', lng: '' });
  const [showMapModal, setShowMapModal] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const config = (field.customConfig as any) || {};

  useEffect(() => {
    if (value) {
      setCurrentLocation(value);
      setManualCoords({
        lat: value.latitude?.toString() || '',
        lng: value.longitude?.toString() || ''
      });
    }
  }, [value]);

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Your browser doesn't support geolocation.",
        variant: "destructive",
      });
      return;
    }

    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now(),
          };

          // Get address if enabled
          if (config.showAddress !== false) {
            const address = await reverseGeocode(locationData.latitude, locationData.longitude);
            locationData.address = address;
          }

          setCurrentLocation(locationData);
          if (onChange) {
            onChange(locationData);
          }

          toast({
            title: "Location captured",
            description: `Location captured with ${Math.round(position.coords.accuracy)}m accuracy.`,
          });
        } catch (error) {
          console.error('Error processing location:', error);
          toast({
            title: "Error",
            description: "Failed to process location data.",
            variant: "destructive",
          });
        } finally {
          setIsGettingLocation(false);
        }
      },
      (error) => {
        setIsGettingLocation(false);
        let message = "Failed to get location.";
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "Location access denied. Please enable location permissions.";
            break;
          case error.POSITION_UNAVAILABLE:
            message = "Location information unavailable.";
            break;
          case error.TIMEOUT:
            message = "Location request timed out.";
            break;
        }

        toast({
          title: "Location Error",
          description: message,
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      // Using a simple reverse geocoding service (in production, use proper API)
      const response = await fetch(
        `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=demo&limit=1`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          return data.results[0].formatted;
        }
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }
    
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  const handleManualCoordinates = () => {
    const lat = parseFloat(manualCoords.lat);
    const lng = parseFloat(manualCoords.lng);

    if (isNaN(lat) || isNaN(lng)) {
      toast({
        title: "Invalid coordinates",
        description: "Please enter valid latitude and longitude values.",
        variant: "destructive",
      });
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast({
        title: "Invalid coordinates",
        description: "Latitude must be between -90 and 90, longitude between -180 and 180.",
        variant: "destructive",
      });
      return;
    }

    const locationData: LocationData = {
      latitude: lat,
      longitude: lng,
      timestamp: Date.now(),
    };

    setCurrentLocation(locationData);
    if (onChange) {
      onChange(locationData);
    }
  };

  const openMapModal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMapModal(true);
  };

  // Initialize map when modal opens
  useEffect(() => {
    if (showMapModal && mapContainerRef.current && currentLocation && !mapRef.current) {
      // Fix Leaflet default marker icon issue
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      mapRef.current = L.map(mapContainerRef.current).setView(
        [currentLocation.latitude, currentLocation.longitude],
        15
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapRef.current);

      L.marker([currentLocation.latitude, currentLocation.longitude])
        .addTo(mapRef.current)
        .bindPopup(`<b>Location</b><br>${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`)
        .openPopup();
    }

    return () => {
      if (!showMapModal && mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [showMapModal, currentLocation]);

  // Cleanup map when modal closes
  useEffect(() => {
    if (!showMapModal && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
  }, [showMapModal]);

  return (
    <div className="space-y-4">
      {currentLocation && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-800">Location Captured</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openMapModal}
              className="text-blue-600 border-blue-200"
            >
              <Map className="h-3 w-3 mr-1" />
              View on Map
            </Button>
          </div>
          
          <div className="space-y-1 text-sm">
            <p><strong>Coordinates:</strong> {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}</p>
            {currentLocation.address && (
              <p><strong>Address:</strong> {currentLocation.address}</p>
            )}
            {currentLocation.accuracy && (
              <p><strong>Accuracy:</strong> ±{Math.round(currentLocation.accuracy)} meters</p>
            )}
            {currentLocation.timestamp && (
              <p><strong>Captured:</strong> {new Date(currentLocation.timestamp).toLocaleString()}</p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {(config.inputMethod === 'gps' || config.inputMethod === 'all' || !config.inputMethod) && (
          <Button
            type="button"
            onClick={getCurrentLocation}
            disabled={disabled || isGettingLocation}
            className="w-full flex items-center justify-center space-x-2"
          >
            {isGettingLocation ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            <span>
              {isGettingLocation ? 'Getting Location...' : 'Get Current Location'}
            </span>
          </Button>
        )}

        {(config.inputMethod === 'coordinates' || config.inputMethod === 'all' || !config.inputMethod) && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Manual Coordinates</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Latitude"
                value={manualCoords.lat}
                onChange={(e) => setManualCoords(prev => ({ ...prev, lat: e.target.value }))}
                disabled={disabled}
                type="number"
                step="any"
                min="-90"
                max="90"
              />
              <Input
                placeholder="Longitude"
                value={manualCoords.lng}
                onChange={(e) => setManualCoords(prev => ({ ...prev, lng: e.target.value }))}
                disabled={disabled}
                type="number"
                step="any"
                min="-180"
                max="180"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleManualCoordinates}
              disabled={disabled || !manualCoords.lat || !manualCoords.lng}
              className="w-full"
            >
              Set Manual Coordinates
            </Button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Map Modal */}
      <Dialog open={showMapModal} onOpenChange={setShowMapModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location on Map
            </DialogTitle>
          </DialogHeader>
          <div 
            ref={mapContainerRef} 
            className="w-full h-[400px] rounded-lg border"
            style={{ zIndex: 0 }}
          />
          {currentLocation && (
            <div className="text-sm text-muted-foreground text-center">
              {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
              {currentLocation.address && ` • ${currentLocation.address}`}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}