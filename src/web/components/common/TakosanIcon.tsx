import React from 'react';

/**
 * Takosan UI icon grammar (kit `ui-icons/`): 24×24 viewBox, currentColor,
 * 1.8px round stroke. Path data is copied verbatim from the supplied SVGs so
 * icons inherit text color the same way Lucide icons do.
 */
const PATHS = {
  home: 'M2 11 L12 2 L22 11 M5 9 V22 H19 V9 M10 22 V15 H14 V22',
  fridge: 'M6 3 H18 V21 H6Z M6 10 H18 M9 6 V8 M9 13 V17',
  scan: 'M3 8 V3 H8 M16 3 H21 V8 M21 16 V21 H16 M8 21 H3 V16 M2 12 H22 M8 7 H16 M8 17 H16',
  recipe: 'M3 5 Q7 2 12 5 Q17 2 21 5 V20 Q17 17 12 20 Q7 17 3 20Z M12 5 V20 M6 9 H9 M15 9 H18',
  mealPlan: 'M4 5 H20 V21 H4Z M8 3 V7 M16 3 V7 M4 10 H20 M8 16 L11 19 L17 13',
  calendar: 'M4 5 H20 V21 H4Z M8 3 V7 M16 3 V7 M4 10 H20 M8 14 H10 M14 14 H16 M8 17 H10',
  shoppingList: 'M8 4 H5 V22 H19 V4 H16 M8 2 H16 V6 H8Z M8 11 L9 12 L11 10 M14 11 H16 M8 17 L9 18 L11 16 M14 17 H16',
  shoppingCart: 'M2 3 H5 L8 16 H19 L22 7 H6 M10 21 H10.1 M18 21 H18.1',
  profile: 'M16 7 A4 4 0 1 1 8 7 A4 4 0 1 1 16 7 M4 22 V19 C4 10 20 10 20 19 V22',
  chef: 'M7 15 C1 14 2 6 7 6 C7 1 17 1 17 6 C22 6 23 14 17 15 V21 H7Z M7 17 H17',
  camera: 'M3 7 H7 L9 4 H15 L17 7 H21 V21 H3Z M16 14 A4 4 0 1 1 8 14 A4 4 0 1 1 16 14',
} as const;

export type TakosanIconName = keyof typeof PATHS;

interface TakosanIconProps extends Omit<React.SVGProps<SVGSVGElement>, 'name'> {
  name: TakosanIconName;
  strokeWidth?: number;
  /** Provide when the icon carries meaning on its own; otherwise it is decorative. */
  title?: string;
}

export const TakosanIcon: React.FC<TakosanIconProps> = ({ name, strokeWidth = 1.8, title, className, ...rest }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={24}
    height={24}
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden={title ? undefined : true}
    role={title ? 'img' : undefined}
    className={className}
    data-takosan-icon={name}
    {...rest}
  >
    {title && <title>{title}</title>}
    <path d={PATHS[name]} />
  </svg>
);
