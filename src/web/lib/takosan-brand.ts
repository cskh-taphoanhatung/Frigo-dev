/**
 * Takosan brand contract — the single place React code reads brand identity from.
 * Assets are the supplied kit SVG/PNG files installed under /public/takosan;
 * FRIGO_ASSETS keeps owning content paths (ingredients, recipes, legacy art).
 */
const BASE = '/takosan';

export const TAKOSAN_BRAND = {
  name: 'Takosan',
  tagline: 'Mở tủ lạnh. Biết ngay hôm nay ăn gì.',
  motto: 'Ăn đủ. Mua đủ. Dùng hết.',
  base: BASE,
  logos: {
    horizontal: `${BASE}/brand/takosan-logo-horizontal-primary.svg`,
    horizontalWhite: `${BASE}/brand/takosan-logo-horizontal-white.svg`,
    stacked: `${BASE}/brand/takosan-logo-primary.svg`,
    stackedWhite: `${BASE}/brand/takosan-logo-white.svg`,
  },
  wordmark: `${BASE}/brand/takosan-wordmark.svg`,
  symbol: `${BASE}/brand/takosan-symbol.svg`,
  /** Simplified geometry for < 32px renders. */
  symbolMicro: `${BASE}/brand/takosan-symbol-micro.svg`,
  og: `${BASE}/brand/takosan-og.png`,
  mascot: {
    neutral: `${BASE}/mascot/takosan-neutral.svg`,
    wave: `${BASE}/mascot/takosan-wave.svg`,
    thinking: `${BASE}/mascot/takosan-thinking.svg`,
    celebrate: `${BASE}/mascot/takosan-celebrate.svg`,
    fridge: `${BASE}/mascot/takosan-fridge.svg`,
    recipe: `${BASE}/mascot/takosan-recipe.svg`,
    cooking: `${BASE}/mascot/takosan-cooking.svg`,
    calendar: `${BASE}/mascot/takosan-calendar.svg`,
    shopping: `${BASE}/mascot/takosan-shopping.svg`,
  },
  appIcons: {
    favicon: `${BASE}/app-icons/favicon.svg`,
    icon180: `${BASE}/app-icons/icon-180.png`,
    icon192: `${BASE}/app-icons/icon-192.png`,
    icon512: `${BASE}/app-icons/icon-512.png`,
    maskable512: `${BASE}/app-icons/icon-maskable-512.png`,
  },
  uiIcons: {
    home: `${BASE}/ui-icons/takosan-icon-home.svg`,
    fridge: `${BASE}/ui-icons/takosan-icon-fridge.svg`,
    scan: `${BASE}/ui-icons/takosan-icon-scan.svg`,
    recipe: `${BASE}/ui-icons/takosan-icon-recipe.svg`,
    mealPlan: `${BASE}/ui-icons/takosan-icon-meal-plan.svg`,
    calendar: `${BASE}/ui-icons/takosan-icon-calendar.svg`,
    shopping: `${BASE}/ui-icons/takosan-icon-shopping-list.svg`,
    profile: `${BASE}/ui-icons/takosan-icon-profile.svg`,
  },
  colors: {
    coral: '#FF7B6B',
    green: '#2E7D5B',
    navy: '#1F2937',
    cream: '#FFF8F3',
    mint: '#DFF4E6',
    yellow: '#FFC857',
  },
} as const;

export type TakosanMascotPose = keyof typeof TAKOSAN_BRAND.mascot;
