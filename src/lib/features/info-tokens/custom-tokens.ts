import type { CharacterId } from '#lib/core/data/index.ts';
import {
	MAX_ASKED_CHARACTERS,
	type InfoToken,
	type InfoTokenAsks,
	type InfoTokenValue
} from '#lib/core/data/info-tokens.ts';
import { boldToRed } from './bold.ts';

/**
 * A Storyteller's own card. Beyond the text:
 * - `characterIds`: it belongs to these characters, so it sits under Character-Specific and
 *   a game offers it only while one of them is in play (Trevor, 2026-10-16);
 * - `asks`: what it asks for when shown, each part set on its own (Trevor, 2026-10-18), such
 *   as the Mezepheles's secret word (text) or a madness card's characters.
 */
export interface CustomInfoToken extends InfoToken {
	source: 'custom';
	characterIds?: CharacterId[];
}

/**
 * The Storyteller's own info tokens, kept on this device. Versioned, because a newer
 * build can open what an older one saved (CLAUDE.md); bump `version` with a migration.
 */
export interface StoredInfoTokens {
	/**
	 * 2: `**bold**` means heavier type and colour has its own `[red]` tags (2026-10-16).
	 * 3: `asks` replaces `shows: 'characters'` (3 characters) and `blank` (text) (2026-10-18);
	 *    `asks.exactly`, `asks.notInPlay` and `answerOnly` were added later as optional fields.
	 */
	version: 3;
	custom: CustomInfoToken[];
}

export const MAX_CUSTOM_TEXT = 200;
/** Answers a card with set choices can have, and how long each may be. */
export const MAX_CHOICES = 8;
export const MAX_CHOICE_TEXT = 40;

export function emptyStore(): StoredInfoTokens {
	return { version: 3, custom: [] };
}

const isInteger = (value: unknown): value is number => Number.isSafeInteger(value);

/** The answers a choices card offers: trimmed, non-empty, unique, at most MAX_CHOICES. */
export function cleanChoices(options: readonly unknown[]): string[] {
	const clean = options
		.filter((option): option is string => typeof option === 'string')
		.map((option) => option.trim().slice(0, MAX_CHOICE_TEXT))
		.filter((option) => option !== '');
	return [...new Set(clean)].slice(0, MAX_CHOICES);
}

function parseValue(raw: unknown): InfoTokenValue | undefined {
	if (typeof raw !== 'object' || raw === null) return undefined;
	const { kind, min, max, options } = raw as Record<string, unknown>;
	if (kind === 'text') return { kind };
	if (kind === 'number') {
		const low = isInteger(min) ? min : undefined;
		const high = isInteger(max) && (low === undefined || max >= low) ? max : undefined;
		return {
			kind,
			...(low !== undefined ? { min: low } : {}),
			...(high !== undefined ? { max: high } : {})
		};
	}
	if (kind === 'choices' && Array.isArray(options)) {
		const clean = cleanChoices(options);
		// One answer is no choice; it would only ever show that answer.
		return clean.length >= 2 ? { kind, options: clean } : undefined;
	}
	return undefined;
}

/** What a stored card asks for, dropping anything it can't be; undefined for nothing. */
export function parseAsks(raw: unknown): InfoTokenAsks | undefined {
	if (typeof raw !== 'object' || raw === null) return undefined;
	const { characters, value, exactly, fewest, notInPlay } = raw as Record<string, unknown>;
	const count =
		isInteger(characters) && characters > 0
			? Math.min(characters, MAX_ASKED_CHARACTERS)
			: undefined;
	const parsed = parseValue(value);
	if (count === undefined && parsed === undefined) return undefined;
	return {
		...(count !== undefined ? { characters: count } : {}),
		// Both only mean something with characters to choose.
		...(count !== undefined && exactly === true ? { exactly: true } : {}),
		// A range's lowest: only between 1 and the most, and never with "exactly".
		...(count !== undefined && exactly !== true && isInteger(fewest) && fewest > 1 && fewest < count
			? { fewest }
			: {}),
		...(count !== undefined && notInPlay === true ? { notInPlay: true } : {}),
		...(parsed !== undefined ? { value: parsed } : {})
	};
}

/** Reads what was stored, dropping anything malformed instead of failing. */
export function parseStoredInfoTokens(raw: unknown): StoredInfoTokens {
	if (typeof raw !== 'object' || raw === null) return emptyStore();
	const value = raw as { version?: unknown; custom?: unknown };
	const version = value.version;
	if ((version !== 1 && version !== 2 && version !== 3) || !Array.isArray(value.custom))
		return emptyStore();
	// Version 1 drew bold as red: keep the red, as a colour (Trevor, 2026-10-16).
	const migrate = version === 1 ? boldToRed : (text: string) => text;
	const custom: CustomInfoToken[] = [];
	for (const item of value.custom) {
		if (typeof item !== 'object' || item === null) continue;
		const { id, text, shows, characterIds, blank, asks, answerOnly } = item as Record<
			string,
			unknown
		>;
		if (typeof id !== 'string' || typeof text !== 'string' || !text.trim()) continue;
		if (custom.some((t) => t.id === id)) continue;
		// Before version 3 a card asked for up to 3 characters and a word in the blank.
		const parsed =
			version === 3
				? parseAsks(asks)
				: parseAsks({
						characters: shows === 'characters' ? 3 : undefined,
						value: blank === true ? { kind: 'text' } : undefined
					});
		custom.push({
			id,
			text: migrate(text).slice(0, MAX_CUSTOM_TEXT),
			source: 'custom',
			...(parsed ? { asks: parsed } : {}),
			// Added later in version 3 as an optional field; only with something to fill in.
			...(parsed?.value && answerOnly === true ? { answerOnly: true as const } : {}),
			// Added later in version 1 as an optional field, so older saves read as before.
			...(Array.isArray(characterIds) && characterIds.some((c) => typeof c === 'string')
				? { characterIds: [...new Set(characterIds.filter((c) => typeof c === 'string'))] }
				: {})
		});
	}
	return { version: 3, custom };
}
