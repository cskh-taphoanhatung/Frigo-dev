import React from 'react';
import { getIngredientImage } from '../../lib/ingredient-images';
import { StatusChip } from './StatusChip';
import { QuantityStepper } from './QuantityStepper';
import { FreshnessStatus } from '@frigo/domain';
import { presentExpiry } from '../../lib/inventory-truth';
import { Trash2 } from 'lucide-react';

interface IngredientRowProps {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  storage?: string;
  freshness: FreshnessStatus;
  ingredientId?: string;
  expiryDate?: string;
  /** Inventory Truth expiry semantics; absent for legacy projection rows. */
  expiryKind?: string | null;
  estimatedExpiryDate?: string | null;
  onClick?: () => void;
  onUpdateQuantity?: (delta: number) => void;
  onDelete?: () => void;
}

export const IngredientRow: React.FC<IngredientRowProps> = ({
  id,
  name,
  quantity,
  unit,
  storage,
  freshness,
  ingredientId,
  expiryDate,
  expiryKind,
  estimatedExpiryDate,
  onClick,
  onUpdateQuantity,
  onDelete,
}) => {
  const imgSrc = getIngredientImage(ingredientId, name);
  // T13: an item with no expiry evidence must not be presented as fresh with a
  // fabricated "Còn N ngày" countdown.
  const expiry = presentExpiry({ expiryKind, expiryDate, estimatedExpiryDate });

  return (
    <div
      onClick={onClick}
      data-testid="inventory-row"
      data-item-id={id}
      className="bg-white rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-y-1 border border-slate-200/80 shadow-card hover:border-takosan-green/40 hover:shadow-elevated active:scale-[0.99] transition-tap cursor-pointer"
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 p-2 overflow-hidden">
          <img
            src={imgSrc}
            alt={name}
            className="w-full h-full object-contain"
            loading="lazy"
          />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-heading font-bold text-[15px] text-slate-900 truncate">
              {name}
            </h4>
            <StatusChip status={expiry.tone === 'unknown' ? 'unknown'
              : expiry.tone === 'estimated' ? 'estimated' : freshness} />
          </div>

          <p className="text-xs text-slate-500 font-semibold truncate">
            {quantity} {unit}
            {storage === 'freezer' ? ' · Ngăn đông' : ''}
            {expiry.date === null ? ' · Chưa rõ hạn' : (() => {
              const diff = new Date(expiry.date).getTime() - new Date().getTime();
              const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
              const prefix = expiry.estimated ? ' · Ước tính' : ' ·';
              return days < 0 ? `${prefix} đã quá hạn` : `${prefix} còn ${days} ngày`;
            })()}
          </p>
        </div>
      </div>

      {/* Wraps under the identity block at 200% text zoom instead of
          forcing document-level horizontal overflow. */}
      <div className="flex flex-wrap items-center justify-end gap-1.5 ml-auto" onClick={(e) => e.stopPropagation()}>
        {onUpdateQuantity && (
          <QuantityStepper
            quantity={quantity}
            unit={unit}
            onIncrement={() => onUpdateQuantity(unit === 'g' ? 50 : 1)}
            onDecrement={() => onUpdateQuantity(unit === 'g' ? -50 : -1)}
          />
        )}

        {onDelete && (
          <button
            onClick={onDelete}
            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 transition-colors tap-target flex items-center justify-center"
            aria-label="Xóa nguyên liệu"
          >
            <Trash2 className="w-4.5 h-4.5 stroke-[2]" />
          </button>
        )}
      </div>
    </div>
  );
};
