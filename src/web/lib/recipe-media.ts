/**
 * T14C — single frontend resolution point for recipe display media (ADR-025).
 *
 *   canonical hero (same-origin versioned URL from the API `media` presentation)
 *     → legacy `recipe.imageUrl` compatibility
 *       → static placeholder
 *
 * Public recipe media is a different trust domain from private scan images (`private-image.ts`);
 * nothing here attaches credentials. Media never changes which recipe is shown, only its picture.
 */
import type { Recipe, RecipeMediaPresentationSet } from '@frigo/recipes';

export const RECIPE_IMAGE_PLACEHOLDER = '/frigo/recipes/vietnam/thit-kho-trung.webp';

export type RecipeWithOptionalMedia = Pick<Recipe, 'imageUrl'> & { media?: RecipeMediaPresentationSet | null };

export interface ResolvedRecipeImage {
  src: string;
  fallbackSrc: string;
  source: 'canonical_r2' | 'legacy_static' | 'legacy_external' | 'placeholder';
  width: number | null;
  height: number | null;
  aspectRatio: string | undefined;
}

function isRenderableLegacyUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && (trimmed.startsWith('/') && !trimmed.startsWith('//') || /^https:\/\//i.test(trimmed));
}

export function resolveRecipeImage(recipe: RecipeWithOptionalMedia | null | undefined, placeholder = RECIPE_IMAGE_PLACEHOLDER): ResolvedRecipeImage {
  const hero = recipe?.media?.hero;
  if (hero && hero.source === 'canonical_r2' && typeof hero.url === 'string' && hero.url.startsWith('/api/v1/recipe-media/')) {
    const width = hero.width ?? null;
    const height = hero.height ?? null;
    return {
      src: hero.url,
      fallbackSrc: isRenderableLegacyUrl(recipe?.imageUrl) ? recipe!.imageUrl.trim() : placeholder,
      source: 'canonical_r2',
      width,
      height,
      aspectRatio: width && height ? `${width} / ${height}` : undefined,
    };
  }
  if (isRenderableLegacyUrl(recipe?.imageUrl)) {
    const url = recipe!.imageUrl.trim();
    return { src: url, fallbackSrc: placeholder, source: url.startsWith('/') ? 'legacy_static' : 'legacy_external', width: null, height: null, aspectRatio: undefined };
  }
  return { src: placeholder, fallbackSrc: placeholder, source: 'placeholder', width: null, height: null, aspectRatio: undefined };
}

/** `onError` handler that steps to the fallback exactly once (no infinite reload loops). */
export function recipeImageErrorHandler(fallbackSrc: string) {
  return (event: { currentTarget: HTMLImageElement }) => {
    const image = event.currentTarget;
    if (image.dataset.recipeMediaFallbackApplied === '1') return;
    image.dataset.recipeMediaFallbackApplied = '1';
    if (image.getAttribute('src') !== fallbackSrc) image.src = fallbackSrc;
  };
}
