import type { InfoToken } from '#lib/core/data/info-tokens.ts';

/**
 * The Storyteller's own info tokens, kept on this device. Versioned, because a newer
 * build can open what an older one saved (CLAUDE.md); bump `version` with a migration.
 */
export interface StoredInfoTokens {
	version: 1;
	custom: InfoToken[];
}

export const MAX_CUSTOM_TEXT = 200;

export function emptyStore(): StoredInfoTokens {
	return { version: 1, custom: [] };
}

/** Reads what was stored, dropping anything malformed instead of failing. */
export function parseStoredInfoTokens(raw: unknown): StoredInfoTokens {
	if (typeof raw !== 'object' || raw === null) return emptyStore();
	const value = raw as { version?: unknown; custom?: unknown };
	if (value.version !== 1 || !Array.isArray(value.custom)) return emptyStore();
	const custom: InfoToken[] = [];
	for (const item of value.custom) {
		if (typeof item !== 'object' || item === null) continue;
		const { id, text } = item as { id?: unknown; text?: unknown };
		if (typeof id !== 'string' || typeof text !== 'string' || !text.trim()) continue;
		if (custom.some((t) => t.id === id)) continue;
		custom.push({ id, text: text.slice(0, MAX_CUSTOM_TEXT), source: 'custom', shows: 'none' });
	}
	return { version: 1, custom };
}
