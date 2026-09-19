import React from 'react';

interface QuantityStepperProps {
  quantity: number;
  unit: string;
  onIncrement: () => void;
  onDecrement: () => void;
  min?: number;
}

export const QuantityStepper: React.FC<QuantityStepperProps> = ({
  quantity,
  unit,
  onIncrement,
  onDecrement,
  min = 1,
}) => {
  return (
    <div
      className="inline-flex items-center bg-semantic-background-subtle border border-semantic-border rounded-xl p-0.5 shadow-xs"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onDecrement}
        disabled={quantity <= min}
        className="w-7 h-7 flex items-center justify-center font-bold text-sm text-semantic-text-secondary hover:bg-white hover:text-semantic-text-primary hover:shadow-xs active:scale-95 disabled:opacity-30 rounded-lg transition-tap tap-target"
        aria-label="Giảm số lượng"
      >
        –
      </button>

      <span className="font-heading font-bold text-xs px-2 min-w-[50px] text-center text-semantic-text-primary">
        {quantity} {unit}
      </span>

      <button
        onClick={onIncrement}
        className="w-7 h-7 flex items-center justify-center font-bold text-sm text-semantic-text-secondary hover:bg-white hover:text-semantic-text-primary hover:shadow-xs active:scale-95 rounded-lg transition-tap tap-target"
        aria-label="Tăng số lượng"
      >
        +
      </button>
    </div>
  );
};
