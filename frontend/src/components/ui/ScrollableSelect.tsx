import React from 'react';
import CustomSelect from './CustomSelect';

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
}

const ScrollableSelect: React.FC<ScrollableSelectProps> = ({
  value,
  onValueChange,
  placeholder,
  items,
  disabled = false,
  className = '',
}) => {
  return (
    <CustomSelect
      value={value}
      onChange={onValueChange}
      options={items}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
};

export default ScrollableSelect;