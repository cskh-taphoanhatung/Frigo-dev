// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import { RECIPE_IMAGE_PLACEHOLDER, recipeImageErrorHandler, resolveRecipeImage } from '../../src/web/lib/recipe-media';
import { RECIPE_IMAGE_PROMPTS } from '../../scripts/generate-recipe-images';

const hero = (overrides: Record<string, unknown> = {}) => ({ hero: { url: '/api/v1/recipe-media/gl-01/hero/2', source: 'canonical_r2', version: 2, width: 1200, height: 800, ...overrides } }) as never;

describe('T14C — frontend recipe image resolution (single fallback point)', () => {
  it('canonical hero → src is the same-origin versioned URL, legacy imageUrl becomes the onError fallback, aspect ratio exposed', () => {
    const resolved = resolveRecipeImage({ imageUrl: '/frigo/recipes/global/pasta-pomodoro.webp', media: hero() });
    expect(resolved).toEqual({ src: '/api/v1/recipe-media/gl-01/hero/2', fallbackSrc: '/frigo/recipes/global/pasta-pomodoro.webp', source: 'canonical_r2', width: 1200, height: 800, aspectRatio: '1200 / 800' });
  });

  it('non-canonical media presentations fall through to legacy imageUrl, then placeholder', () => {
    for (const source of ['legacy_static', 'legacy_external', 'missing']) {
      expect(resolveRecipeImage({ imageUrl: '/x.webp', media: hero({ source, url: '/api/v1/recipe-media/gl-01/hero/2' }) }).source).toBe('legacy_static');
    }
    expect(resolveRecipeImage({ imageUrl: 'https://images.unsplash.com/photo-1?auto=format' })).toMatchObject({ source: 'legacy_external', fallbackSrc: RECIPE_IMAGE_PLACEHOLDER });
    expect(resolveRecipeImage({ imageUrl: '' })).toEqual({ src: RECIPE_IMAGE_PLACEHOLDER, fallbackSrc: RECIPE_IMAGE_PLACEHOLDER, source: 'placeholder', width: null, height: null, aspectRatio: undefined });
    expect(resolveRecipeImage(null)).toMatchObject({ source: 'placeholder' });
    expect(resolveRecipeImage({ imageUrl: '' }, '/brand.png').src).toBe('/brand.png');
  });

  it('never trusts a canonical URL that is not under the same-origin media route (no external proxying via media)', () => {
    for (const url of ['https://evil.example/x.webp', '//evil.example/x.webp', 'javascript:alert(1)', '/api/v1/other/x', 'data:image/png;base64,AA']) {
      expect(resolveRecipeImage({ imageUrl: '/legit.webp', media: hero({ url }) }).src, url).toBe('/legit.webp');
    }
  });

  it('every canonical recipe resolves to a renderable src today (legacy compatibility preserved before population)', () => {
    const resolved = ALL_RECIPES.map((recipe) => resolveRecipeImage(recipe));
    expect(resolved.every((image) => image.src.length > 0 && image.source !== 'placeholder')).toBe(true);
    expect(resolved.filter((image) => image.source === 'legacy_static')).toHaveLength(12);
    expect(resolved.filter((image) => image.source === 'legacy_external')).toHaveLength(59);
  });

  it('onError handler steps to the fallback exactly once and never loops', () => {
    const image = document.createElement('img');
    image.src = 'https://broken.example/x.webp';
    const handler = recipeImageErrorHandler('/fallback.webp');
    handler({ currentTarget: image });
    expect(image.getAttribute('src')).toBe('/fallback.webp');
    image.src = 'https://broken-again.example/y.webp';
    handler({ currentTarget: image });
    expect(image.getAttribute('src')).toBe('https://broken-again.example/y.webp');
  });

  it('all recipe image surfaces use the central resolver instead of raw imageUrl', () => {
    const surfaces = [
      'src/web/components/common/RecipeCard.tsx', 'src/web/pages/MealDetailPage.tsx', 'src/web/pages/IngredientDetailPage.tsx', 'src/web/pages/HomePage.tsx',
      'src/web/pages/RecipeDetailPage.tsx', 'src/web/features/week/MealSwapSheet.tsx', 'src/web/features/week/MealCard.tsx',
    ];
    for (const file of surfaces) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain('resolveRecipeImage(');
      expect(source, file).not.toMatch(/src=\{[^}]*\.imageUrl\}/);
    }
  });
});

describe('T14C — image prompt manifest integrity (no provider calls)', () => {
  it('prompt IDs/slugs map 1:1 onto canonical recipes, no duplicates, no output conflicts; coverage reported truthfully', () => {
    const byId = new Map(ALL_RECIPES.map((recipe) => [recipe.id, recipe]));
    expect(new Set(RECIPE_IMAGE_PROMPTS.map((prompt) => prompt.id)).size).toBe(RECIPE_IMAGE_PROMPTS.length);
    expect(new Set(RECIPE_IMAGE_PROMPTS.map((prompt) => prompt.targetFilename)).size).toBe(RECIPE_IMAGE_PROMPTS.length);
    for (const prompt of RECIPE_IMAGE_PROMPTS) {
      const recipe = byId.get(prompt.id);
      expect(recipe, prompt.id).toBeDefined();
      expect(recipe!.slug, prompt.id).toBe(prompt.slug);
      expect(prompt.targetFilename).toBe(`${prompt.slug}.webp`);
      expect(prompt.prompt.length).toBeGreaterThan(20);
    }
    expect(RECIPE_IMAGE_PROMPTS).toHaveLength(59); // Vietnamese only: the 12 global recipes have no prompt yet (reported, not fabricated)
    expect(ALL_RECIPES.filter((recipe) => recipe.id.startsWith('gl-') && RECIPE_IMAGE_PROMPTS.some((prompt) => prompt.id === recipe.id))).toHaveLength(0);
  });

  it('the prompt module is a pure manifest: importing it performs no network or provider work', () => {
    const source = readFileSync('scripts/generate-recipe-images.ts', 'utf8');
    expect(source).not.toMatch(/fetch\(|process\.env|GoogleGenerativeAI|openai|writeFileSync/);
  });
});
