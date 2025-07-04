/**
 * @file src/components/ui/ClientListView.tsx
 * @description Komponent listy klientów wyświetlający dane w popupie z informacją o odległości
 */

import React, { useState, useEffect } from 'react';
import { Navigation, Search, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

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
  distance?: number; // Odległość od użytkownika (opcjonalna)
}

// Interfejs dla props komponentu
interface ClientListViewProps {
  clients: Client[];
  isOpen: boolean;
  onClose: () => void;
  userLatitude: number | null;
  userLongitude: number | null;
  radiusKm: number | null;
  isMobile: boolean;
  openNavigation: (latitude: number, longitude: number) => void;
  selectedClient?: string | null;
  onSelectClient?: (clientId: string) => void;
}

const ClientListView: React.FC<ClientListViewProps> = ({
  clients,
  isOpen,
  onClose,
  userLatitude,
  userLongitude,
  radiusKm,
  isMobile,
  openNavigation,
  selectedClient,
  onSelectClient
}) => {
  // Stan dla filtrowania
  const [showFreeClients, setShowFreeClients] = useState<boolean>(true);
  const [showBusyClients, setShowBusyClients] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Stan dla posortowanych klientów
  const [sortedClients, setSortedClients] = useState<Client[]>([]);

  // Efekt obliczający odległości i sortujący klientów
  useEffect(() => {
    if (!userLatitude || !userLongitude) {
      setSortedClients([...clients]);
      return;
    }

    // Obliczenie odległości dla każdego klienta
    const clientsWithDistance = clients.map(client => {
      // Obliczenie odległości w linii prostej (w kilometrach)
      const distance = calculateDistance(
        userLatitude,
        userLongitude,
        client.latitude,
        client.longitude
      );

      return { ...client, distance };
    });

    // Sortowanie po odległości
    const sorted = [...clientsWithDistance].sort((a, b) => {
      return (a.distance || 0) - (b.distance || 0);
    });

    setSortedClients(sorted);
  }, [clients, userLatitude, userLongitude]);

  // Funkcja obliczająca odległość między dwoma punktami (wzór haversine)
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371; // Promień Ziemi w kilometrach
    const dLat = degreesToRadians(lat2 - lat1);
    const dLon = degreesToRadians(lon2 - lon1);

    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(degreesToRadians(lat1)) * Math.cos(degreesToRadians(lat2)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    return distance;
  };

  // Konwersja stopni na radiany
  const degreesToRadians = (degrees: number): number => {
    return degrees * (Math.PI / 180);
  };

  // Funkcja obsługująca kliknięcie na klienta
  const handleClientClick = (client: Client) => {
    if (onSelectClient) {
      onSelectClient(client.id);
    }
  };

  // Filtrowanie klientów
  const filteredClients = sortedClients.filter(client => {
    // Filtrowanie według statusu
    if (client.status_free && !showFreeClients) return false;
    if (!client.status_free && !showBusyClients) return false;

    // Filtrowanie według promienia
    if (radiusKm !== null && client.distance && client.distance > radiusKm) {
      return false;
    }

    // Filtrowanie według wyszukiwania
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        client.name.toLowerCase().includes(searchLower) ||
        (client.address && client.address.toLowerCase().includes(searchLower))
      );
    }

    return true;
  });

  // Jeśli popup nie jest otwarty, nic nie renderuj
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[80vh] flex flex-col bg-white overflow-hidden shadow-lg">
        {/* Header */}
        <div className="p-4 pb-2 border-b bg-gray-50">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">
              Lista klientów {radiusKm ? `(w promieniu ${radiusKm} km)` : ''}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-gray-500 hover:text-gray-700"
            >
              <X size={18} />
            </Button>
          </div>
          <p className="text-sm text-gray-600">
            {filteredClients.length} klientów spełnia kryteria
          </p>
        </div>

        <div className="px-4 py-3 border-b bg-white">
          <div className="flex items-center mb-2 relative">
            <Search size={16} className="absolute left-2.5 text-gray-500" />
            <Input
              placeholder="Szukaj klienta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-sm h-9 pl-8 bg-white text-gray-800 border border-gray-200 rounded-md focus:outline-none focus:shadow-none focus:ring-0 focus:border focus:border-gray-200 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          <div className="flex gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="list-show-free"
                checked={showFreeClients}
                onCheckedChange={(checked) => setShowFreeClients(!!checked)}
              />
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <Label htmlFor="list-show-free" className="text-sm font-medium text-gray-600">
                  Wolni
                </Label>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="list-show-busy"
                checked={showBusyClients}
                onCheckedChange={(checked) => setShowBusyClients(!!checked)}
              />
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <Label htmlFor="list-show-busy" className="text-sm font-medium text-gray-600">
                  Zajęci
                </Label>
              </div>
            </div>
          </div>
        </div>

        {/* Client List */}
        <div className="flex-grow py-2 px-4 overflow-auto max-h-[50vh]">
          <div className="space-y-2">
            {filteredClients.length > 0 ? (
              filteredClients.map(client => (
                <div
                  key={client.id}
                  className={`p-3 border rounded-md hover:bg-gray-50 transition-colors cursor-pointer
                    ${selectedClient === client.id ? 'bg-blue-50 border-blue-300' : 'bg-white'}`}
                  onClick={() => handleClientClick(client)}
                >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 mr-2">
                        <h3 className="font-medium text-gray-800 break-words">
                          {client.name}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1 break-words">
                          {client.address}
                        </p>
                      </div>
                      <div className={`flex-shrink-0 w-3 h-3 rounded-full ${client.status_free ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    </div>

                    <div className="flex justify-between items-center mt-2 text-xs">
                      <div className="text-gray-600">
                        {client.distance !== undefined ? (
                          <span>Odległość: <strong>{client.distance.toFixed(1)} km</strong></span>
                        ) : (
                          <span>Brak danych o odległości</span>
                        )}
                      </div>

                      {isMobile && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs flex items-center gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            openNavigation(client.latitude, client.longitude);
                          }}
                        >
                          <Navigation size={12} />
                          Nawiguj
                        </Button>
                      )}
                    </div>
                  </div>
                ))
            ) : (
              <div className="py-8 text-center text-gray-500">
                Brak klientów spełniających kryteria
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 pb-3 px-4 flex justify-between border-t text-xs text-gray-500">
          <div>
            {userLatitude && userLongitude ? 'Posortowano wg odległości' : 'Lokalizacja użytkownika niedostępna'}
          </div>
          {isMobile && (
            <div className="flex items-center">
              <Navigation size={12} className="mr-1" />
              Dostępna nawigacja
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ClientListView;