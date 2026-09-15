// Pure output-path policy for the recipe seed renderer. No filesystem writes here.
//
// The renderer may write ONLY beneath `<repoRoot>/.artifacts/recipe-seed/`. Everything
// else (tracked source, migrations, docs, config, sibling-prefix directories such as
// `.artifacts/recipe-seed-evil/`, `..` traversal, absolute paths elsewhere) fails closed.
import { realpathSync } from 'node:fs';
import path from 'node:path';

export const RECIPE_SEED_OUTPUT_ROOT = path.join('.artifacts', 'recipe-seed');

export class SeedOutputPolicyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SeedOutputPolicyError';
  }
}

/** True when `candidate` is `root` itself or strictly inside it (segment-aware, not prefix-based). */
export function isContainedIn(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/** Deepest existing ancestor of `target`, resolved through symlinks. */
function realExistingAncestor(target, realpath) {
  let current = target;
  for (;;) {
    try {
      return realpath(current);
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return current;
      current = parent;
    }
  }
}

/**
 * Resolves a requested output path and proves it stays inside the allowed root, both
 * lexically and after following any already-existing symlinked ancestors.
 * Returns the absolute path to write, or throws `SeedOutputPolicyError`.
 */
export function resolveSeedOutputPath(repoRoot, requested, realpath = realpathSync) {
  if (typeof requested !== 'string' || requested.trim() === '') {
    throw new SeedOutputPolicyError('an output path is required');
  }
  const root = path.resolve(repoRoot);
  const allowedRoot = path.join(root, RECIPE_SEED_OUTPUT_ROOT);
  const target = path.resolve(root, requested);

  if (target === allowedRoot || !isContainedIn(allowedRoot, target)) {
    throw new SeedOutputPolicyError(
      `refusing to write ${requested}: recipe seed output must be a file beneath ${RECIPE_SEED_OUTPUT_ROOT}/`,
    );
  }

  // Symlink escape: `.artifacts` must be a real directory of this repository and every
  // already-existing ancestor of the target (including the allowed root itself) must
  // resolve inside it. A fresh checkout without `.artifacts` is fine: nothing exists to escape through.
  const realRepo = realExistingAncestor(root, realpath);
  const realArtifacts = path.join(realRepo, '.artifacts');
  for (const anchor of [realExistingAncestor(allowedRoot, realpath), realExistingAncestor(target, realpath)]) {
    if (anchor !== realRepo && !isContainedIn(realArtifacts, anchor)) {
      throw new SeedOutputPolicyError(
        `refusing to write ${requested}: resolved location escapes ${RECIPE_SEED_OUTPUT_ROOT}/`,
      );
    }
  }
  return target;
}
