/**
 * TPI's Storyteller night text has two kinds of markup (botc-release `roles.json`):
 * - `:reminder:` marks where a reminder token is handled. Which token, and whether it goes
 *   on or comes off, is never said: `REMINDER_PLACEHOLDERS` says so for every occurrence.
 *   An occurrence with no mapping stays a generic reminder listing the options (a test
 *   fails for any unmapped one in TPI's data);
 * - `*WORD*` names a token: one of the character's reminder tokens ("*CURSED*"), an info
 *   token shown to a player ("*YOU ARE*"), the death marker ("*DEAD*"), or a character.
 *
 * Character names in the plain text are always found too (`characterNames`), so the UI
 * draws every one as a badge.
 *
 * `nightTextFor` picks the text to show for a night: TPI's, or our own fuller text from
 * `NIGHT_TEXT_OVERRIDES` when the "Full night instructions" help is on.
 */
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import { NO_CHARACTER_NAMES, type CharacterNames } from './character-names.ts';
import { NIGHT_TEXT_OVERRIDES, type NightTextOverride } from './night-text-overrides.data.ts';
import {
	REMINDER_PLACEHOLDERS,
	type PlaceholderAction,
	type PlaceholderKey,
	type ReminderPlaceholder
} from './reminder-placeholders.data.ts';

export { NIGHT_TEXT_OVERRIDES, REMINDER_PLACEHOLDERS };
export type { NightTextOverride, PlaceholderAction, PlaceholderKey, ReminderPlaceholder };

type NightName = 'first' | 'other';

export type NightTextSegment =
	| { kind: 'text'; text: string }
	| { kind: 'character'; id: CharacterId }
	/**
	 * One of the character's reminder tokens; `label` absent when it is not known which.
	 * `action` is set when a mapped `:reminder:` says whether it goes on or comes off.
	 * `prep` marks a token placed during pre-game prep (`prepTokens`).
	 */
	| {
			kind: 'reminder';
			label?: string;
			options: readonly string[];
			action?: PlaceholderAction;
			prep?: boolean;
	  }
	/** An info token shown to a player ("You are"). */
	| { kind: 'info'; label: string }
	/** The death marker (`*DEAD*`, or a mapped Dead token). */
	| { kind: 'dead'; action?: PlaceholderAction };

export interface NightTextOptions {
	/** What each `:reminder:` means, in text order (`placeholdersFor`). */
	placeholders?: readonly ReminderPlaceholder[];
	/** Character names to draw as badges (`characterNames`). */
	names?: CharacterNames;
	/** Reminder tokens the pre-game prep places (first night only); marked `prep`. */
	prepTokens?: readonly string[];
}

const MARKUP = /:reminder:|\*([^*]+)\*/g;

/** "THIS CHARACTER SELECTED YOU" -> "This character selected you". */
function sentenceCase(text: string): string {
	const lower = text.trim().toLowerCase();
	return lower.charAt(0).toUpperCase() + lower.slice(1);
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const isDead = (label: string) => same(label, 'dead');

export const placeholderKey = (id: CharacterId, night: NightName): PlaceholderKey =>
	`${id}:${night}`;

/** The mapping for each `:reminder:` in TPI's text for this night, in text order. */
export function placeholdersFor(
	id: CharacterId,
	night: NightName
): readonly ReminderPlaceholder[] | undefined {
	return REMINDER_PLACEHOLDERS[placeholderKey(id, night)];
}

/** Our fuller text for this night, if we have one. */
export function nightTextOverride(id: CharacterId, night: NightName): NightTextOverride | undefined {
	return NIGHT_TEXT_OVERRIDES[placeholderKey(id, night)];
}

export interface ResolvedNightText {
	/** The text to show. */
	text: string;
	/** TPI's text for this night (`undefined` for a homebrew step with no text). */
	source?: string;
	/** Set when we have our own text for this night, whether or not it is shown. */
	ours?: NightTextOverride;
	/** True when `text` is ours. */
	showingOurs: boolean;
	/** `:reminder:` mappings for `text` (only for TPI's text). */
	placeholders?: readonly ReminderPlaceholder[];
}

/**
 * The night text to show: TPI's, or ours when `full` and we have one. `text` is the text
 * the step carries; when it is not TPI's (a Storyteller's edit), it is shown as it is.
 * Homebrew characters share no rules with an official id, so they always keep their own.
 */
export function nightTextFor(
	character: Pick<Character, 'id' | 'edition' | 'firstNightReminder' | 'otherNightReminder'>,
	night: NightName,
	options: { full: boolean; text?: string }
): ResolvedNightText | undefined {
	const source = night === 'first' ? character.firstNightReminder : character.otherNightReminder;
	const text = options.text ?? source;
	if (text === undefined) return undefined;
	const official = character.edition !== undefined;
	const isSource = text === source;
	const ours = official && isSource ? nightTextOverride(character.id, night) : undefined;
	if (ours && options.full) return { text: ours.text, source, ours, showingOurs: true };
	const placeholders = official && isSource ? placeholdersFor(character.id, night) : undefined;
	return {
		text,
		...(source !== undefined ? { source } : {}),
		...(ours ? { ours } : {}),
		showingOurs: false,
		...(placeholders ? { placeholders } : {})
	};
}

export function nightTextSegments(
	text: string,
	character: Pick<Character, 'reminders' | 'remindersGlobal'>,
	options: NightTextOptions = {}
): NightTextSegment[] {
	const tokens = [...character.reminders, ...character.remindersGlobal];
	const distinct = [...new Set(tokens)];
	const names = options.names ?? NO_CHARACTER_NAMES;
	const prep = new Set((options.prepTokens ?? []).map((t) => t.toLowerCase()));
	const reminder = (label: string, action?: PlaceholderAction): NightTextSegment => {
		if (isDead(label)) return { kind: 'dead', ...(action ? { action } : {}) };
		return {
			kind: 'reminder',
			label,
			options: distinct,
			...(action ? { action } : {}),
			...(prep.has(label.toLowerCase()) ? { prep: true } : {})
		};
	};

	const out: NightTextSegment[] = [];
	const pushText = (value: string) => {
		for (const piece of names.split(value)) {
			if (piece.kind === 'character') {
				out.push(piece);
				continue;
			}
			const last = out[out.length - 1];
			if (last?.kind === 'text') last.text += piece.text;
			else out.push({ kind: 'text', text: piece.text });
		}
	};
	let at = 0;
	let index = 0;
	for (const match of text.matchAll(MARKUP)) {
		pushText(text.slice(at, match.index));
		at = match.index + match[0].length;
		if (match[1] === undefined) {
			const mapped = options.placeholders?.[index++];
			if (!mapped) {
				out.push({ kind: 'reminder', options: distinct });
				continue;
			}
			mapped.tokens.forEach((t, i) => {
				if (i > 0) out.push({ kind: 'text', text: mapped.either ? ' or ' : ' ' });
				out.push(reminder(t.label, t.action));
			});
			continue;
		}
		const word = match[1];
		const own = tokens.find((t) => same(t, word));
		const named = names.byName(word);
		if (own !== undefined) out.push(reminder(own));
		else if (isDead(word)) out.push({ kind: 'dead' });
		else if (named !== undefined) out.push({ kind: 'character', id: named });
		else out.push({ kind: 'info', label: sentenceCase(word) });
	}
	pushText(text.slice(at));
	// Trim the spaces left around a placeholder at either end.
	const first = out[0];
	if (first?.kind === 'text') first.text = first.text.trimStart();
	const last = out[out.length - 1];
	if (last?.kind === 'text') last.text = last.text.trimEnd();
	return out.filter((s) => s.kind !== 'text' || s.text !== '');
}

/**
 * Plain text for tests and search: tokens as [Cursed] (+ placed, - removed), the death
 * marker as [Dead], info tokens as «You are», characters as {King}.
 */
export function nightTextPlain(
	segments: readonly NightTextSegment[],
	name: (id: CharacterId) => string = (id) => id
): string {
	const sign = (action?: PlaceholderAction) =>
		action === 'place' ? '+' : action === 'remove' ? '-' : '';
	return segments
		.map((s) => {
			switch (s.kind) {
				case 'text':
					return s.text;
				case 'character':
					return `{${name(s.id)}}`;
				case 'info':
					return `«${s.label}»`;
				case 'dead':
					return `[${sign(s.action)}Dead]`;
				case 'reminder':
					return `[${sign(s.action)}${s.label ?? `reminder: ${s.options.join(' / ')}`}]`;
			}
		})
		.join('');
}
