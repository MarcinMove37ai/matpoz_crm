import React, { useState, useRef, useEffect } from 'react';
import { Button } from "./button";
import { Check, ChevronDown } from 'lucide-react';
import { cn } from "@/lib/utils";

interface SelectItemType {
  value: string;
  label: string;
}

interface ScrollableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  items: SelectItemType[];
  disabled?: boolean;
  className?: string;
  expandUpward?: boolean;
  emptyMessage?: string;
}

const ScrollableSelect: React.FC<ScrollableSelectProps> = ({
  value,
  onValueChange,
  placeholder,
  items,
  disabled = false,
  className = '',
  expandUpward = true,
  emptyMessage = "Brak opcji do wyboru",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [shouldExpandUp, setShouldExpandUp] = useState(expandUpward);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedItem = items.find(item => item.value === value);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = Math.min(240, items.length * 40);

      if (expandUpward) {
        setShouldExpandUp(spaceAbove >= dropdownHeight || spaceAbove > spaceBelow);
      } else {
        setShouldExpandUp(spaceBelow < dropdownHeight && spaceAbove > spaceBelow);
      }
    } else {
      setShouldExpandUp(expandUpward);
    }
  }, [isOpen, expandUpward, items.length]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setHighlightedIndex(prev => (prev < items.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex(prev => (prev > 0 ? prev - 1 : items.length - 1));
          break;
        case 'Enter':
          event.preventDefault();
          if (highlightedIndex >= 0 && items[highlightedIndex]) {
            handleSelect(items[highlightedIndex].value);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, highlightedIndex, items]);

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    if(isOpen) {
        setHighlightedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          "w-full justify-between h-11 px-4 py-2 bg-gradient-to-br from-white to-gray-50",
          "border-2 border-gray-200 hover:border-blue-300 transition-all duration-200",
          "hover:shadow-md hover:bg-gradient-to-br hover:from-blue-50 hover:to-white",
          "focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:bg-white",
          "text-gray-700 font-medium rounded-lg", // ZMIANA: rounded-xl -> rounded-lg
          disabled && "bg-gray-100 opacity-60 cursor-not-allowed hover:border-gray-200 hover:shadow-none",
          isOpen && "border-blue-500 ring-4 ring-blue-100 shadow-lg bg-white"
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

      {isOpen && (
        <div
          className={cn(
            "absolute z-50 w-full bg-white border-2 border-blue-200 rounded-lg shadow-2xl", // ZMIANA: rounded-xl -> rounded-lg
            "backdrop-blur-sm transition-all duration-200 ease-out",
            shouldExpandUp ? "bottom-full mb-2" : "top-full mt-2"
          )}
          style={{
            animation: isOpen ? 'fadeInScale 0.2s ease-out' : undefined
          }}
        >
          <div
            ref={dropdownRef}
            className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
          >
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-600 text-sm font-medium">
                {emptyMessage}
              </div>
            ) : (
              <div className="py-1">
                {items.map((item, index) => (
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

export default ScrollableSelect;