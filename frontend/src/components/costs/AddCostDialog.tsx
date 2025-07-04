import React, { useEffect, useState } from 'react';
import ScrollableSelect from "@/components/ui/ScrollableSelect";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { mapFormDataToCostData } from '@/mappers/costMapper';
import { costsService } from '@/services/costs';
import { CostData } from '@/types/costs';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "../../components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from 'lucide-react';

interface AddCostDialogProps {
  onAddCost: (costData: CostData) => void;
  representatives?: Array<{ id: string; name: string }>;
  selectedYear?: number;
  userRole?: string;
  userBranch?: string;
}

interface FormErrors {
  [key: string]: string;
}

// Funkcja pomocnicza do normalizacji nazwy oddziału
const normalizeBranchName = (branch: string): string => {
  if (!branch) return '';

  // Mapowanie nazw oddziałów
  const branchMap: Record<string, string> = {
    "LUBLIN": "Lublin",
    "PCIM": "Pcim",
    "RZGOW": "Rzgów",
    "RZGÓW": "Rzgów",
    "MALBORK": "Malbork",
    "LOMZA": "Łomża",
    "ŁOMŻA": "Łomża",
    "LOMŻA": "Łomża",
    "MYSLIBORZ": "Myślibórz",
    "MYŚLIBÓRZ": "Myślibórz"
  };

  return branchMap[branch.toUpperCase()] || branch;
};

const AddCostDialog: React.FC<AddCostDialogProps> = ({
  onAddCost,
  representatives: providedRepresentatives,
  selectedYear,
  userRole,
  userBranch
}) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [costTypes, setCostTypes] = useState<Array<{ id: string, kind: string }>>([]);
  const [representativesList, setRepresentativesList] = useState<Array<{ id: string, name: string }>>([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  // Dodaj tę linię po deklaracji costTypes
  const normalizedBranch = React.useMemo(() => normalizeBranchName(userBranch || ''), [userBranch]);

  const [formData, setFormData] = useState({
    contractor: '',
    nip: '',
    invoiceNumber: '',
    amount: '',
    month: '',
    costType: '',
    description: '',
    costOwner: '',
    representative: '',
    department: ((userRole === 'BRANCH' || userRole === 'STAFF') && normalizedBranch) ? normalizedBranch : '',
    year: selectedYear?.toString() || ''
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const months = [
    { value: "1", label: "Styczeń" },
    { value: "2", label: "Luty" },
    { value: "3", label: "Marzec" },
    { value: "4", label: "Kwiecień" },
    { value: "5", label: "Maj" },
    { value: "6", label: "Czerwiec" },
    { value: "7", label: "Lipiec" },
    { value: "8", label: "Sierpień" },
    { value: "9", label: "Wrzesień" },
    { value: "10", label: "Październik" },
    { value: "11", label: "Listopad" },
    { value: "12", label: "Grudzień" },
  ];

  const costOwners = [
    "Wspólny",
    "Oddział",
    "Centrala",
    "Przedstawiciel"
  ];

  const departments = [
    "Pcim",
    "Rzgów",
    "Malbork",
    "Lublin",
    "Łomża",
    "Myślibórz",
    "MG",
    "STH",
    "BHP"
  ];

  // Move the handleDepartmentChange definition here, outside of the useEffect
  const handleDepartmentChange = (value: string) => {
    setSelectedDepartment(value);
    handleInputChange('department', value);

    // Dla ADMIN i BOARD nie odświeżamy listy przedstawicieli przy zmianie oddziału
    // Lista zawsze zawiera wszystkich przedstawicieli
  };

  // Separate the useEffects to avoid dependency issues
  useEffect(() => {
    const fetchCostTypes = async () => {
      try {
        const response = await fetch('/api/cost_kinds');
        const data = await response.json();
        setCostTypes(data);
      } catch (error) {
        console.error('Błąd podczas pobierania rodzajów kosztów:', error);
      }
    };

    fetchCostTypes();
  }, []);

  // Separate useEffect for fetching representatives
  useEffect(() => {
    const fetchRepresentatives = async () => {
      try {
        // Jeśli podano listę przedstawicieli z zewnątrz, użyj jej
        if (providedRepresentatives && providedRepresentatives.length > 0) {
          setRepresentativesList(providedRepresentatives);
          return;
        }

        // W przeciwnym razie pobierz unikalnych przedstawicieli z bazy
        // Jeśli użytkownik ma rolę BRANCH lub STAFF, filtrujemy po oddziale
        // Dla ADMIN i BOARD zawsze pobieramy pełną listę
        const endpoint = (userRole === 'BRANCH' || userRole === 'STAFF') && normalizedBranch
          ? `/api/representatives?branch=${encodeURIComponent(normalizedBranch)}`
          : '/api/representatives';

        const response = await fetch(endpoint);
        const data = await response.json();

        if (data && Array.isArray(data)) {
          // Mapuj dane do formatu { id: representative_name, name: representative_name }
          // W ten sposób zachowujemy pełną nazwę przedstawiciela jako wartość przekazywaną dalej
          const mappedData = data.map((rep) => ({
            id: rep.representative_name,
            name: rep.representative_name
          }));

          setRepresentativesList(mappedData);
        }
      } catch (error) {
        console.error('Błąd podczas pobierania listy przedstawicieli:', error);
        // W przypadku błędu ustaw pustą listę
        setRepresentativesList([]);
      }
    };

    fetchRepresentatives();
  }, [providedRepresentatives, userRole, normalizedBranch]);

  useEffect(() => {
    if (formData.costOwner === 'Oddział' || formData.costOwner === 'Centrala') {
      setFormData(prev => ({
        ...prev,
        representative: 'none'
      }));
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.representative;
        return newErrors;
      });
    } else if (formData.costOwner === 'Przedstawiciel') {
      setErrors(prev => ({
        ...prev,
        representative: 'Pole obowiązkowe'
      }));
      setFormData(prev => ({
        ...prev,
        representative: ''
      }));
    }
  }, [formData.costOwner]);

  // Ustawienie oddziału tylko raz przy inicjalizacji komponentu lub gdy zmienia się userRole/userBranch
  useEffect(() => {
    console.log('Otrzymane wartości props:', { userRole, userBranch, normalizedBranch });

    if ((userRole === 'BRANCH' || userRole === 'STAFF') && normalizedBranch) {
      // Sprawdź, czy oddział istnieje na liście
      const branchExists = departments.includes(normalizedBranch);
      console.log('Ustawianie oddziału na:', normalizedBranch, 'istnieje na liście:', branchExists);

      if (branchExists) {
        // Używamy funkcji aktualizującej formData, aby uniknąć nieskończonej pętli
        setFormData(prev => {
          // Sprawdź, czy wartość już jest ustawiona, jeśli tak - nie aktualizuj
          if (prev.department === normalizedBranch) {
            return prev;
          }
          return {
            ...prev,
            department: normalizedBranch
          };
        });
      } else {
        console.warn('Oddział nie znajduje się na liście dostępnych oddziałów:', normalizedBranch);
      }
    }
  }, [userRole, userBranch, normalizedBranch, departments]);

  useEffect(() => {
      // Przy zamknięciu formularza, zresetuj go
      if (!open) {
        resetForm();
      }
  }, [open]); // Usuwamy zależności, które mogą powodować nieskończoną pętlę

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

        // Dodajemy walidację NIP
      if (formData.nip && !/^\d{10}$/.test(formData.nip)) {
        newErrors.nip = 'NIP musi składać się z 10 cyfr';
      }

      // Dodajemy walidację kwoty
      if (formData.amount && (isNaN(Number(formData.amount)) || Number(formData.amount) <= 0)) {
        newErrors.amount = 'Kwota musi być większa od 0';
      }

    const requiredFields = {
      contractor: 'Pole obowiązkowe',
      nip: 'Pole obowiązkowe',
      invoiceNumber: 'Pole obowiązkowe',
      amount: 'Pole obowiązkowe',
      month: 'Pole obowiązkowe',
      costType: 'Pole obowiązkowe',
      description: 'Pole obowiązkowe',
      costOwner: 'Pole obowiązkowe',
      department: 'Pole obowiązkowe',
      year: 'Pole obowiązkowe'
    };

    Object.keys(requiredFields).forEach(field => {
      if (!formData[field as keyof typeof formData]) {
        newErrors[field] = requiredFields[field as keyof typeof requiredFields];
      }
    });

    if (formData.costOwner === 'Przedstawiciel' &&
        (formData.representative === 'none' || !formData.representative)) {
      newErrors.representative = 'Pole obowiązkowe';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      if (validateForm()) {
        try {
          const costData = mapFormDataToCostData({
            ...formData,
            year: selectedYear || new Date().getFullYear(),
            author: user?.fullName || user?.username || ''
          });

          await costsService.createCost(costData);

          setNotification({
            type: 'success',
            message: 'Koszt został pomyślnie dodany'
          });

          onAddCost(costData);
          setOpen(false);
          resetForm();
        } catch (error) {
          setNotification({
            type: 'error',
            message: error instanceof Error ? error.message : 'Wystąpił błąd podczas zapisywania kosztu'
          });
        }
      }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    if (field === 'representative' && formData.costOwner === 'Przedstawiciel') {
      if (value) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.representative;
          return newErrors;
        });
      } else {
        setErrors(prev => ({
          ...prev,
          representative: 'Pole obowiązkowe'
        }));
      }
    }
  };

  const resetForm = () => {
    const initialDepartment = ((userRole === 'BRANCH' || userRole === 'STAFF') && normalizedBranch)
      ? normalizedBranch
      : '';

    console.log('Resetowanie formularza - userRole:', userRole);
    console.log('Resetowanie formularza - userBranch:', userBranch);
    console.log('Resetowanie formularza - normalizedBranch:', normalizedBranch);
    console.log('Resetowanie formularza - initialDepartment:', initialDepartment);

    setFormData({
      contractor: '',
      nip: '',
      invoiceNumber: '',
      amount: '',
      month: '',
      costType: '',
      description: '',
      costOwner: '',
      representative: '',
      department: initialDepartment,
      year: selectedYear?.toString() || ''
    });
    setErrors({});
    setNotification(null);
  };

  const isRepresentativeFieldDisabled = () => {
    return formData.costOwner === 'Oddział' || formData.costOwner === 'Centrala';
  };

  const shouldShowNoRepresentative = () => {
    return formData.costOwner !== 'Przedstawiciel';
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="bg-blue-600 text-white hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Dodaj koszt</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-blue-50" aria-describedby="dialog-description">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-800">
              Dodaj nowy koszt{selectedYear ? ` dla roku ${selectedYear}` : ''}
          </DialogTitle>
          <DialogDescription className="text-gray-500" id="dialog-description">
            Formularz dodawania nowego kosztu do systemu
          </DialogDescription>
          <div className="border-t border-gray-200" />
        </DialogHeader>

        {notification && (
          <Alert
            variant={notification.type === 'success' ? 'default' : 'destructive'}
            className="mb-4"
          >
            <AlertDescription>{notification.message}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Sekcja 1: Dane kontrahenta */}
          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-3">Dane kontrahenta</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col">
                <Input
                  id="contractor"
                  value={formData.contractor}
                  onChange={(e) => handleInputChange('contractor', e.target.value)}
                  placeholder="Nazwa kontrahenta"
                  className="bg-white text-gray-800"
                  required
                />
                {errors.contractor && (
                  <span className="text-red-500 text-sm mt-1">{errors.contractor}</span>
                )}
              </div>
              <div className="flex flex-col">
                <Input
                  id="nip"
                  value={formData.nip}
                  onChange={(e) => handleInputChange('nip', e.target.value)}
                  placeholder="NIP kontrahenta"
                  className="bg-white text-gray-800"
                  required
                />
                {errors.nip && (
                  <span className="text-red-500 text-sm mt-1">{errors.nip}</span>
                )}
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="border-t border-gray-200" />

          {/* Sekcja 2: Dane faktury */}
          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-3">Dane faktury</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col">
                <Input
                  id="invoiceNumber"
                  value={formData.invoiceNumber}
                  onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                  placeholder="Numer faktury"
                  className="bg-white text-gray-800"
                  required
                />
                {errors.invoiceNumber && (
                  <span className="text-red-500 text-sm mt-1">{errors.invoiceNumber}</span>
                )}
              </div>
              <div className="flex flex-col">
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => handleInputChange('amount', e.target.value)}
                  placeholder="Kwota"
                  className="bg-white text-gray-800"
                  required
                />
                {errors.amount && (
                  <span className="text-red-500 text-sm mt-1">{errors.amount}</span>
                )}
              </div>
              <div className="flex flex-col">
                  <ScrollableSelect
                    value={formData.month}
                    onValueChange={(value) => handleInputChange('month', value)}
                    placeholder="Wybierz miesiąc"
                    items={months.map(month => ({
                      value: month.value,
                      label: month.label
                    }))}
                  />
                  {errors.month && (
                    <span className="text-red-500 text-sm mt-1">{errors.month}</span>
                  )}
                </div>
            </div>
          </div>

          {/* Separator */}
          <div className="border-t border-gray-200" />

          {/* Sekcja 3: Klasyfikacja kosztu */}
          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-3">Klasyfikacja kosztu</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col">
                <SearchableSelect
                  value={formData.costType}
                  onValueChange={(value) => handleInputChange('costType', value)}
                  placeholder="Wybierz rodzaj kosztu"
                  items={costTypes.map(type => ({
                    value: type.kind,
                    label: type.kind
                  }))}
                  emptyMessage="Nie znaleziono rodzaju kosztu"
                />
                {errors.costType && (
                  <span className="text-red-500 text-sm mt-1">{errors.costType}</span>
                )}
              </div>
              <div className="flex flex-col">
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Za co?"
                  className="bg-white text-gray-800"
                  required
                />
                {errors.description && (
                  <span className="text-red-500 text-sm mt-1">{errors.description}</span>
                )}
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="border-t border-gray-200" />

          {/* Sekcja 4: Przypisanie kosztu */}
          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-3">Przypisanie kosztu</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col">
                <ScrollableSelect
                  value={formData.costOwner}
                  onValueChange={(value) => handleInputChange('costOwner', value)}
                  placeholder="Właściciel kosztu"
                  items={costOwners.map(owner => ({
                    value: owner,
                    label: owner
                  }))}
                />
                {errors.costOwner && (
                  <span className="text-red-500 text-sm mt-1">{errors.costOwner}</span>
                )}
              </div>

              <div className="flex flex-col">
                  <ScrollableSelect
                    value={formData.department}
                    onValueChange={(value) => handleDepartmentChange(value)}
                    placeholder="Oddział"
                    disabled={userRole === 'BRANCH' || userRole === 'STAFF'}
                    items={departments.map(dept => ({
                      value: dept,
                      label: dept
                    }))}
                  />
                  {errors.department && (
                    <span className="text-red-500 text-sm mt-1">{errors.department}</span>
                  )}
              </div>

              <div className="flex flex-col">
                <SearchableSelect
                  value={formData.representative}
                  onValueChange={(value) => handleInputChange('representative', value)}
                  placeholder="Przedstawiciel"
                  disabled={isRepresentativeFieldDisabled()}
                  items={[
                    ...(shouldShowNoRepresentative() ? [{ value: 'none', label: 'Brak przedstawiciela' }] : []),
                    ...representativesList.map(rep => ({
                      value: rep.id,
                      label: rep.name
                    }))
                  ]}
                  emptyMessage="Nie znaleziono przedstawiciela"
                />
                {errors.representative && (
                  <span className="text-red-500 text-sm mt-1">{errors.representative}</span>
                )}
              </div>
            </div>
          </div>

          {/* Przyciski akcji */}
          <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="bg-white text-gray-900"
            >
              Anuluj
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Dodaj koszt
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCostDialog;