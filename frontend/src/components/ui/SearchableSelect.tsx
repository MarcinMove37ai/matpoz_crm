// src/components/ui/SearchableSelect.tsx

import React, { useState, useRef, useEffect } from 'react';
import { Input } from "./input";
import { Button } from "./button";
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from "@/lib/utils";

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  items: Array<{ value: string; label: string }>;
  disabled?: boolean;
  emptyMessage?: string;
  className?: string;
  expandUpward?: boolean; // Opcja do rozwijania do góry (domyślnie true)
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onValueChange,
  placeholder,
  items,
  disabled = false,
  emptyMessage = "Nie znaleziono wyników",
  className,
  expandUpward = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [shouldExpandUp, setShouldExpandUp] = useState(expandUpward);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Filtruj elementy na podstawie zapytania wyszukiwania
  const filteredItems = items.filter(item =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Znajdź wybrany element
  const selectedItem = items.find(item => item.value === value);

  // Automatyczne wykrywanie czy rozwijać do góry czy w dół
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = Math.min(240, filteredItems.length * 40 + 60); // Szacunkowa wysokość

      // Jeśli expandUpward jest true, sprawdź czy jest miejsce do góry
      if (expandUpward) {
        setShouldExpandUp(spaceAbove >= dropdownHeight || spaceAbove > spaceBelow);
      } else {
        setShouldExpandUp(spaceBelow < dropdownHeight && spaceAbove > spaceBelow);
      }
    } else {
      setShouldExpandUp(expandUpward);
    }
  }, [isOpen, expandUpward, filteredItems.length]);

  // Zamknij dropdown przy kliknięciu poza komponent
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Obsługa klawiszy
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setHighlightedIndex(prev =>
            prev < filteredItems.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex(prev =>
            prev > 0 ? prev - 1 : filteredItems.length - 1
          );
          break;
        case 'Enter':
          event.preventDefault();
          if (highlightedIndex >= 0 && filteredItems[highlightedIndex]) {
            handleSelect(filteredItems[highlightedIndex].value);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setSearchQuery('');
          setHighlightedIndex(-1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, highlightedIndex, filteredItems]);

  // Reset highlighted index when search query changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchQuery]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue);
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
  };

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchQuery('');
      setHighlightedIndex(-1);
    }
  };

  // Sprawdź czy filtr jest aktywny (ma zielone tło)
  const isActiveFilter = className?.includes('bg-green-50');

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Main button/trigger */}
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          "w-full justify-between h-11 px-4 py-2",
          // Warunkowo aplikuj tło - zielone dla aktywnych filtrów, gradient dla nieaktywnych
          isActiveFilter
            ? "bg-green-50"
            : "bg-gradient-to-br from-white to-gray-50",
          "border-2 border-gray-200 hover:border-blue-300 transition-all duration-200",
          "hover:shadow-md",
          // Warunkowo aplikuj hover tło
          isActiveFilter
            ? "hover:bg-green-100"
            : "hover:bg-gradient-to-br hover:from-blue-50 hover:to-white",
          "focus:border-blue-500 focus:ring-4 focus:ring-blue-100",
          // Warunkowo aplikuj focus tło
          isActiveFilter
            ? "focus:bg-green-50"
            : "focus:bg-white",
          "text-gray-700 font-medium rounded-lg",
          disabled && "bg-gray-100 opacity-60 cursor-not-allowed hover:border-gray-200 hover:shadow-none",
          isOpen && "border-blue-500 ring-4 ring-blue-100 shadow-lg",
          // Warunkowo aplikuj open tło
          isOpen && (isActiveFilter ? "bg-green-50" : "bg-white"),
          className && !isActiveFilter ? className : "" // Aplikuj className tylko jeśli nie jest to aktywny filtr
        )}
      >
        <span className={cn(
          "truncate text-left",
          selectedItem ? "text-gray-800" : "text-gray-500"
        )}>
          {selectedItem ? selectedItem.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-gray-400 transition-all duration-300",
            isOpen && "rotate-180 text-blue-500"
          )}
        />
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 w-full bg-white border-2 border-blue-200 rounded-lg shadow-2xl",
            "backdrop-blur-sm transition-all duration-200 ease-out",
            shouldExpandUp ? "bottom-full mb-2" : "top-full mt-2"
          )}
          style={{
            animation: isOpen ? 'fadeInScale 0.2s ease-out' : undefined
          }}
        >
          {/* Search input */}
          <div className="p-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-600" />
              <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Szukaj opcji..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "search-input-override",
                    "pl-10 h-10 text-sm border-2 border-transparent bg-white text-gray-900",
                    "focus:border-blue-400 focus:ring-2 focus:ring-blue-100",
                    "rounded-lg shadow-sm transition-all duration-200",
                    "placeholder:text-gray-500"
                  )}
              />
            </div>
          </div>

          {/* Items list */}
          <div
            ref={dropdownRef}
            className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
          >
            {filteredItems.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="text-gray-600 text-sm font-medium">
                  {emptyMessage}
                </div>
                <div className="text-gray-500 text-xs mt-1">
                  Spróbuj zmienić wyszukiwane hasło
                </div>
              </div>
            ) : (
              <div className="py-1">
                {filteredItems.map((item, index) => (
                  <div
                    key={item.value}
                    onClick={() => handleSelect(item.value)}
                    className={cn(
                      "mx-2 my-1 px-3 py-2.5 text-sm cursor-pointer rounded-lg",
                      "flex items-center justify-between transition-all duration-150",
                      "text-gray-800 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50",
                      "hover:text-blue-900 hover:shadow-sm hover:scale-[1.02]",
                      highlightedIndex === index && "bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-900 shadow-sm scale-[1.02]",
                      value === item.value && "bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold shadow-md"
                    )}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <span className="truncate">{item.label}</span>
                    {value === item.value && (
                      <Check className="h-4 w-4 text-white ml-2 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .search-input-override:focus,
        .search-input-override:focus-visible {
          outline: none !important;
        }

        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }

        .scrollbar-thumb-gray-300::-webkit-scrollbar-thumb {
          background-color: #d1d5db;
          border-radius: 3px;
        }

        .scrollbar-track-gray-100::-webkit-scrollbar-track {
          background-color: #f3f4f6;
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
};

export default SearchableSelect;