/**
 * @file src/components/views/MapView.tsx
 * @description Widok główny modułu mapy klientów z markerami oddziałów i klientów
 */

"use client"

import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Building2, Users, Navigation, Circle, ListFilter } from 'lucide-react';
// Import useAuth hook to access user location data
import { useAuth } from '@/hooks/useAuth';
// Import User icon for user location marker
import { User } from 'lucide-react';
// Import ClientListView component from UI folder
import ClientListView from '@/components/ui/ClientListView';
import { Button } from '@/components/ui/button';
// Import mapboxgl type for proper typing
import mapboxgl from 'mapbox-gl';
// Import GeoJSON types
import { Feature, FeatureCollection, Geometry, GeoJsonProperties, Point } from 'geojson';

// Interfejs dla danych oddziału
interface Branch {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

// Interfejs dla danych klienta
interface Client {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  status_free: boolean;
  branch: string | null;
  rep: string | null;
}

// Interfejs dla wybranego elementu
interface SelectedItem {
  type: 'branch' | 'client';
  data: Branch | Client;
}

// Statyczne dane oddziałów
const BRANCHES: Branch[] = [
  {
    "id": "1", "name": "Rzgów", "address": "Łódzka 24, 95-030 Rzgów, Polska",
    "latitude": 51.681192, "longitude": 19.478963
  },
  {
    "id": "2", "name": "Lublin", "address": "Droga Męczenników Majdanka 74, 20-325 Lublin, Polska",
    "latitude": 51.225028, "longitude": 22.611582
  },
  {
    "id": "3", "name": "Pcim", "address": "Pcim 1493, 32-432 Pcim, Polska",
    "latitude": 49.74227, "longitude": 19.983263
  },
  {
    "id": "4", "name": "Malbork", "address": "Aleja Wojska Polskiego 473, 82-200 Malbork, Polska",
    "latitude": 54.035662, "longitude": 19.053673
  },
  {
    "id": "5", "name": "Łomża", "address": "Wojska Polskiego 87, 18-400 Łomża, Polska",
    "latitude": 53.178083, "longitude": 22.06025
  },
  {
    "id": "6", "name": "Myślibórz", "address": "Myślibórz, Polska",
    "latitude": 52.9246, "longitude": 14.867063
  }
];

// Granice Polski dla przycisku dopasowania widoku
const POLAND_BOUNDS: [[number, number], [number, number]] = [
  [14.12, 49.0], // południowo-zachodni róg Polski
  [24.15, 54.83] // północno-wschodni róg Polski
];

// Dostępne promienie dla okręgu wokół użytkownika (w kilometrach)
const RADIUS_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 80, 100, 120];

// Hook do pobierania danych klientów
const useClientsData = (selectedBranch: string) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalClients: 0,
    freeClients: 0,
    assignedClients: 0,
    ownClients: 0 // Dodajemy statystykę dla własnych klientów
  });
  const [mounted, setMounted] = useState(false);

  // Funkcja do pobierania danych z localStorage
  const getStoredAuthState = () => {
    if (typeof window === 'undefined') return null;
    try {
      const storedState = localStorage.getItem('auth_state');
      return storedState ? JSON.parse(storedState) : null;
    } catch (error) {
      console.error('Błąd odczytu auth_state z localStorage:', error);
      return null;
    }
  };

  // Pobieramy dane o użytkowniku
  const storedAuthState = getStoredAuthState();
  const userDisplayName = storedAuthState?.fullName || "Użytkownik";

  // Ustawiamy mounted po pierwszym renderowaniu
  useEffect(() => {
    setMounted(true);
    console.log('=== ŚRODOWISKO APLIKACJI ===');
    console.log('Hostname:', window.location.hostname);
    console.log('Pathname:', window.location.pathname);
    console.log('Protocol:', window.location.protocol);
    console.log('Port:', window.location.port);
    console.log('Origin:', window.location.origin);
    console.log('BaseURI:', document.baseURI);
    console.log('UserAgent:', navigator.userAgent);
  }, []);

  // Funkcja pobierająca dane klientów
  useEffect(() => {
    if (!mounted) return;

    const fetchClients = async () => {
      try {
        console.log('=== ROZPOCZĘCIE POBIERANIA KLIENTÓW ===');
        setLoading(true);
        setError(null);

        // Określenie URL API - używamy działającego endpointu
        const apiUrl = '/api/clients';
        console.log('URL zapytania:', apiUrl);

        const response = await fetch(apiUrl, {
          headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('=== ODPOWIEDŹ API ===');
        console.log('Status odpowiedzi:', response.status);
        console.log('Otrzymana liczba klientów:', data.length);
        console.log('Przykładowy klient (jeśli dostępny):', data.length > 0 ? data[0] : 'brak klientów');

        if (data.length > 0) {
          console.log('Dostępne pola:', Object.keys(data[0]));
        }

        // Transformacja danych - obsługa różnych formatów
        const formattedData = data.map((client: any) => {
          // Sprawdzamy czy mamy dane w formacie z polem nazwa zamiast name
          if (client.nazwa && !client.name) {
            // Budujemy kompletny obiekt klienta
            const clientName = client.nazwa ? client.nazwa.replace(/ochotnicza straż pożarna/gi, "OSP") : "Klient bez nazwy";

            // Tworzymy adres z poszczególnych pól
            const clientAddress = `${client.ulica || ''} ${client.nr_nieruchomosci || ''}, ${client.kod_pocztowy || ''} ${client.miejscowosc || ''}`.trim();

            return {
              ...client,
              name: clientName,
              address: clientAddress || "Brak adresu"
            };
          } else {
            // Dla danych w standardowym formacie
            return {
              ...client,
              name: client.name ? client.name.replace(/ochotnicza straż pożarna/gi, "OSP") : "Klient bez nazwy",
              address: client.address || "Brak adresu"
            };
          }
        });

        // Filtrowanie według oddziału
        const filteredData = selectedBranch === 'all'
          ? formattedData
          : formattedData.filter((client: Client) => client.branch === selectedBranch);

        setClients(filteredData);

        // Obliczanie statystyk
        const totalClients = filteredData.length;
        const freeClients = filteredData.filter((client: Client) => client.status_free).length;
        const ownClients = filteredData.filter((client: Client) => client.rep === userDisplayName).length;
        // Zajęci klienci to ci, którzy NIE są wolni i NIE są własnymi klientami
        const assignedClients = filteredData.filter((client: Client) =>
          !client.status_free && client.rep !== userDisplayName
        ).length;

        setStats({
          totalClients,
          freeClients,
          assignedClients,
          ownClients
        });

        console.log('=== ZAKOŃCZONO POBIERANIE KLIENTÓW POMYŚLNIE ===');
        console.log('Statystyki:', {
          totalClients,
          freeClients,
          assignedClients: totalClients - freeClients,
          ownClients
        });
      } catch (err: any) {
        console.error('=== BŁĄD POBIERANIA KLIENTÓW ===');
        console.error('Błąd pobierania klientów:', err);

        setError(`Nie udało się pobrać danych klientów: ${err.message}`);

        // Resetujemy dane
        setClients([]);
        setStats({ totalClients: 0, freeClients: 0, assignedClients: 0, ownClients: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, [selectedBranch, mounted, userDisplayName]);

  return { clients, loading, error, stats };
};

const MapView = () => {
  // Referencje i stan mapy
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null); // Referencja do markera użytkownika
  const turfRef = useRef<any>(null); // Referencja do biblioteki turf.js
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [radiusIndicatorRef, setRadiusIndicatorRef] = useState<HTMLDivElement | null>(null);

  // Stan dla listy klientów
  const [isClientListOpen, setIsClientListOpen] = useState<boolean>(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Funkcja do pobierania danych z localStorage
  const getStoredAuthState = () => {
    if (typeof window === 'undefined') return null;
    try {
      const storedState = localStorage.getItem('auth_state');
      return storedState ? JSON.parse(storedState) : null;
    } catch (error) {
      console.error('Błąd odczytu auth_state z localStorage:', error);
      return null;
    }
  };

  // Pobieramy dane o lokalizacji użytkownika z hooka useAuth
  const { userLatitude, userLongitude } = useAuth();
  const hasUserLocation = userLatitude !== null && userLongitude !== null;

  // Pobieramy fullName bezpośrednio z localStorage
  const storedAuthState = getStoredAuthState();
  const userDisplayName = storedAuthState?.fullName || "Użytkownik";

  // Stan dla filtrów
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [showFreeClients, setShowFreeClients] = useState<boolean>(true);
  const [showBusyClients, setShowBusyClients] = useState<boolean>(true);
  const [showOwnClients, setShowOwnClients] = useState<boolean>(true); // Nowy stan dla własnych klientów
  const [showBranchMarkers, setShowBranchMarkers] = useState<boolean>(true);
  const [visibleClientsCount, setVisibleClientsCount] = useState<number>(0);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);

  // Stan dla promienia wokół użytkownika
  const [userRadiusKm, setUserRadiusKm] = useState<number | null>(null);

  // Stan dla statystyk klientów w promieniu
  const [radiusStats, setRadiusStats] = useState({
    totalInRadius: 0,
    freeInRadius: 0,
    busyInRadius: 0,
    ownInRadius: 0 // Dodajemy statystykę dla własnych klientów w promieniu
  });

  // Użycie hooka do pobierania danych klientów
  const { clients, loading, error, stats } = useClientsData(selectedBranch);

  // Funkcja do obsługi wyboru klienta z listy
  const handleClientSelection = (clientId: string) => {
    setSelectedClientId(clientId);

    // Find the selected client from clients array
    const selectedClient = clients.find(client => client.id === clientId);

    if (selectedClient && mapRef.current) {
      // Create a client data object to pass to handleItemSelection
      const clientData: Client = {
        id: selectedClient.id,
        name: selectedClient.name,
        address: selectedClient.address,
        latitude: selectedClient.latitude,
        longitude: selectedClient.longitude,
        status_free: selectedClient.status_free,
        branch: selectedClient.branch,
        rep: selectedClient.rep,
      };

      // Create a synthetic event object with required properties
      const syntheticEvent = {
        features: [{
          geometry: {
            coordinates: [selectedClient.longitude, selectedClient.latitude]
          },
          properties: {
            id: selectedClient.id
          }
        }],
        lngLat: {
          lng: selectedClient.longitude,
          lat: selectedClient.latitude
        }
      };

      // Call the item selection handler with client data
      handleItemSelection('client', clientData, syntheticEvent);

      // Close the client list after selection
      setIsClientListOpen(false);
    }
  };

  // Sprawdzenie, czy urządzenie jest mobilne
  useEffect(() => {
    const checkIfMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobileCheck = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      setIsMobile(isMobileCheck);
      console.log('Urządzenie mobilne:', isMobileCheck);
    };

    // Sprawdź przy inicjalizacji
    checkIfMobile();

    // Nasłuchuj na zmiany rozmiaru okna (na wypadek responsywnych trybów w przeglądarkach desktopowych)
    window.addEventListener('resize', checkIfMobile);
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  // Funkcja do otwierania nawigacji
  const openNavigation = (latitude: number, longitude: number) => {
    if (!isMobile) return;

    // Utworzenie odpowiedniego URL dla map
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;

    // Otwórz w nowym oknie/zakładce
    window.open(googleMapsUrl, '_blank');
  };

  // Funkcja do aktualizacji okręgu wokół użytkownika
  const updateUserRadiusCircle = () => {
    // Ukryj okrąg, jeśli warunki nie są spełnione
    if (!mapRef.current || !mapLoaded || !hasUserLocation || !userRadiusKm || !turfRef.current) {
      try {
        if (mapRef.current && mapLoaded &&
            mapRef.current.getLayer('user-radius-border') &&
            mapRef.current.getLayer('user-radius-fill')) {
          mapRef.current.setLayoutProperty('user-radius-fill', 'visibility', 'none');
          mapRef.current.setLayoutProperty('user-radius-border', 'visibility', 'none');
        }
      } catch (err) {
        console.log('Warstwy okręgu jeszcze nie istnieją lub mapa nie jest gotowa');
      }
      return;
    }

    const map = mapRef.current;
    const turf = turfRef.current;

    try {
      // Tworzenie punktu w lokalizacji użytkownika
      const center = turf.point([userLongitude!, userLatitude!]);

      // Tworzenie okręgu o wybranym promieniu (w kilometrach)
      const circle = turf.circle(center, userRadiusKm, {
        steps: 128, // Liczba punktów tworzących okrąg (wyższa wartość = gładszy okrąg)
        units: 'kilometers'
      });

      // Obliczenie granic okręgu dla lepszego dopasowania widoku
      const circleBounds = turf.bbox(circle);
      const boundsWithPadding: mapboxgl.LngLatBoundsLike = [
        [circleBounds[0], circleBounds[1]], // [minLng, minLat]
        [circleBounds[2], circleBounds[3]]  // [maxLng, maxLat]
      ];

      // Aktualizacja źródła danych na mapie
      if (map.getSource('user-radius-source')) {
        // Musimy rzutować źródło na GeoJSONSource, ponieważ tylko ten typ źródła ma metodę setData
        (map.getSource('user-radius-source') as mapboxgl.GeoJSONSource).setData(circle);

        // Pokaż warstwy okręgu
        map.setLayoutProperty('user-radius-fill', 'visibility', 'visible');
        map.setLayoutProperty('user-radius-border', 'visibility', 'visible');

        // Sprawdź wymiary kontenera mapy
        const mapElement = map.getContainer();
        const mapWidth = mapElement.offsetWidth;
        const mapHeight = mapElement.offsetHeight;
        const isSmallScreen = mapWidth < 768 || mapHeight < 500;

        // Bardziej precyzyjne ustalanie poziomu przybliżenia dla wszystkich promieni
        let zoomLevel;

        // Funkcja dopasowania poziomu przybliżenia na podstawie promienia
        const calculateZoomLevel = (radius: number) => {
          // Bardziej płynne dopasowanie - mniejszy promień = większy zoom
          // Bazujemy na logarytmicznej skali, aby lepiej dopasować widok do promienia
          const baseZoom = isSmallScreen ? 11 : 11.5;
          return baseZoom - Math.log10(radius) * 1.8;
        };

        // Obliczamy poziom przybliżenia na podstawie promienia
        zoomLevel = calculateZoomLevel(userRadiusKm);

        // Zapewniamy, że poziom przybliżenia mieści się w rozsądnych granicach
        zoomLevel = Math.min(Math.max(zoomLevel, 5.5), 11);

        console.log(`Promień: ${userRadiusKm} km, Zoom: ${zoomLevel}`);

        // Używamy fitBounds zamiast flyTo, aby lepiej dopasować widok do okręgu
        map.fitBounds(boundsWithPadding, {
          padding: {
            top: 50,
            bottom: 50,
            left: 50,
            right: 50
          },
          duration: 1200,
          // Opcjonalnie można ustawić maksymalny zoom, aby uniknąć zbyt dużego przybliżenia
          maxZoom: 11
        });
      }
    } catch (err) {
      console.error('Błąd aktualizacji okręgu:', err);
    }
  };

  // Funkcja aktualizująca wskaźnik promienia
  const updateRadiusIndicator = () => {
    if (radiusIndicatorRef && userRadiusKm) {
      const radiusText = radiusIndicatorRef.querySelector('span strong');
      if (radiusText) {
        radiusText.textContent = `${userRadiusKm} km`;
        radiusIndicatorRef.style.display = 'flex';
      }
    } else if (radiusIndicatorRef) {
      radiusIndicatorRef.style.display = 'none';
    }
  };

  // Efekt aktualizujący wskaźnik promienia
  useEffect(() => {
    updateRadiusIndicator();
  }, [userRadiusKm, radiusIndicatorRef]);

  // Funkcja obliczająca statystyki klientów w promieniu
  const calculateRadiusStats = () => {
    if (!hasUserLocation || !userRadiusKm || !clients.length || !turfRef.current) {
      setRadiusStats({
        totalInRadius: 0,
        freeInRadius: 0,
        busyInRadius: 0,
        ownInRadius: 0
      });
      return;
    }

    try {
      const turf = turfRef.current;
      // Punkt lokalizacji użytkownika
      const userPoint = turf.point([userLongitude!, userLatitude!]);

      // Filtrujemy klientów znajdujących się w obrębie promienia
      const clientsInRadius = clients.filter(client => {
        // Utworzenie punktu dla lokalizacji klienta
        const clientPoint = turf.point([client.longitude, client.latitude]);

        // Obliczenie odległości między punktami w kilometrach
        const distance = turf.distance(userPoint, clientPoint, { units: 'kilometers' });

        // Sprawdzenie czy klient znajduje się w obrębie promienia
        return distance <= userRadiusKm;
      });

      // Obliczenie statystyk
      const totalInRadius = clientsInRadius.length;
      const freeInRadius = clientsInRadius.filter(client => client.status_free).length;
      const ownInRadius = clientsInRadius.filter(client => client.rep === userDisplayName).length;
      // Zajęci klienci to ci, którzy NIE są wolni i NIE są własnymi klientami
      const busyInRadius = clientsInRadius.filter(client =>
        !client.status_free && client.rep !== userDisplayName
      ).length;

      // Aktualizacja stanu
      setRadiusStats({
        totalInRadius,
        freeInRadius,
        busyInRadius,
        ownInRadius
      });

      console.log('Statystyki promienia zaktualizowane:', {
        promień: userRadiusKm,
        całkowita: totalInRadius,
        wolne: freeInRadius,
        zajęte: totalInRadius - freeInRadius,
        własne: ownInRadius
      });

    } catch (err) {
      console.error('Błąd podczas obliczania statystyk w promieniu:', err);
      setRadiusStats({
        totalInRadius: 0,
        freeInRadius: 0,
        busyInRadius: 0,
        ownInRadius: 0
      });
    }
  };

  // Przygotowanie danych dla warstw - KLUCZOWA FUNKCJA DO AKTUALIZACJI
  const prepareMapData = () => {
    if (!mapRef.current || !mapLoaded) {
      console.log('Mapa nie jest gotowa do przygotowania danych');
      return;
    }

    const map = mapRef.current;

    // OBSŁUGA MARKERA UŻYTKOWNIKA
    if (hasUserLocation) {
      try {
        const mapboxgl = require('mapbox-gl');

        // Sprawdzamy czy marker użytkownika już istnieje
        if (!userMarkerRef.current) {
          console.log('Tworzenie nowego markera użytkownika');

          // Tworzymy element HTML dla markera użytkownika
          const userLocationEl = document.createElement('div');
          userLocationEl.className = 'user-location-marker';
          userLocationEl.id = 'user-location-marker';

          // Tworzymy kontener dla ikony użytkownika
          const iconContainer = document.createElement('div');
          iconContainer.className = 'user-location-icon';

          // Dodajemy ikonę użytkownika do kontenera
          const userIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          userIcon.setAttribute('width', '18');
          userIcon.setAttribute('height', '18');
          userIcon.setAttribute('viewBox', '0 0 24 24');
          userIcon.setAttribute('fill', 'none');
          userIcon.setAttribute('stroke', '#6366F1');
          userIcon.setAttribute('stroke-width', '2');
          userIcon.setAttribute('stroke-linecap', 'round');
          userIcon.setAttribute('stroke-linejoin', 'round');

          // Ścieżka dla ikony użytkownika
          const circlePath = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circlePath.setAttribute('cx', '12');
          circlePath.setAttribute('cy', '8');
          circlePath.setAttribute('r', '4');

          const bodyPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          bodyPath.setAttribute('d', 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2');

          userIcon.appendChild(circlePath);
          userIcon.appendChild(bodyPath);
          iconContainer.appendChild(userIcon);

          // Tworzymy etykietę z pełnym imieniem użytkownika
          const userLabel = document.createElement('div');
          userLabel.className = 'user-location-label';
          userLabel.textContent = userDisplayName;

          // Dodajemy ikonę i etykietę do głównego kontenera
          userLocationEl.appendChild(iconContainer);
          userLocationEl.appendChild(userLabel);

          // Tworzenie nowego markera
          userMarkerRef.current = new mapboxgl.Marker({
            element: userLocationEl
          })
            .setLngLat([userLongitude!, userLatitude!])
            .addTo(map);

          console.log('Marker użytkownika dodany pomyślnie, pozycja:', [userLongitude, userLatitude]);

          // Tworzenie wskaźnika promienia, jeśli jeszcze nie istnieje
          if (!radiusIndicatorRef && mapContainer.current) {
            const radiusIndicator = document.createElement('div');
            radiusIndicator.className = 'radius-indicator';
            radiusIndicator.style.display = 'none'; // Początkowo ukryty
            radiusIndicator.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="4"></circle>
              </svg>
              <span>Promień: <strong>0 km</strong></span>
            `;

            mapContainer.current.appendChild(radiusIndicator);
            setRadiusIndicatorRef(radiusIndicator);
          }
        } else {
          // Aktualizacja pozycji istniejącego markera
          userMarkerRef.current.setLngLat([userLongitude!, userLatitude!]);
        }
      } catch (err) {
        console.error('Błąd podczas obsługi markera użytkownika:', err);
      }
    }

    // Przygotuj dane GeoJSON dla oddziałów
    const branchesGeoJSON: FeatureCollection = {
      type: 'FeatureCollection',
      features: BRANCHES
        .filter(branch => selectedBranch === "all" || branch.name === selectedBranch)
        .map(branch => ({
          type: 'Feature',
          properties: { id: branch.id, name: branch.name, address: branch.address, type: 'branch' },
          geometry: {
            type: 'Point',
            coordinates: [branch.longitude, branch.latitude]
          }
        }))
    };

    // Przygotuj dane GeoJSON dla klientów z uwzględnieniem filtrów
    const filteredClients = clients
      .filter(client => {
        // Filtrowanie według statusu i opiekuna
        const isOwnClient = client.rep === userDisplayName;

        // Jeśli klient jest własny
        if (isOwnClient) {
          // Jeśli warstwa własnych klientów jest wyłączona, ukryj go
          if (!showOwnClients) return false;
        }
        // Jeśli klient nie jest własny - sprawdź standardowe filtry statusu
        else {
          if (client.status_free && !showFreeClients) return false;
          if (!client.status_free && !showBusyClients) return false;
        }

        return true;
      });

    const clientsGeoJSON: FeatureCollection = {
      type: 'FeatureCollection',
      features: filteredClients.map(client => ({
        type: 'Feature',
        properties: {
          id: client.id,
          name: client.name || 'Klient bez nazwy',
          address: client.address || 'Brak adresu',
          status_free: client.status_free,
          branch: client.branch,
          rep: client.rep,
          isOwnClient: client.rep === userDisplayName, // Dodajemy flagę dla własnych klientów
          type: 'client'
        },
        geometry: {
          type: 'Point',
          coordinates: [client.longitude, client.latitude]
        }
      }))
    };

    // Aktualizuj źródła danych, jeśli istnieją
    try {
      if (map.getSource('branches-source')) {
        // Rzutowanie na GeoJSONSource dla dostępu do metody setData
        (map.getSource('branches-source') as mapboxgl.GeoJSONSource).setData(branchesGeoJSON);
      }

      if (map.getSource('clients-source')) {
        // Rzutowanie na GeoJSONSource dla dostępu do metody setData
        (map.getSource('clients-source') as mapboxgl.GeoJSONSource).setData(clientsGeoJSON);
      }

      // Sprawdź liczbę widocznych klientów
      if (map.getLayer('clients-labels')) {
        // Pobierz aktualną ilość klientów widocznych na ekranie
        const bounds = map.getBounds();
        const visibleFeatures = filteredClients.filter(client => {
          return bounds.contains([client.longitude, client.latitude]);
        });

        setVisibleClientsCount(visibleFeatures.length);

        // Etykiety klientów zawsze pozostają ukryte
        map.setLayoutProperty('clients-labels', 'visibility', 'none');
      }

      // Aktualizacja widoczności warstw
      const layers = {
        'branches-pin-shadow': showBranchMarkers,
        'branches-pin-base': showBranchMarkers,
        'clients-free-layer': showFreeClients,
        'clients-own-layer': showOwnClients, // Dodajemy warstwę własnych klientów
        'clients-assigned-layer': showBusyClients
      };

      Object.entries(layers).forEach(([layer, visible]) => {
        if (map.getLayer(layer)) {
          map.setLayoutProperty(layer, 'visibility', visible ? 'visible' : 'none');
        }
      });
    } catch (err) {
      console.error('Błąd podczas aktualizacji źródeł danych:', err);
    }
  };

  // Inicjalizacja warstw na mapie
  const initializeLayers = (map: mapboxgl.Map) => {
    try {
      // Dodaj źródła danych
      ['branches-source', 'clients-source'].forEach(source => {
        map.addSource(source, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection' as const,
            features: []
          }
        });
      });

      // Dodaj źródło dla okręgu wokół użytkownika
      map.addSource('user-radius-source', {
        type: 'geojson',
        data: {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'Polygon' as const,
            coordinates: [[]] // Pusty polygon do aktualizacji później
          }
        }
      });

      // 1. Warstwy dla klientów jako punkty - WOLNI KLIENCI (na samym spodzie)
      map.addLayer({
        id: 'clients-free-layer',
        type: 'circle',
        source: 'clients-source',
        filter: ['all',
          ['==', ['get', 'status_free'], true],
          ['!=', ['get', 'isOwnClient'], true]
        ],
        paint: {
          // Dynamiczne skalowanie rozmiaru punktów w zależności od poziomu przybliżenia
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5, 2,    // Przy małym przybliżeniu (poziom 5) - małe punkty o promieniu 2px
            8, 3,    // Przy średnim przybliżeniu (poziom 8) - punkty o promieniu 3px
            10, 4,   // Przy poziomie 10 - punkty o promieniu 4px
            13, 6,   // Przy poziomie 13 - punkty o promieniu 6px
            20, 8,   // Przy dużym przybliżeniu (poziom 16) - duże punkty o promieniu 8px
            30, 12   // Przy maksymalnym przybliżeniu (poziom 19) - bardzo duże punkty o promieniu 12px
          ],
          'circle-color': '#16a34a', // Zielony kolor dla wolnych klientów
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff'
        },
        layout: {
          'visibility': 'visible'
        }
      });

      // 2. WARSTWA DLA WŁASNYCH KLIENTÓW
      map.addLayer({
        id: 'clients-own-layer',
        type: 'circle',
        source: 'clients-source',
        filter: ['==', ['get', 'isOwnClient'], true],
        paint: {
          // Dynamiczne skalowanie rozmiaru punktów w zależności od poziomu przybliżenia
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5, 2,    // Przy małym przybliżeniu (poziom 5) - małe punkty o promieniu 2px
            8, 3,    // Przy średnim przybliżeniu (poziom 8) - punkty o promieniu 3px
            10, 4,   // Przy poziomie 10 - punkty o promieniu 4px
            13, 6,   // Przy poziomie 13 - punkty o promieniu 6px
            16, 8,   // Przy dużym przybliżeniu (poziom 16) - duże punkty o promieniu 8px
            19, 12   // Przy maksymalnym przybliżeniu (poziom 19) - bardzo duże punkty o promieniu 12px
          ],
          'circle-color': '#9333ea', // Purpurowy kolor dla własnych klientów
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff'
        },
        layout: {
          'visibility': 'visible'
        }
      });

      // 3. ZAJĘCI KLIENCI (warstwa nad własnymi klientami)
      map.addLayer({
        id: 'clients-assigned-layer',
        type: 'circle',
        source: 'clients-source',
        filter: ['all',
          ['==', ['get', 'status_free'], false],
          ['!=', ['get', 'isOwnClient'], true]
        ],
        paint: {
          // Dynamiczne skalowanie rozmiaru punktów w zależności od poziomu przybliżenia
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5, 2,    // Przy małym przybliżeniu (poziom 5) - małe punkty o promieniu 2px
            8, 3,    // Przy średnim przybliżeniu (poziom 8) - punkty o promieniu 3px
            10, 4,   // Przy poziomie 10 - punkty o promieniu 4px
            13, 6,   // Przy poziomie 13 - punkty o promieniu 6px
            16, 8,   // Przy dużym przybliżeniu (poziom 16) - duże punkty o promieniu 8px
            19, 12   // Przy maksymalnym przybliżeniu (poziom 19) - bardzo duże punkty o promieniu 12px
          ],
          'circle-color': '#dc2626', // Czerwony kolor dla zajętych klientów
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff'
        },
        layout: {
          'visibility': 'visible'
        }
      });

      // Warstwa wypełnienia dla okręgu wokół użytkownika (pod wszystkimi innymi warstwami)
      map.addLayer({
        id: 'user-radius-fill',
        type: 'fill',
        source: 'user-radius-source',
        paint: {
          'fill-color': '#6366F1', // Kolor indygo pasujący do ikony użytkownika
          'fill-opacity': 0.1
        },
        layout: {
          'visibility': 'none' // Domyślnie ukryta
        }
      }, 'clients-free-layer'); // Dodaj pod warstwą klientów

      // 4. Cień dla znaczników oddziałów (pinezek) - efekt 3D
      map.addLayer({
        id: 'branches-pin-shadow',
        type: 'circle',
        source: 'branches-source',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5, 7,
            8, 9,
            10, 11,
            13, 13,
            16, 15
          ],
          'circle-color': 'rgba(0, 0, 0, 0.3)', // Półprzezroczysty czarny dla cienia
          'circle-translate': [2, 2], // Przesuń cień w prawo i dół
          'circle-blur': 1 // Rozmyj cień dla lepszego efektu
        },
        layout: {
          'visibility': 'visible'
        }
      });

      // 5. Warstwa dla ODDZIAŁÓW jako pinezki
      map.addLayer({
        id: 'branches-pin-base',
        type: 'symbol',
        source: 'branches-source',
        layout: {
          'icon-image': 'marker-15', // Użycie wbudowanej ikony pinezki
          'icon-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5, 1.2,
            8, 1.5,
            10, 1.8,
            13, 2.0,
            16, 2.3
          ],
          'icon-allow-overlap': true,
          'icon-anchor': 'bottom', // Pinezka wskazuje na dokładną lokalizację
          'visibility': 'visible'
        },
        paint: {
          'icon-color': '#3b82f6' // Niebieski kolor dla pinezek
        }
      });

      // Warstwa obramowania dla okręgu wokół użytkownika (nad warstwą wypełnienia)
      map.addLayer({
        id: 'user-radius-border',
        type: 'line',
        source: 'user-radius-source',
        paint: {
          'line-color': '#6366F1', // Kolor indygo pasujący do ikony użytkownika
          'line-width': 2,
          'line-opacity': 0.7,
          'line-dasharray': [2, 2] // Przerywana linia dla lepszego wyglądu
        },
        layout: {
          'visibility': 'none' // Domyślnie ukryta
        }
      });

      // Warstwa dla nazw oddziałów z jasnoszarym tłem
      map.addLayer({
        id: 'branches-labels',
        type: 'symbol',
        source: 'branches-source',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
          'text-size': 12,
          'visibility': 'visible',
          'text-allow-overlap': true,  // Zawsze pokazuj etykiety oddziałów
          'symbol-z-order': 'source'   // Priorytet wyświetlania na podstawie kolejności w źródle
        },
        paint: {
          'text-color': '#3232AA',  // Kolor dla nazw oddziałów
          'text-halo-color': 'rgba(255,255,255, 0.95)',  // Jasnoszare tło
          'text-halo-width': 30,  // Zwiększona szerokość obramowania dla wyraźnej ramki
          'text-halo-blur': 0    // Brak rozmycia dla wyraźnej ramki
        }
      });

      // Warstwa dla nazw klientów
      map.addLayer({
        id: 'clients-labels',
        type: 'symbol',
        source: 'clients-source',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-offset': [0, 1],
          'text-anchor': 'top',
          'text-size': 10,
          'text-allow-overlap': false,
          'text-optional': true,
          'visibility': 'none'  // Domyślnie ukryte
        },
        paint: {
          'text-color': '#4b5563',
          'text-halo-color': 'rgba(255, 255, 255, 0.8)',
          'text-halo-width': 1
        }
      });

      // Dodanie interakcji
      setupMapInteractions(map);

      // Nasłuchuj zdarzeń moveend, aby aktualizować widoczność etykiet klientów
      map.on('moveend', () => {
        prepareMapData();
      });

      console.log('Warstwy mapy zainicjalizowane pomyślnie');
    } catch (error) {
      console.error("Błąd inicjalizacji warstw mapy:", error);
    }
  };

  // Funkcja dodająca interakcje z mapą
  const setupMapInteractions = (map: mapboxgl.Map) => {
    // Obsługa kliknięć na oddziały (pinezki)
    map.on('click', 'branches-pin-base', (e: any) => {
      if (!e.features?.[0]?.properties?.id) return;

      const branch = BRANCHES.find(b => b.id === e.features[0].properties.id);
      if (!branch) return;

      handleItemSelection('branch', branch, e);
    });

    // Obsługa kliknięć na klientów - dodajemy nową warstwę own-clients
    map.on('click', ['clients-free-layer', 'clients-own-layer', 'clients-assigned-layer'], (e: any) => {
      if (!e.features?.[0]?.properties?.id) return;
      // Pobierz dane klikniętego klienta z właściwości znacznika
      const feature = e.features[0];
      const props = feature.properties;
      const clientData: Client = {
        id: props.id,
        name: props.name || 'Klient bez nazwy',
        address: props.address || 'Brak adresu',
        latitude: feature.geometry.coordinates[1],
        longitude: feature.geometry.coordinates[0],
        status_free: props.status_free,
        branch: props.branch,
        rep: props.rep,
      };

      // Aktualizuj stan wybranego klienta dla listy klientów
      setSelectedClientId(clientData.id);

      handleItemSelection('client', clientData, e);
    });

    // Zmiana kursora - dodajemy nową warstwę own-clients
    ['branches-pin-base', 'clients-free-layer', 'clients-own-layer', 'clients-assigned-layer'].forEach(layer => {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    });

    // Zamknięcie popup po kliknięciu poza punktami - dodajemy nową warstwę own-clients
    map.on('click', (e: any) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['branches-pin-base', 'clients-free-layer', 'clients-own-layer', 'clients-assigned-layer']
      });
      if (features.length === 0) {
        setSelectedItem(null);
        setSelectedClientId(null);
      }
    });
  };

  // Obsługa wyboru elementu na mapie
  const handleItemSelection = (type: 'branch' | 'client', data: Branch | Client, e: any) => {
    const selectedItemData = { type, data };
    setSelectedItem(selectedItemData);

    // Pozycjonowanie popup
    if (e.features[0].geometry?.coordinates) {
      const coordinates = e.features[0].geometry.coordinates.slice() as [number, number];

      // Upewnij się, że popup jest widoczny również podczas przybliżania
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      // Stwórz popup i dostosuj widok mapy dla obu typów obiektów
      createMapboxPopup(selectedItemData, coordinates);

      // Jednakowe zbliżenie dla oddziałów i klientów
      mapRef.current?.flyTo({
        center: coordinates,
        zoom: 11  // Ujednolicony poziom zbliżenia
      });
    }
  };

  // Funkcja tworząca popup Mapbox
  const createMapboxPopup = (item: SelectedItem, coordinates: [number, number]) => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const mapboxgl = require('mapbox-gl');

    // Usuń istniejące popupy
    document.querySelectorAll('.mapboxgl-popup').forEach(popup => popup.remove());

    let popupContent = '';

    if (item.type === 'branch') {
      const branch = item.data as Branch;
      // Dodanie przycisku nawigacji dla urządzeń mobilnych
      const navigationButton = isMobile ?
        `<button
          onclick="window.openNavigation(${branch.latitude}, ${branch.longitude})"
          style="background-color: #3b82f6; color: white; padding: 6px 12px; border: none; border-radius: 4px; margin-top: 8px; display: flex; align-items: center; justify-content: center; width: 100%;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
          Nawiguj
        </button>` : '';

      popupContent = `
        <div style="padding: 12px; max-width: 240px;">
          <h3 style="margin: 0 0 8px 0; font-weight: bold; color: #6b7280;">Oddział ${branch.name || 'Bez nazwy'}</h3>
          <p style="margin: 0 0 8px 0; color: #4b5563;">${branch.address || 'Brak adresu'}</p>
          ${navigationButton}
        </div>
      `;
    } else if (item.type === 'client') {
      const client = item.data as Client;
      // Sprawdzenie czy klient jest własny
      const isOwnClient = client.rep === userDisplayName;

      // Dodanie przycisku nawigacji dla urządzeń mobilnych
      const navigationButton = isMobile ?
        `<button
          onclick="window.openNavigation(${client.latitude}, ${client.longitude})"
          style="background-color: #3b82f6; color: white; padding: 6px 12px; border: none; border-radius: 4px; margin-top: 8px; display: flex; align-items: center; justify-content: center; width: 100%;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
          Nawiguj
        </button>` : '';

      // Ustalanie koloru statusu - purpurowy dla własnych
      const statusColor = isOwnClient ? '#9333ea' : (client.status_free ? '#16a34a' : '#dc2626');
      const statusText = isOwnClient ? 'Twój klient' : (client.status_free ? 'Wolny' : 'Przypisany');

      popupContent = `
        <div style="padding: 12px; max-width: 240px;">
          <h3 style="margin: 0 0 8px 0; font-weight: bold; color: #6b7280;">${client.name || 'Klient bez nazwy'}</h3>
          <p style="margin: 0 0 8px 0; color: #4b5563;">${client.address || 'Brak adresu'}</p>
          <div style="margin: 0 0 4px 0;">
            <span style="font-weight: medium; color: #4b5563;">Status: </span>
            <span style="color: ${statusColor};">
              ${statusText}
            </span>
          </div>
          ${client.branch ? `<div style="margin: 4px 0; color: #4b5563;"><span style="font-weight: medium;">Oddział:</span> ${client.branch}</div>` : ''}
          ${client.rep ? `<div style="margin: 4px 0; color: #4b5563;"><span style="font-weight: medium;">Przedstawiciel:</span> ${client.rep}</div>` : ''}
          ${navigationButton}
        </div>
      `;
    }

    // Utwórz popup
    const popup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: '300px',
      offset: 15
    })
      .setLngLat(coordinates)
      .setHTML(popupContent)
      .addTo(map)
      .on('close', () => {
        setSelectedItem(null);
      });

    // Dodaj funkcję otwierania nawigacji do okna, aby była dostępna z HTML
    if (isMobile) {
      (window as any).openNavigation = (lat: number, lng: number) => {
        openNavigation(lat, lng);
      };
    }
  };

  // Funkcja do dopasowania widoku do granic Polski
  const fitToPoland = () => {
    if (!mapRef.current) return;
    mapRef.current.fitBounds(POLAND_BOUNDS, {
      padding: 50,
      duration: 1000
    });
  };

  // Niestandardowa kontrolka do dopasowania widoku do Polski
  class FitToPolandControl {
    _map: mapboxgl.Map | null = null;
    _container!: HTMLDivElement;
    _bounds: [[number, number], [number, number]];

    constructor(bounds: [[number, number], [number, number]]) {
      this._bounds = bounds;
    }

    onAdd(map: mapboxgl.Map) {
      this._map = map;
      this._container = document.createElement('div');
      this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mapboxgl-ctrl-icon fit-poland-ctrl';
      button.setAttribute('aria-label', 'Dopasuj widok do całej Polski');
      button.title = 'Dopasuj widok do całej Polski';

      button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>';

      button.addEventListener('click', () => {
        // Animowane dopasowanie do granic Polski
        if (this._map) {
          this._map.fitBounds(this._bounds, {
            padding: 50,
            duration: 1000 // Czas animacji w ms
          });
        }
      });

      this._container.appendChild(button);
      return this._container;
    }

    onRemove() {
      if (this._container.parentNode) {
        this._container.parentNode.removeChild(this._container);
      }
    }
  }

  // Niestandardowa kontrolka do centrowania widoku na użytkowniku
  class CenterOnUserControl {
    _map: mapboxgl.Map | null = null;
    _container!: HTMLDivElement;
    _userLatitude: number | null;
    _userLongitude: number | null;
    _turfRef: any;
    _setUserRadiusKm: (radius: number | null) => void;

    constructor(userLatitude: number | null, userLongitude: number | null, turfRef: any, setUserRadiusKm: (radius: number | null) => void) {
      this._userLatitude = userLatitude;
      this._userLongitude = userLongitude;
      this._turfRef = turfRef;
      this._setUserRadiusKm = setUserRadiusKm;
    }

    onAdd(map: mapboxgl.Map) {
      this._map = map;
      this._container = document.createElement('div');
      this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mapboxgl-ctrl-icon center-user-ctrl';
      button.setAttribute('aria-label', 'Centruj na mojej lokalizacji');
      button.title = 'Centruj na mojej lokalizacji';

      // Używamy ikony użytkownika
      button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>`;

      // Jeśli nie mamy lokalizacji użytkownika, przycisk będzie nieaktywny
      if (!this._userLatitude || !this._userLongitude) {
        button.disabled = true;
        button.style.opacity = '0.5';
        button.style.cursor = 'not-allowed';
        button.title = 'Brak danych o lokalizacji użytkownika';
      } else {
        button.addEventListener('click', () => {
          // Ustawiamy promień na 15km i pozwalamy funkcji updateUserRadiusCircle zająć się resztą
          this._setUserRadiusKm(15);

          // Jeśli turf jest dostępny, używamy bardziej precyzyjnej metody fitBounds
          if (this._turfRef && this._turfRef.current && this._map) {
            const turf = this._turfRef.current;
            const center = turf.point([this._userLongitude!, this._userLatitude!]);
            const circle = turf.circle(center, 15, {
              steps: 128,
              units: 'kilometers'
            });

            // Obliczenie granic okręgu
            const circleBounds = turf.bbox(circle);
            const boundsWithPadding: mapboxgl.LngLatBoundsLike = [
              [circleBounds[0], circleBounds[1]], // [minLng, minLat]
              [circleBounds[2], circleBounds[3]]  // [maxLng, maxLat]
            ];

            // Dopasowanie widoku z minimalnym marginesem
            this._map.fitBounds(boundsWithPadding, {
              padding: {
                top: 20,  // Minimalny margines
                bottom: 20,
                left: 20,
                right: 20
              },
              duration: 1200
            });
          } else if (this._map) {
            // Fallback jeśli turf nie jest dostępny
            const zoomLevel = 10; // Przybliżenie odpowiednie dla promienia ~15km
            this._map.flyTo({
              center: [this._userLongitude!, this._userLatitude!],
              zoom: zoomLevel,
              duration: 1200
            });
          }
        });
      }

      this._container.appendChild(button);
      return this._container;
    }

    onRemove() {
      if (this._container.parentNode) {
        this._container.parentNode.removeChild(this._container);
      }
    }
  }

  // Funkcja inicjalizująca mapę
  const initializeMap = async () => {
    try {
      console.log('=== INICJALIZACJA MAPY ===');
      console.log('Środowisko:', window.location.hostname);

      // Logujemy informację o lokalizacji użytkownika (jeśli dostępna)
      console.log('Lokalizacja użytkownika:', userLatitude, userLongitude);

      // Import bibliotek
      const mapboxgl = (await import('mapbox-gl')).default;
      await import('mapbox-gl/dist/mapbox-gl.css' as any);

      // Import biblioteki turf.js
      const turf = await import('@turf/turf');
      turfRef.current = turf;

      console.log('Biblioteki mapbox-gl i turf.js zaimportowane pomyślnie');

      // Dodanie stylów dla niestandardowych kontrolek
      const style = document.createElement('style');
      style.textContent = `
        .fit-poland-ctrl {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          background: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          padding: 0;
          box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
        }

        .fit-poland-ctrl svg {
          display: block;
          margin: 0 auto;
          stroke: #3b82f6;
          fill: rgba(59, 130, 246, 0.2);
        }

        .center-user-ctrl {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          background: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          padding: 0;
          box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
        }

        .center-user-ctrl svg {
          stroke: #6366F1;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }

        .center-user-ctrl:hover,
        .fit-poland-ctrl:hover {
          background-color: #f9fafb;
        }

        .mapboxgl-ctrl-group {
          margin-bottom: 10px;
        }

        .mapboxgl-map {
          overflow: hidden !important;
        }

        .mapboxgl-canvas-container.mapboxgl-interactive {
          cursor: grab;
        }

        .mapboxgl-canvas-container.mapboxgl-interactive:active {
          cursor: grabbing;
        }

        .navigation-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px 12px;
          background-color: #3b82f6;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          margin-top: 8px;
          width: 100%;
        }

        .navigation-btn svg {
          margin-right: 4px;
        }

        .user-location-marker {
          width: 36px;
          height: 36px;
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .user-location-icon {
          width: 30px;
          height: 30px;
          background-color: white;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          border: 2px solid #6366F1;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.4);
        }

        .user-location-label {
          position: absolute;
          bottom: -20px;
          left: 50%;
          transform: translateX(-50%);
          background-color: #6366F1;
          color: white;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 12px;
          white-space: nowrap;
          font-weight: 600;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .radius-indicator {
          position: absolute;
          bottom: 10px;
          left: 10px;
          background-color: rgba(255, 255, 255, 0.9);
          padding: 5px 10px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          color: #4b5563;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          display: flex;
          align-items: center;
          z-index: 5;
        }

        .radius-indicator svg {
          margin-right: 5px;
        }
      `;
      document.head.appendChild(style);

      setTimeout(() => {
        if (!mapContainer.current) {
          console.error('Kontener mapy nie istnieje');
          setMapError("Kontener mapy nie istnieje");
          return;
        }

        // Ustawienie tokena
        const token = 'pk.eyJ1IjoibW92ZTM3dGgiLCJhIjoiY204ZWZwdGgyMDFjMzJpczRmOWV4bXVpMyJ9.jdRudTW7yRSpIcEwq2o7iw';
        mapboxgl.accessToken = token;
        console.log('Mapbox token ustawiony');

        try {
          console.log('Tworzenie instancji mapy...');

          // Określenie początkowego centrum i poziomu przybliżenia
          // Używamy lokalizacji użytkownika lub domyślnie Rzgów
          let initialCenter: [number, number];
          let initialZoom: number;

          if (hasUserLocation) {
            // Jeśli mamy lokalizację użytkownika, używamy jej
            initialCenter = [userLongitude!, userLatitude!];
            // Ustawiamy wyższy poziom przybliżenia, aby później animować oddalenie
            initialZoom = 13; // Bliższy widok dla efektu oddalenia
            console.log('Używam lokalizacji użytkownika jako centrum mapy');
          } else {
            // Jeśli nie mamy lokalizacji użytkownika, używamy lokalizacji oddziału Rzgów
            const rzgowBranch = BRANCHES.find(branch => branch.name === "Rzgów");
            initialCenter = [rzgowBranch?.longitude || 19.478963, rzgowBranch?.latitude || 51.681192];
            initialZoom = 14; // Bliższy widok dla efektu oddalenia
            console.log('Używam lokalizacji oddziału Rzgów jako centrum mapy');
          }

          // Inicjalizacja mapy z monochromatycznym stylem
          const map = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/light-v11', // Monochromatyczny, jasny styl
            center: initialCenter,
            zoom: initialZoom,
            scrollZoom: true, // Aktywujemy scrollZoom dla swobodnego przewijania
            maxBounds: [[13.5, 48.9], [24.2, 55.0]] // Zachowujemy ograniczenia dla Polski
          });

          mapRef.current = map;
          console.log('Instancja mapy utworzona pomyślnie');

          map.on('load', () => {
            console.log('Mapa załadowana pomyślnie');
            setMapLoaded(true);

            // Dodanie obrazu markera dla oddziałów jeśli nie istnieje domyślnie
            if (!map.hasImage('marker-15')) {
              // Utwórz podstawowy obraz markera jako pinezka
              const markerSize = 15;
              const markerColor = '#3b82f6'; // niebieski
              const canvas = document.createElement('canvas');
              canvas.width = markerSize;
              canvas.height = markerSize * 1.5;

              const ctx = canvas.getContext('2d');
              if (ctx) {
                // Rysuj pinezke
                ctx.beginPath();
                ctx.arc(markerSize/2, markerSize/2, markerSize/2, 0, Math.PI * 2);
                ctx.fillStyle = markerColor;
                ctx.fill();
                ctx.closePath();

                // Rysuj trzon pinezki
                ctx.beginPath();
                ctx.moveTo(markerSize/2 - markerSize/4, markerSize/2);
                ctx.lineTo(markerSize/2, markerSize * 1.4);
                ctx.lineTo(markerSize/2 + markerSize/4, markerSize/2);
                ctx.fillStyle = markerColor;
                ctx.fill();
                ctx.closePath();

                // Rysuj białe kółko w środku (opcjonalnie)
                ctx.beginPath();
                ctx.arc(markerSize/2, markerSize/2, markerSize/5, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.closePath();

                map.addImage('marker-15', { width: canvas.width, height: canvas.height, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data });
              }
            }

            // Inicjalizuj warstwy
            initializeLayers(map);

            // Teraz wykonujemy jednolitą animację oddalania dla obu przypadków
            setTimeout(() => {
              if (hasUserLocation) {
                // Użytkownik ma lokalizację - animacja oddalenia na promień 15 km
                // Automatyczne ustawienie promienia 15 km
                setUserRadiusKm(15);

                // Obliczamy granice okręgu dla promienia 15 km
                if (turfRef.current) {
                  const turf = turfRef.current;
                  const center = turf.point([userLongitude!, userLatitude!]);
                  const circle = turf.circle(center, 15, {
                    steps: 128,
                    units: 'kilometers'
                  });

                  // Obliczenie granic okręgu
                  const circleBounds = turf.bbox(circle);
                  const boundsWithPadding: mapboxgl.LngLatBoundsLike = [
                    [circleBounds[0], circleBounds[1]], // [minLng, minLat]
                    [circleBounds[2], circleBounds[3]]  // [maxLng, maxLat]
                  ];

                  // Dopasowanie widoku z minimalnym marginesem
                  map.fitBounds(boundsWithPadding, {
                    padding: {
                      top: 20,  // Minimalny margines
                      bottom: 20,
                      left: 20,
                      right: 20
                    },
                    duration: 2000 // Dłuższy czas dla płynnego efektu
                  });
                } else {
                  // Fallback jeśli turf nie jest dostępny
                  const zoomLevel = 10; // Przybliżenie odpowiednie dla promienia ~15km
                  map.flyTo({
                    center: [userLongitude!, userLatitude!],
                    zoom: zoomLevel,
                    duration: 2000
                  });
                }

                console.log('Animacja oddalenia dla użytkownika z lokalizacją (promień 15 km)');
              } else {
                // Użytkownik bez lokalizacji - oddalenie do granic Polski
                map.fitBounds(POLAND_BOUNDS, {
                  padding: 50,
                  duration: 2500 // Dłuższy czas dla płynnego efektu
                });
                console.log('Animacja oddalenia do granic Polski dla użytkownika bez lokalizacji');
              }
            }, 1500); // Opóźnienie przed rozpoczęciem animacji

            // Wywołaj prepareMapData() po załadowaniu mapy
            prepareMapData();
          });

          map.on('error', (e: any) => {
            console.error('Błąd mapy:', e.error);
            setMapError(`Błąd mapy: ${e.error?.message || 'Nieznany błąd'}`);
          });

          // Dodanie kontrolek
          map.addControl(new mapboxgl.NavigationControl(), 'top-right');

          // Sprawdzamy czy kontener mapy istnieje przed dodaniem kontrolek
          if (mapContainer.current) {
            // Dodajemy kontrolkę dopasowania do Polski
            const polandControlContainer = document.createElement('div');
            polandControlContainer.className = 'custom-control-container';
            polandControlContainer.style.position = 'absolute';
            polandControlContainer.style.top = '105px';
            polandControlContainer.style.right = '10px';
            polandControlContainer.style.zIndex = '1';
            mapContainer.current.appendChild(polandControlContainer);

            const polandControl = new FitToPolandControl(POLAND_BOUNDS);
            polandControlContainer.appendChild(polandControl.onAdd(map));

            // Dodajemy kontrolkę do centrowania na użytkowniku w innym kontenerze
            const userControlContainer = document.createElement('div');
            userControlContainer.className = 'custom-control-container';
            userControlContainer.style.position = 'absolute';
            userControlContainer.style.top = '145px';
            userControlContainer.style.right = '10px';
            userControlContainer.style.zIndex = '1';
            mapContainer.current.appendChild(userControlContainer);

            const userControl = new CenterOnUserControl(userLatitude, userLongitude, turfRef, setUserRadiusKm);
            userControlContainer.appendChild(userControl.onAdd(map));

            console.log('Kontrolki mapy dodane');
          } else {
            console.error('Brak kontenera mapy przy dodawaniu kontrolek');
          }

        } catch (err: any) {
          console.error('Błąd inicjalizacji mapy:', err);
          setMapError(`Błąd inicjalizacji mapy: ${err.message}`);
        }
      }, 500);

      // Funkcja czyszcząca przy odmontowaniu komponentu
      return () => {
        // Usunięcie wskaźnika promienia
        if (radiusIndicatorRef && radiusIndicatorRef.parentNode) {
          radiusIndicatorRef.parentNode.removeChild(radiusIndicatorRef);
        }

        // Czyszczenie mapy
        if (mapRef.current) {
          console.log('Czyszczenie instancji mapy');
          // Usuwamy marker użytkownika, jeśli istnieje
          if (userMarkerRef.current) {
            userMarkerRef.current.remove();
            userMarkerRef.current = null;
          }
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    } catch (err: any) {
      console.error('Błąd ładowania biblioteki mapbox-gl:', err);
      setMapError(`Błąd ładowania biblioteki mapbox-gl: ${err.message}`);
    }
  };

  // Efekt inicjalizujący mapę
  useEffect(() => {
    // Upewnij się, że kontener mapy istnieje przed inicjalizacją
    if (mapContainer.current) {
      initializeMap();
    } else {
      console.log('Oczekiwanie na dostępność kontenera mapy...');
      // Spróbuj ponownie za chwilę, gdy DOM już się załaduje
      const timer = setTimeout(() => {
        if (mapContainer.current) {
          console.log('Kontener mapy jest już dostępny, inicjalizacja...');
          initializeMap();
        } else {
          console.error('Kontener mapy nadal niedostępny po opóźnieniu');
          setMapError("Nie można zainicjalizować mapy - kontener nie istnieje");
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [mapContainer.current]);

  // Efekt aktualizujący warstwy po zmianie filtrów lub danych
  // ZAKTUALIZOWANE zależności efektu - kluczowe dla rozwiązania problemu
  useEffect(() => {
    if (mapLoaded && mapRef.current) {
      prepareMapData();
    }
  }, [
    mapLoaded,
    clients,
    selectedBranch,
    showFreeClients,
    showBusyClients,
    showOwnClients, // Dodana nowa zależność
    showBranchMarkers,
    hasUserLocation,
    userLatitude,
    userLongitude,
    userDisplayName // Dodajemy zależność od nazwy użytkownika
  ]);

  // Efekt uruchamiający aktualizację okręgu i statystyk, gdy zmienia się promień
  useEffect(() => {
    // Dodaj bezpieczną obsługę błędów
    try {
      if (mapLoaded && hasUserLocation && mapRef.current) {
        updateUserRadiusCircle();

        // Opóźnij obliczanie statystyk, aby upewnić się że wszystko jest załadowane
        setTimeout(() => {
          calculateRadiusStats();
        }, 500);
      }
    } catch (err) {
      console.error('Błąd podczas aktualizacji okręgu:', err);
    }
  }, [userRadiusKm, mapLoaded, hasUserLocation]);

  // Efekt aktualizujący statystyki gdy zmieniają się dane klientów
  useEffect(() => {
    if (userRadiusKm !== null && clients.length > 0 && turfRef.current) {
      calculateRadiusStats();
    }
  }, [clients, userRadiusKm]);

  // Renderowanie komponentu
  return (
    <Card className="shadow-lg">
      <CardContent className="p-0">
                  {/* Panel filtrów - zaktualizowany układ */}
                    <div className="p-4 border-b bg-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        {/* Filtry typów punktów - lewa kolumna na desktop */}
                        <div className="md:col-span-8 flex flex-wrap justify-center md:justify-start items-center gap-4 md:gap-6">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="show-free-clients"
                              checked={showFreeClients}
                              onCheckedChange={(checked) => setShowFreeClients(!!checked)}
                            />
                            <div className="flex items-center space-x-1">
                              <div className="w-3 h-3 rounded-full bg-green-500"></div>
                              <Label htmlFor="show-free-clients" className="text-sm font-medium text-gray-600">
                                Klienci wolni
                                {userRadiusKm !== null && radiusStats.totalInRadius > 0 && (
                                  <span className="ml-1 font-bold">{radiusStats.freeInRadius}</span>
                                )}
                              </Label>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="show-busy-clients"
                              checked={showBusyClients}
                              onCheckedChange={(checked) => setShowBusyClients(!!checked)}
                            />
                            <div className="flex items-center space-x-1">
                              <div className="w-3 h-3 rounded-full bg-red-500"></div>
                              <Label htmlFor="show-busy-clients" className="text-sm font-medium text-gray-600">
                                Klienci zajęci
                                {userRadiusKm !== null && radiusStats.totalInRadius > 0 && (
                                  <span className="ml-1 font-bold">{radiusStats.busyInRadius}</span>
                                )}
                              </Label>
                            </div>
                          </div>

                          {/* Nowy checkbox dla własnych klientów */}
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="show-own-clients"
                              checked={showOwnClients}
                              onCheckedChange={(checked) => setShowOwnClients(!!checked)}
                            />
                            <div className="flex items-center space-x-1">
                              <div className="w-3 h-3 rounded-full bg-purple-600"></div>
                              <Label htmlFor="show-own-clients" className="text-sm font-medium text-gray-600">
                                Moi klienci
                                {userRadiusKm !== null && radiusStats.ownInRadius > 0 && (
                                  <span className="ml-1 font-bold">{radiusStats.ownInRadius}</span>
                                )}
                              </Label>
                            </div>
                          </div>
                        </div>

                        {/* Wybór promienia i przycisk listy - prawa kolumna na desktop */}
                        <div className="md:col-span-4">
                          <div className="flex justify-center md:justify-end">
                            {hasUserLocation && (
                              <div className="flex items-center gap-2 mr-2">
                                <Circle size={16} className="text-indigo-500" />
                                <span className="text-sm font-medium text-gray-700">Promień:</span>
                                <Select
                                  value={userRadiusKm ? String(userRadiusKm) : "none"}
                                  onValueChange={(value) => setUserRadiusKm(value !== "none" ? parseInt(value) : null)}
                                >
                                  <SelectTrigger className="w-24 h-8 text-xs">
                                    <SelectValue placeholder="Wybierz" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Brak</SelectItem>
                                    {RADIUS_OPTIONS.map((radius) => (
                                      <SelectItem key={radius} value={String(radius)}>
                                        {radius} km
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setIsClientListOpen(true)}
                              disabled={userRadiusKm === null}
                              className={`h-8 text-xs flex items-center gap-1 border ${
                                userRadiusKm === null
                                  ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                              }`}
                            >
                              <ListFilter size={14} className={userRadiusKm === null ? "text-gray-400" : "text-gray-500"} />
                              LISTA
                            </Button>
                          </div>
                        </div>
                    </div>
                  </div>

        {/* Kontener mapy z responsywną wysokością */}
        <div className="w-full h-[70vh] min-h-[450px] relative overflow-hidden" ref={mapContainer} id="map-container">
          {/* Status ładowania mapy */}
          {!mapLoaded && !mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-80">
              <div className="text-center">
                <p className="mb-2">Ładowanie mapy...</p>
                <div className="h-2 w-32 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 animate-pulse"></div>
                </div>
              </div>
            </div>
          )}

          {/* Status ładowania klientów */}
          {mapLoaded && loading && (
            <div className="absolute top-4 right-4 bg-white p-2 rounded-md shadow-md">
              <div className="flex items-center space-x-2">
                <div className="h-4 w-4 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-700">Ładowanie klientów...</span>
              </div>
            </div>
          )}

          {/* Komunikat o błędzie */}
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center p-6 max-w-md">
                <h3 className="text-xl font-semibold mb-4 text-red-600">Błąd ładowania mapy</h3>
                <p className="text-gray-700 mb-4">{mapError}</p>
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md text-left mb-4">
                  <p className="text-sm text-yellow-800"><strong>Sugestie rozwiązania problemu:</strong></p>
                  <ul className="list-disc pl-5 mt-2 text-sm text-yellow-700">
                    <li>Sprawdź, czy biblioteka mapbox-gl jest zainstalowana: <code>npm install mapbox-gl</code></li>
                    <li>Sprawdź, czy biblioteka turf.js jest zainstalowana: <code>npm install @turf/turf</code></li>
                    <li>Sprawdź połączenie internetowe</li>
                    <li>Upewnij się, że token Mapbox jest prawidłowy</li>
                    <li>Sprawdź, czy przeglądarka wspiera WebGL</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Komunikat o błędzie pobierania klientów */}
          {error && (
            <div className="absolute top-4 right-4 bg-white p-3 rounded-md shadow-md border-l-4 border-red-500">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Informacja o liczbie oddziałów i klientów */}
        <div className="p-2 text-sm text-gray-500 border-t flex justify-between items-center bg-gray-50">
          <div className="flex space-x-4">
            <div>
              Liczba oddziałów: {selectedBranch !== "all" ? '1' : BRANCHES.length}
            </div>
            <div>
              Klienci: {stats.totalClients}
              {stats.totalClients > 0 &&
                ` (${stats.freeClients} wolnych, ${stats.assignedClients} zajętych${
                  stats.ownClients > 0 ? `, ${stats.ownClients} własnych` : ''
                })`
              }
            </div>
          </div>

          {isMobile && (
            <div className="text-xs text-blue-600">
              <div className="flex items-center">
                <Navigation size={12} className="mr-1" />
                Dostępna nawigacja
              </div>
            </div>
          )}
        </div>

        {/* Popup z listą klientów */}
        <ClientListView
          clients={clients}
          isOpen={isClientListOpen}
          onClose={() => setIsClientListOpen(false)}
          userLatitude={userLatitude}
          userLongitude={userLongitude}
          radiusKm={userRadiusKm}
          isMobile={isMobile}
          openNavigation={openNavigation}
          selectedClient={selectedClientId}
          onSelectClient={handleClientSelection}
        />
      </CardContent>
    </Card>
  );
};

export default MapView;