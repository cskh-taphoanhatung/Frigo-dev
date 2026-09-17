import { afterEach } from 'vitest';

// Vitest workers report progress to the main process over birpc with a fixed
// 60 s timeout, and the reply is delivered as an IPC macrotask. Suites built on
// synchronous SQLite (hundreds of tests, microtasks only) can run longer than
// that without ever reaching the macrotask queue on a slow CI runner, so the
// overdue timer fires first and the run exits 1 with every test green. Yielding
// once per test keeps the worker responsive. Captured before any test can
// install fake timers.
const realSetImmediate = globalThis.setImmediate;

afterEach(() => new Promise<void>((resolve) => realSetImmediate(resolve)));
