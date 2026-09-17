// Pure output-path policy for the recipe import compiler. No filesystem writes here.
//
// The compiler may write ONLY beneath `<repoRoot>/.artifacts/recipe-import/`. Tracked source,
// `migrations/`, `packages/recipes/src`, docs, config, sibling-prefix directories
// (`.artifacts/recipe-import-evil/`), `..` traversal, absolute paths elsewhere and symlink
// escapes all fail closed. Same shape as recipe-seed-output-policy.mjs, different root.
import { lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';

export const RECIPE_IMPORT_OUTPUT_ROOT = path.join('.artifacts', 'recipe-import');

export class ImportOutputPolicyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImportOutputPolicyError';
  }
}

export function isContainedIn(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

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
 * Resolves a requested artifact DIRECTORY and proves it stays strictly inside the allowed root,
 * lexically and after following any already-existing symlinked ancestors. Returns the absolute
 * directory to write into, or throws `ImportOutputPolicyError`.
 */
export function resolveImportOutputDir(repoRoot, requested, realpath = realpathSync) {
  if (typeof requested !== 'string' || requested.trim() === '') {
    throw new ImportOutputPolicyError('an artifact output directory is required');
  }
  const root = path.resolve(repoRoot);
  const allowedRoot = path.join(root, RECIPE_IMPORT_OUTPUT_ROOT);
  const target = path.resolve(root, requested);
  if (target === allowedRoot || !isContainedIn(allowedRoot, target)) {
    throw new ImportOutputPolicyError(
      `refusing to write ${requested}: recipe import artifacts must live in a directory beneath ${RECIPE_IMPORT_OUTPUT_ROOT}/`,
    );
  }
  const realRepo = realExistingAncestor(root, realpath);
  const realArtifacts = path.join(realRepo, '.artifacts');
  for (const anchor of [realExistingAncestor(allowedRoot, realpath), realExistingAncestor(target, realpath)]) {
    if (anchor !== realRepo && !isContainedIn(realArtifacts, anchor)) {
      throw new ImportOutputPolicyError(`refusing to write ${requested}: resolved location escapes ${RECIPE_IMPORT_OUTPUT_ROOT}/`);
    }
  }
  return target;
}

/** A file inside an already-resolved artifact dir must not be a symlink (planted redirect). */
export function assertNotSymlink(file, lstat = lstatSync) {
  let existing = null;
  try { existing = lstat(file); } catch { /* new file */ }
  if (existing?.isSymbolicLink()) throw new ImportOutputPolicyError(`refusing to write through symlink ${file}`);
}
