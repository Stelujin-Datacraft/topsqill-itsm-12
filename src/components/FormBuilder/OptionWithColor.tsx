import React from 'react';

interface OptionWithColorProps {
  option: {
    id: string;
    value: string;
    label: string;
    color?: string;
  };
  children: React.ReactNode;
  className?: string;
}

export function OptionWithColor({ option, children, className = '' }: OptionWithColorProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {option.color && (
        <div 
          className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0" 
          style={{ backgroundColor: option.color }}
          title={`Color: ${option.color}`}
        />
      )}
      {children}
    </div>
  );
}