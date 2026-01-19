import React, { useEffect, useState, useMemo } from 'react';
import ScrollableSelect from "@/components/ui/ScrollableSelect";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { mapFormDataToCostData } from '@/mappers/costMapper';
import { costsService } from '@/services/costs';
import { CostData } from '@/types/costs';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from '@/hooks/useAuth';
import { useCurrentDate } from '@/hooks/useCurrentDate';
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
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil } from 'lucide-react';

interface EditCostDialogProps {
  onEditCost: (costData: CostData & { cost_id: number }) => void;
  cost: {
    cost_id: number;
    cost_contrahent: string;
    cost_nip: string;
    cost_doc_no: string;
    cost_value: number;
    cost_mo: number;
    cost_year: number;
    cost_kind: string;
    cost_4what: string;
    cost_own: string;
    cost_ph: string | null;
    cost_branch: string;
    cost_author: string;
  } | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  userRole?: string;
  userBranch?: string;
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

const EditCostDialog: React.FC<EditCostDialogProps> = ({
  onEditCost,
  cost,
  isOpen,
  onOpenChange,
  disabled = false,
  userRole,
  userBranch
}) => {
  const { user } = useAuth();
  const { date } = useCurrentDate();
  const [costTypes, setCostTypes] = useState<Array<{ id: string, kind: string }>>([]);
  const [representativesList, setRepresentativesList] = useState<Array<{ id: string, name: string }>>([]);
  const [isCommissionPayment, setIsCommissionPayment] = useState(false);
  const [previousDescription, setPreviousDescription] = useState('');
  const [isPrivateCost, setIsPrivateCost] = useState(false);
  const [previousPrivateState, setPreviousPrivateState] = useState({
    costOwner: '',
    department: '',
    representative: ''
  });
  const normalizedBranch = React.useMemo(() => normalizeBranchName(userBranch || ''), [userBranch]);

  const getAvailableDepartments = () => {
    if (userRole === 'ADMIN' || userRole === 'BASIA') {
      return departments;
    }
    return departments.filter(dept => dept.value !== 'HQ');
  };

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
    department: '',
    year: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Generowanie dostępnych miesięcy na podstawie roli i daty
  const months = useMemo(() => {
    const monthNames = [
      "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
      "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
    ];

    // Admin i BASIA widzą wszystkie miesiące (bez roku w etykiecie)
    if (userRole === 'ADMIN' || userRole === 'BASIA') {
      return monthNames.map((name, index) => ({
        value: (index + 1).toString(),
        label: name
      }));
    }

    // Dla pozostałych użytkowników - ograniczenie
    if (!date) {
      return []; // Jeśli data się nie załadowała, zwróć pustą tablicę
    }

    // Użyj bezpośrednio właściwości z DateResponse
    const currentDay = date.day;
    const currentMonth = date.month;
    const currentYear = date.year;

    const availableMonths = [];

    // Dzień 1-10: bieżący + poprzedni miesiąc
    if (currentDay <= 10) {
      // Poprzedni miesiąc
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      availableMonths.push({
        value: prevMonth.toString(),
        label: `${monthNames[prevMonth - 1]} ${prevYear}`
      });

      // Bieżący miesiąc
      availableMonths.push({
        value: currentMonth.toString(),
        label: `${monthNames[currentMonth - 1]} ${currentYear}`
      });
    } else {
      // Dzień 11+: tylko bieżący miesiąc
      availableMonths.push({
        value: currentMonth.toString(),
        label: `${monthNames[currentMonth - 1]} ${currentYear}`
      });
    }

    return availableMonths;
  }, [date, userRole]);

  const costOwners = [
    "Wspólny",
     "Oddział",
    "Centrala",
    "Przedstawiciel",
    "Prywatny"
  ];
  // Ograniczona lista właścicieli kosztu dla wypłaty prowizji
  const commissionCostOwners = [
    "Oddział",
    "Przedstawiciel"
  ];

  const departments = [
    { value: "HQ", label: "Centrala" },
    { value: "Pcim", label: "Pcim" },
    { value: "Rzgów", label: "Rzgów" },
    { value: "Malbork", label: "Malbork" },
    { value: "Lublin", label: "Lublin" },
    { value: "Łomża", label: "Łomża" },
    { value: "Myślibórz", label: "Myślibórz" },
    { value: "MG", label: "Interent" },
    { value: "STH", label: "Serwis" },
    { value: "BHP", label: "BHP" },
    { value: "Private", label: "Prywatny" }
  ];

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

    // Specjalna obsługa dla właściciela kosztu gdy checkbox wypłaty prowizji jest zaznaczony
    if (field === 'costOwner' && isCommissionPayment) {
      if (value) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.costOwner;
          return newErrors;
        });
      } else {
        setErrors(prev => ({
          ...prev,
          costOwner: 'Pole obowiązkowe'
        }));
      }
    }
  };

  const handleDepartmentChange = (value: string) => {
    handleInputChange('department', value);

    if (value === 'HQ') {
      handleInputChange('costOwner', 'Centrala');
      handleInputChange('representative', 'none');
    } else if (value === 'STH' || value === 'MG' || value === 'BHP') {
      handleInputChange('costOwner', 'Centrala');
    }
  };


  // Obsługa zmiany checkboxa wypłaty prowizji
  const handleCommissionPaymentChange = (checked: boolean) => {
    setIsCommissionPayment(checked);

    if (checked) {
      // Zapisz poprzednią wartość opisu i ustaw nową
      setPreviousDescription(formData.description);
      setFormData(prev => ({
        ...prev,
        costType: 'Wypłata',
        description: 'Wypłata prowizji'
      }));
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.costType;
        delete newErrors.description;
        // Dodaj błąd dla costOwner jeśli nie został wybrany
        if (!formData.costOwner) {
          newErrors.costOwner = 'Pole obowiązkowe';
        }
        return newErrors;
      });

      // Jeśli obecny właściciel kosztu nie jest dozwolony dla prowizji, wyczyść go
      if (formData.costOwner && !commissionCostOwners.includes(formData.costOwner)) {
        setFormData(prev => ({
          ...prev,
          costOwner: ''
        }));
        setErrors(prev => ({
          ...prev,
          costOwner: 'Pole obowiązkowe'
        }));
      }
    } else {
      // Przywróć poprzednią wartość opisu
      setFormData(prev => ({
        ...prev,
        description: previousDescription
      }));
      setPreviousDescription('');
      // Usuń błąd dla costOwner jeśli checkbox jest odznaczony
      setErrors(prev => {
        const newErrors = { ...prev };
        if (formData.costOwner) {
          delete newErrors.costOwner;
        }
        return newErrors;
      });
    }
  };

  // Obsługa zmiany checkboxa kosztu prywatnego
  const handlePrivateCostChange = (checked: boolean) => {
    setIsPrivateCost(checked);

    if (checked) {
      // Zapisz poprzedni stan
      setPreviousPrivateState({
        costOwner: formData.costOwner,
        department: formData.department,
        representative: formData.representative
      });

      // Ustaw wartości dla kosztu prywatnego
      setFormData(prev => ({
        ...prev,
        costOwner: 'Prywatny',
        department: 'Private',
        representative: 'none'
      }));

      // Usuń błędy dla tych pól
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.costOwner;
        delete newErrors.department;
        delete newErrors.representative;
        return newErrors;
      });
    } else {
      // Przywróć poprzedni stan
      setFormData(prev => ({
        ...prev,
        costOwner: previousPrivateState.costOwner,
        department: previousPrivateState.department,
        representative: previousPrivateState.representative
      }));

      setPreviousPrivateState({
        costOwner: '',
        department: '',
        representative: ''
      });
    }
  };

  // Aktualizacja formularza po otwarciu dialogu i otrzymaniu danych kosztu
  useEffect(() => {
    if (isOpen && cost) {
      // Resetowanie powiadomień i błędów przy każdym otwarciu modala
      setNotification(null);
      setErrors({});

      const isCommission = cost.cost_kind === 'Wypłata';
      setIsCommissionPayment(isCommission);

      const isPrivate = cost.cost_own === 'Prywatny';
      setIsPrivateCost(isPrivate);

      // Jeśli to wypłata prowizji, zapisz oryginalną wartość jako poprzednią
      if (isCommission && cost.cost_4what !== 'Wypłata prowizji') {
        setPreviousDescription(cost.cost_4what);
      } else if (!isCommission) {
        setPreviousDescription('');
      }

      setFormData({
        contractor: cost.cost_contrahent,
        nip: cost.cost_nip,
        invoiceNumber: cost.cost_doc_no,
        amount: cost.cost_value.toString(),
        month: cost.cost_mo.toString(),
        costType: cost.cost_kind,
        description: cost.cost_4what,
        costOwner: cost.cost_own,
        representative: cost.cost_ph || '',
        department: cost.cost_branch,
        year: cost.cost_year.toString()
      });
    }
  }, [isOpen, cost]);

  // Pobieranie rodzajów kosztów
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

    if (isOpen) {
      fetchCostTypes();
    }
  }, [isOpen]);

  // Pobieranie przedstawicieli
  useEffect(() => {
    const fetchRepresentatives = async () => {
      try {
        const endpoint = (userRole === 'BRANCH' || userRole === 'STAFF') && normalizedBranch
          ? `/api/representatives?branch=${encodeURIComponent(normalizedBranch)}`
          : '/api/representatives';

        const response = await fetch(endpoint);
        const data = await response.json();

        if (data && Array.isArray(data)) {
          const mappedData = data.map((rep) => ({
            id: rep.representative_name,
            name: rep.representative_name
          }));

          setRepresentativesList(mappedData);
        }
      } catch (error) {
        console.error('Błąd podczas pobierania listy przedstawicieli:', error);
        setRepresentativesList([]);
      }
    };

    if (isOpen) {
      fetchRepresentatives();
    }
  }, [isOpen, userRole, normalizedBranch]);

  // Walidacja dla reprezentanta w zależności od właściciela kosztu
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
        representative: formData.representative ? '' : 'Pole obowiązkowe'
      }));
    }
  }, [formData.costOwner, formData.representative]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Walidacja NIP
    if (formData.nip && !/^\d{10}$/.test(formData.nip)) {
      newErrors.nip = 'NIP musi składać się z 10 cyfr';
    }

    // Walidacja kwoty
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

    if (!cost) {
      setNotification({
        type: 'error',
        message: 'Brak danych kosztu do edycji'
      });
      return;
    }

    if (validateForm()) {
      try {
        // Oblicz właściwy rok na podstawie wybranego miesiąca
        let yearToSave: number;

        // Admin i BASIA mają własne pole roku - używamy go bezpośrednio
        if (userRole === 'ADMIN' || userRole === 'BASIA') {
          yearToSave = parseInt(formData.year, 10);
        } else {
          // Dla pozostałych użytkowników: automatyczna logika
          yearToSave = parseInt(formData.year, 10);

          if (date) {
            // Użyj bezpośrednio właściwości z DateResponse
            const currentMonth = date.month;
            const selectedMonthNum = parseInt(formData.month);

            // Jeśli obecny miesiąc < wybrany miesiąc, to wybrano poprzedni miesiąc z poprzedniego roku
            if (currentMonth < selectedMonthNum) {
              yearToSave = yearToSave - 1;
            }
          }
        }

        const costData = mapFormDataToCostData({
          ...formData,
          year: yearToSave,
          author: user?.fullName || user?.username || cost.cost_author
        });

        const currentUserName = user?.fullName || user?.username || cost.cost_author;
        await costsService.updateCost(cost.cost_id, costData, currentUserName);

        setNotification({
          type: 'success',
          message: 'Koszt został pomyślnie zaktualizowany'
        });

        onEditCost({ ...costData, cost_id: cost.cost_id });
        onOpenChange(false);
      } catch (error) {
        setNotification({
          type: 'error',
          message: error instanceof Error ? error.message : 'Wystąpił błąd podczas aktualizacji kosztu'
        });
      }
    }
  };

  const isRepresentativeFieldDisabled = () => {
    return formData.costOwner === 'Oddział' || formData.costOwner === 'Centrala';
  };

  const shouldShowNoRepresentative = () => {
    return formData.costOwner !== 'Przedstawiciel';
  };

  // Określ które opcje właściciela kosztu wyświetlać
  const getAvailableCostOwners = () => {
    if (isCommissionPayment) {
      return commissionCostOwners;
    }
    // Pokaż "Prywatny" tylko gdy checkbox jest zaznaczony
    if (isPrivateCost) {
      return costOwners;
    }
    // W przeciwnym razie ukryj "Prywatny"
    return costOwners.filter(owner => owner !== 'Prywatny');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-blue-50" aria-describedby="dialog-description">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-800">
            Edytuj koszt
          </DialogTitle>
          <DialogDescription className="text-gray-500" id="dialog-description">
            Formularz edycji kosztu w systemie
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
            <div className={`grid grid-cols-1 gap-4 ${(userRole === 'ADMIN' || userRole === 'BASIA') ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
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
                <SearchableSelect
                  value={formData.month}
                  onValueChange={(value) => handleInputChange('month', value)}
                  placeholder="Wybierz miesiąc"
                  expandUpward={false}
                  items={months.map(month => ({
                    value: month.value,
                    label: month.label
                  }))}
                  emptyMessage="Nie znaleziono miesiąca"
                />
                {errors.month && (
                  <span className="text-red-500 text-sm mt-1">{errors.month}</span>
                )}
              </div>

              {/* Pole roku - tylko dla Admin i BASIA */}
              {(userRole === 'ADMIN' || userRole === 'BASIA') && (
                <div className="flex flex-col">
                  <SearchableSelect
                    value={formData.year}
                    onValueChange={(value) => handleInputChange('year', value)}
                    placeholder="Wybierz rok"
                    expandUpward={false}
                    items={[
                      { value: new Date().getFullYear().toString(), label: new Date().getFullYear().toString() },
                      { value: (new Date().getFullYear() - 1).toString(), label: (new Date().getFullYear() - 1).toString() }
                    ]}
                    emptyMessage="Nie znaleziono roku"
                  />
                  {errors.year && (
                    <span className="text-red-500 text-sm mt-1">{errors.year}</span>
                  )}
                </div>
              )}
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
                  disabled={isCommissionPayment}
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
                  disabled={isCommissionPayment}
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
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${isPrivateCost ? 'bg-orange-50 border border-orange-200 rounded-lg p-4' : ''}`}>
              <div className="flex flex-col">
                <ScrollableSelect
                  value={formData.costOwner}
                  onValueChange={(value) => handleInputChange('costOwner', value)}
                  placeholder="Właściciel kosztu"
                  disabled={formData.department === 'HQ' || isPrivateCost}
                  className={isPrivateCost ? 'bg-purple-50 border-purple-300' : ''}
                  items={getAvailableCostOwners().map(owner => ({
                    value: owner,
                    label: owner
                  }))}
                />
                {errors.costOwner && (
                  <span className="text-red-500 text-sm mt-1">{errors.costOwner}</span>
                )}
              </div>

              <div className="flex flex-col">
                <SearchableSelect
                  value={formData.department}
                  onValueChange={(value) => handleDepartmentChange(value)}
                  placeholder="Oddział"
                  disabled={userRole === 'BRANCH' || userRole === 'STAFF' || isPrivateCost}
                  className={isPrivateCost ? 'bg-purple-50 border-purple-300' : ''}
                  items={getAvailableDepartments().map(dept => ({
                    value: dept.value,
                    label: dept.label
                  }))}
                  emptyMessage="Nie znaleziono oddziału"
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
                  disabled={isRepresentativeFieldDisabled() || formData.department === 'HQ' || isPrivateCost}
                  className={isPrivateCost ? 'bg-purple-50 border-purple-300' : ''}
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
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            {/* Checkboxy - lewy dolny róg */}
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="commission-payment"
                  checked={isCommissionPayment}
                  onCheckedChange={handleCommissionPaymentChange}
                />
                <label
                  htmlFor="commission-payment"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-gray-700"
                >
                  Wypłata prowizji
                </label>
              </div>

              {userRole === 'ADMIN' && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="private-cost"
                    checked={isPrivateCost}
                    onCheckedChange={handlePrivateCostChange}
                  />
                  <label
                    htmlFor="private-cost"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-gray-700"
                  >
                    Koszt prywatny
                  </label>
                </div>
              )}
            </div>

            {/* Przyciski - prawy dolny róg */}
            <div className="flex space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="bg-white text-gray-900"
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                Zapisz zmiany
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditCostDialog;