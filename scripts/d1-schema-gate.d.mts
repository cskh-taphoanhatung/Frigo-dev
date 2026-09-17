export const MIGRATION_NAME: RegExp;
export const REQUIRED_MIGRATIONS_MARKER: string;
export function listMigrations(directory?: string): string[];
export function migrationTip(directory?: string): string;
export function renderSchemaGateSql(options?: { template?: string; migrationsDirectory?: string }): string;
export function renderSchemaGateCommand(options?: { template?: string; migrationsDirectory?: string }): string;
