import React from 'react';
import { TAKOSAN_BRAND, type TakosanMascotPose } from '../../lib/takosan-brand';
import { Button } from './Button';

interface EmptyStateProps {
  type?: 'empty-fridge' | 'no-recipes' | 'shopping-ready' | 'delicious-meal' | 'error';
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
}

// Legacy illustration keys map onto the kit's mascot pose library.
const POSE_BY_TYPE: Record<NonNullable<EmptyStateProps['type']>, TakosanMascotPose> = {
  'empty-fridge': 'fridge',
  'no-recipes': 'recipe',
  'shopping-ready': 'shopping',
  'delicious-meal': 'cooking',
  error: 'thinking',
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'empty-fridge',
  title,
  description,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
}) => {
  const pose = POSE_BY_TYPE[type] ?? 'fridge';
  const imgSrc = TAKOSAN_BRAND.mascot[pose];

  return (
    <div className="bg-white rounded-2xl p-6 text-center border border-takosan-cream-line shadow-xs my-4 animate-fade-in">
      <div className="w-32 h-32 mx-auto mb-3 overflow-hidden flex items-center justify-center">
        <img src={imgSrc} alt="" aria-hidden="true" width={128} height={128} className="w-full h-full object-contain" data-mascot-pose={pose} />
      </div>

      <h3 className="font-heading font-bold text-base text-takosan-navy">
        {title}
      </h3>

      <p className="text-xs text-semantic-text-muted mt-1 max-w-xs mx-auto leading-relaxed">
        {description}
      </p>

      {(actionText || secondaryActionText) && (
        <div className="mt-5 flex gap-2.5 justify-center max-w-xs mx-auto">
          {actionText && onAction && (
            <Button
              size="md"
              onClick={onAction}
              className="flex-1 font-heading font-bold text-xs py-2.5 rounded-xl shadow-xs"
            >
              {actionText}
            </Button>
          )}

          {secondaryActionText && onSecondaryAction && (
            <Button
              size="md"
              variant="outline"
              onClick={onSecondaryAction}
              className="flex-1 border-semantic-border text-semantic-text-secondary font-heading font-semibold text-xs py-2.5 rounded-xl hover:bg-semantic-background-subtle"
            >
              {secondaryActionText}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
