import React, { useRef, useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Wybierz...',
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (option: SelectOption) => {
    onChange(option.value);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case 'Space':
        e.preventDefault();
        setIsOpen(!isOpen);
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      case 'ArrowDown':
        if (!isOpen) {
          setIsOpen(true);
        } else {
          e.preventDefault();
          const currentIndex = options.findIndex(opt => opt.value === value);
          const nextIndex = (currentIndex + 1) % options.length;
          onChange(options[nextIndex].value);
        }
        break;
      case 'ArrowUp':
        if (!isOpen) {
          setIsOpen(true);
        } else {
          e.preventDefault();
          const currentIndex = options.findIndex(opt => opt.value === value);
          const prevIndex = currentIndex <= 0 ? options.length - 1 : currentIndex - 1;
          onChange(options[prevIndex].value);
        }
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        ref={triggerRef}
        role="combobox"
        aria-controls="select-listbox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={placeholder}
        tabIndex={disabled ? -1 : 0}
        className={cn(
          "relative flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800",
          "hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
      >
        <span className={!selectedOption ? "text-gray-400" : ""}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 opacity-50 transition-transform duration-200",
            isOpen && "transform rotate-180"
          )}
        />
      </div>

      {isOpen && !disabled && (
        <div
          ref={listboxRef}
          role="listbox"
          id="select-listbox"
          className="absolute bottom-full left-0 z-50 w-full mb-1 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg"
          style={{
            maxHeight: '200px',
          }}
        >
          <div
            className="max-h-[200px] overflow-y-auto overscroll-contain p-1"
            onWheel={e => e.stopPropagation()}
          >
            {options.map((option) => (
              <div
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                className={cn(
                  "flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm text-gray-800",
                  "hover:bg-blue-50 focus:bg-blue-100 focus:outline-none",
                  option.value === value && "bg-blue-50"
                )}
                onClick={() => handleSelect(option)}
              >
                {option.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomSelect;