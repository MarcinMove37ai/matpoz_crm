import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

interface CostKind {
  id: number;
  kind: string;
}

const CostKindsTable = () => {
  const [costKinds, setCostKinds] = useState<CostKind[]>([]);
  const [newKind, setNewKind] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchCostKinds = async () => {
    try {
      const response = await fetch('/api/cost_kinds');
      if (!response.ok) throw new Error('Błąd pobierania danych');
      const data = await response.json();
      setCostKinds(data);
    } catch (err) {
      setError('Wystąpił błąd podczas pobierania rodzajów kosztów');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCostKinds();
  }, []);

  const handleAddCostKind = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKind.trim()) return;

    try {
      if (costKinds.some(kind => kind.kind.toLowerCase() === newKind.trim().toLowerCase())) {
        setError('Podany rodzaj kosztu już istnieje');
        return;
      }

      const response = await fetch('/api/cost_kinds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: newKind.trim() }),
      });

      if (!response.ok) {
        if (response.status === 500) {
          throw new Error('Wystąpił błąd podczas dodawania rodzaju kosztu. Spróbuj ponownie później.');
        }
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Błąd dodawania rodzaju kosztu');
      }

      await fetchCostKinds();
      setNewKind('');
      setError(null);
      setSuccess('Pomyślnie dodano nowy rodzaj kosztu');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteCostKind = async (id: number) => {
    try {
      const response = await fetch(`/api/cost_kinds/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Błąd usuwania rodzaju kosztu');
      }
      await fetchCostKinds();
      setError(null);
      setSuccess('Pomyślnie usunięto rodzaj kosztu');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const confirmDelete = (id: number) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (confirmDeleteId !== null) {
      await handleDeleteCostKind(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center p-4">Ładowanie...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Komunikat błędu */}
      {error && (
        <div className="alert p-4 text-sm border rounded-md border-red-200 bg-red-50 text-red-600">
          {error}
        </div>
      )}

      {/* Komunikat sukcesu */}
      {success && (
        <div className="alert p-4 text-sm border rounded-md border-green-200 bg-green-50 text-green-600">
          {success}
        </div>
      )}

      {/* Potwierdzenie usunięcia */}
      {confirmDeleteId !== null && (
        <div className="alert p-4 text-sm border rounded-md border-yellow-200 bg-yellow-50 text-yellow-600 flex flex-col md:flex-row md:items-center md:justify-between">
          <span>Czy na pewno chcesz usunąć ten rodzaj kosztu?</span>
          <div className="mt-2 md:mt-0 flex gap-2">
            <Button onClick={() => setConfirmDeleteId(null)} className="bg-gray-300 hover:bg-gray-400 text-gray-800">
              Nie
            </Button>
            <Button onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Tak
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-medium text-gray-800">Rodzaje kosztów</h3>
          <span className="text-sm text-gray-500">({costKinds.length})</span>
        </div>
      </div>

      <form onSubmit={handleAddCostKind} className="flex gap-2">
        <Input
          type="text"
          value={newKind}
          onChange={(e) => setNewKind(e.target.value)}
          placeholder="Nowy rodzaj kosztu"
          className="max-w-sm bg-gray-50 text-gray-600"
        />
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Dodaj
        </Button>
      </form>

      <div className="border rounded-md max-h-[300px] overflow-y-auto bg-blue-50">
        <Table>
          <TableHeader>
            <TableRow className="bg-blue-50 hover:bg-blue-50">
              <TableHead className="font-medium text-gray-800">Nazwa</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {costKinds.map((kind) => (
              <TableRow key={kind.id} className="border-b border-blue-100 hover:bg-blue-100">
                <TableCell className="text-gray-800">{kind.kind}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => confirmDelete(kind.id)}
                    className="text-red-600 hover:bg-red-100 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {costKinds.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-gray-500 py-4">
                  Brak zdefiniowanych rodzajów kosztów
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default CostKindsTable;
