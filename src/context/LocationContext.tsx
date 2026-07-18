import React, { createContext, useContext, useState, useEffect } from 'react';
import { COUNTRIES } from '../constants';

interface Location {
  latitude: number;
  longitude: number;
}

interface Country {
  code: string;
  name: string;
  currency: string;
  symbol: string;
  flag: string;
}

interface LocationContextType {
  location: Location | null;
  selectedCountry: Country;
  setCountry: (code: string) => void;
  setLocation: (loc: Location) => void;
  requestLocation: () => Promise<void>;
  loading: boolean;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

// Default location (Maputo Center)
const DEFAULT_LOCATION = { latitude: -25.9692, longitude: 32.5732 };
const DEFAULT_COUNTRY = COUNTRIES[0]; // Mozambique

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState<Location | null>(null);
  const [selectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [loading, setLoading] = useState(true);

  const setCountry = (code: string) => {
    // Fixed for Mozambique
  };

  const requestLocation = async () => {
    setLoading(true);
    if (!navigator || !navigator.geolocation) {
      console.warn('Geolocation is not supported by your browser');
      setLocation(DEFAULT_LOCATION);
      setLoading(false);
      return;
    }

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setLoading(false);
        },
        (error) => {
          console.warn('Geolocation warning (falling back to default):', error.message || error);
          setLocation(DEFAULT_LOCATION);
          setLoading(false);
        },
        { timeout: 8000, enableHighAccuracy: false, maximumAge: 300000 } // 8 second timeout, standard accuracy, 5 min cache
      );
    } catch (err) {
      console.warn('Geolocation direct error (falling back to default):', err);
      setLocation(DEFAULT_LOCATION);
      setLoading(false);
    }
  };

  useEffect(() => {
    requestLocation();
  }, []);

  return (
    <LocationContext.Provider value={{ location, selectedCountry, setCountry, setLocation, requestLocation, loading }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
