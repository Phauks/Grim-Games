/**
 * TPI's Storyteller night text has two kinds of markup (botc-release `roles.json`):
 * - `:reminder:` marks where a reminder token is handled. Which token, and whether it goes
 *   on or comes off, is never said: each character's `reminderPlaceholders` rule says so for
 *   every occurrence.
 *   An occurrence with no mapping stays a generic reminder listing the options (a test
 *   fails for any unmapped one in TPI's data);
 * - `*WORD*` names a token: one of the character's reminder tokens ("*CURSED*"), an info
 *   token shown to a player ("*YOU ARE*"), the death marker ("*DEAD*"), or a character.
 *
 * Character names in the plain text are always found too (`characterNames`), so the UI
 * draws every one as a badge.
 *
 * `nightTextFor` picks the text to show for a night: Trevor's reviewed edit of TPI's text
 * (the rules block's `nightText.<night>.reviewed`) when there is one, otherwise TPI's. Our
 * fuller text (`nightText.<night>.full`) is parked behind `FULL_NIGHT_INSTRUCTIONS`, which is
 * off. A homebrew character's text is its author's own, so it takes no override.
 */
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import { NO_CHARACTER_NAMES, type CharacterNames } from './character-names.ts';
import type { NightTextOverride } from '#lib/core/data/night-text-rules.ts';
import type {
	PlaceholderAction,
	ReminderPlaceholder,
	ReminderPlaceholderRules
} from '#lib/core/data/reminder-placeholder-rules.ts';
import { OFFICIAL_RULES, rulesOfCharacter } from '#lib/core/data/rules/index.ts';

/** A character's night: `<characterId>:<first|other>`. */
export type PlaceholderKey = `${CharacterId}:${'first' | 'other'}`;

/**
 * Parked (Trevor, 2026-10-15: "lets step back from adding our own information"): when
 * true, our fuller text (`nightText.<night>.full`) replaces TPI's text. A code-level flag, so Settings gains no
 * switch for hidden content.
 */
export const FULL_NIGHT_INSTRUCTIONS = false;

/**
 * Parked with it: the UI's "Differs from source" marker for text of ours. The data
 * (`nightTextFor().ours`, `ReferenceEntry.differences`) is kept; nothing renders it.
 */
export const SHOW_DIFFERS_FROM_SOURCE = false;
export type { NightTextOverride, PlaceholderAction, ReminderPlaceholder };

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
/** For a step with no character: no tokens of its own. */
const NO_TOKENS = { reminders: [], remindersGlobal: [] };

const placeholderKey = (id: CharacterId, night: NightName): PlaceholderKey => `${id}:${night}`;

/**
 * A character's `reminderPlaceholders` rule: a homebrew character's own only (its text is its
 * own), else our overlay file's for TPI's text.
 */
export function placeholderRulesOf(
	character: Pick<Character, 'id' | 'edition' | 'rules'>
): ReminderPlaceholderRules | undefined {
	return rulesOfCharacter(character)?.reminderPlaceholders;
}

/** The mapping for each `:reminder:` in the character's own text for this night, in text order. */
export function placeholdersFor(
	character: Pick<Character, 'id' | 'edition' | 'rules'>,
	night: NightName
): readonly ReminderPlaceholder[] | undefined {
	return placeholderRulesOf(character)?.[night];
}

/** Our text in use for this night: Trevor's reviewed edit, or (flag on) our fuller text. */
export function nightTextOverride(
	id: CharacterId,
	night: NightName,
	full: boolean = FULL_NIGHT_INSTRUCTIONS
): NightTextOverride | undefined {
	const ours = OFFICIAL_RULES.get(id)?.nightText?.[night];
	return (full ? ours?.full : undefined) ?? ours?.reviewed;
}

export interface ResolvedNightText {
	/** The text to show. */
	text: string;
	/** TPI's text for this night (`undefined` for a homebrew step with no text). */
	source?: string;
	/** Set when the text shown is ours, with why it differs. */
	ours?: NightTextOverride;
	/** `:reminder:` mappings for `text`, when it has any. */
	placeholders?: readonly ReminderPlaceholder[];
}

const placeholderCount = (text: string) => text.match(/:reminder:/g)?.length ?? 0;

/**
 * The night text to show. `text` is the text the step carries; when it is not TPI's (a
 * Storyteller's edit), it is shown as it is. Otherwise our text in use replaces TPI's
 * (`nightTextOverride`). TPI's `:reminder:` mapping applies to TPI's text, and to a
 * reviewed edit that kept the same `:reminder:`s (the Preacher's). Homebrew characters
 * share no rules with an official id, so they always keep their own text, mapped by their
 * own `reminderPlaceholders`.
 */
export function nightTextFor(
	character: Pick<
		Character,
		'id' | 'edition' | 'rules' | 'firstNightReminder' | 'otherNightReminder'
	>,
	night: NightName,
	options: { text?: string; full?: boolean } = {}
): ResolvedNightText | undefined {
	const source = night === 'first' ? character.firstNightReminder : character.otherNightReminder;
	const given = options.text ?? source;
	if (given === undefined) return undefined;
	const official = character.edition !== undefined && given === source;
	const ours = official ? nightTextOverride(character.id, night, options.full) : undefined;
	const text = ours?.text ?? given;
	// A homebrew character's own mapping fits its own text, as TPI's fits TPI's.
	const mapping = given === source ? placeholdersFor(character, night) : undefined;
	const placeholders =
		mapping && mapping.length > 0 && mapping.length === placeholderCount(text)
			? mapping
			: undefined;
	return {
		text,
		...(source !== undefined ? { source } : {}),
		...(ours ? { ours } : {}),
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
 * The segments a step's night text is drawn from: with `night`, the text for that night
 * (`nightTextFor`, so a reviewed edit replaces TPI's) and its `:reminder:` mapping; without,
 * `text` as it is.
 */
export function nightTextSegmentsFor(
	character:
		| Pick<
				Character,
				| 'id'
				| 'edition'
				| 'rules'
				| 'firstNightReminder'
				| 'otherNightReminder'
				| 'reminders'
				| 'remindersGlobal'
		  >
		| undefined,
	text: string,
	night?: NightName
): NightTextSegment[] {
	// Dusk, Minion info, Demon info, Dawn and the Storyteller's own steps have no character:
	// their text is drawn the same way, with no tokens of its own (Trevor, 2026-11-06).
	if (!character) return nightTextSegments(text, NO_TOKENS);
	const resolved = night ? nightTextFor(character, night, { text }) : undefined;
	return nightTextSegments(
		resolved?.text ?? text,
		character,
		resolved?.placeholders ? { placeholders: resolved.placeholders } : {}
	);
}

/**
 * A night step's text as numbered lines, for every kind of step alike (Trevor, 2026-11-06:
 * Minion info, Demon info, Dawn and Dusk "treated like character"): a character's TPI text,
 * or a marker's or the Storyteller's own. Undefined for a step with no text.
 */
export function stepNightText(
	step: {
		character?: Parameters<typeof nightTextSegmentsFor>[0];
		reminder?: string;
	},
	night?: NightName
): NightTextSteps | undefined {
	if (!step.reminder) return undefined;
	return nightTextSteps(nightTextSegmentsFor(step.character, step.reminder, night));
}

/** One numbered line of night text: one sentence, with the tokens that follow it. */
export type NightTextLine = readonly NightTextSegment[];

/**
 * Night text laid out as steps (Trevor, 2026-11-06, option B, "Ledger"): one line per
 * sentence, and an "If ...:" sentence opens a branch whose lines are the rest of the text, up
 * to the next "If ...:". The words are never changed, only split.
 */
export interface NightTextSteps {
	/** The lines before any branch. */
	lines: NightTextLine[];
	/** Each "If ...:" branch: its condition (without the colon) and its lines. */
	branches: { condition: NightTextLine; lines: NightTextLine[] }[];
}

const SENTENCE_END = /[.!?]["”)]?\s*$/;
const STARTS_SENTENCE = /^\s*["“(]?[A-Z0-9]/;

const lineText = (line: readonly NightTextSegment[]) =>
	line.map((s) => (s.kind === 'text' ? s.text : '')).join('');

/** Drops the spaces left at either end of a line. */
function trimLine(line: NightTextSegment[]): NightTextSegment[] {
	const out = line.map((s) => ({ ...s }));
	const first = out[0];
	if (first?.kind === 'text') first.text = first.text.trimStart();
	const last = out[out.length - 1];
	if (last?.kind === 'text') last.text = last.text.trimEnd();
	return out.filter((s) => s.kind !== 'text' || s.text !== '');
}

/**
 * An "If ...:" sentence's condition and the rest of it, or nothing when the sentence is not
 * one. The condition may hold a character ("If the Imp chose themselves:").
 */
function conditionSplit(
	sentence: NightTextSegment[]
): NightTextSteps['branches'][number] | undefined {
	const head = sentence[0];
	if (head?.kind !== 'text' || !/^If\b/.test(head.text)) return undefined;
	for (let i = 0; i < sentence.length; i++) {
		const s = sentence[i];
		if (s.kind !== 'text') continue;
		const at = /:\s+(?=["\u201c(]?[A-Z])/.exec(s.text);
		if (!at) continue;
		if (/[.!?]/.test(lineText(sentence.slice(0, i)) + s.text.slice(0, at.index))) return undefined;
		const condition = trimLine([
			...sentence.slice(0, i),
			{ kind: 'text', text: s.text.slice(0, at.index) }
		]);
		const rest = trimLine([
			{ kind: 'text', text: s.text.slice(at.index + at[0].length) },
			...sentence.slice(i + 1)
		]);
		return { condition, lines: rest.length > 0 ? [rest] : [] };
	}
	return undefined;
}

/**
 * Splits night text segments into lines and branches (`NightTextSteps`). A line ends at a
 * sentence's full stop; a token, the death marker or a character drawn right after one
 * (TPI's `:reminder:` sits after its sentence) stays on that line. A character starting the
 * next sentence starts the next line.
 */
export function nightTextSteps(segments: readonly NightTextSegment[]): NightTextSteps {
	const sentences: NightTextSegment[][] = [[]];
	const current = () => sentences[sentences.length - 1];
	const ended = () => SENTENCE_END.test(lineText(current()));
	for (const s of segments) {
		if (s.kind !== 'text') {
			if (s.kind === 'character' && ended() && lineText(current()).trim() !== '')
				sentences.push([]);
			current().push(s);
			continue;
		}
		const pieces = s.text.split(/(?<=[.!?]["”)]?)\s+(?=["“(]?[A-Z0-9])/);
		pieces.forEach((piece, i) => {
			const breaks = i > 0 || (ended() && STARTS_SENTENCE.test(piece) && current().length > 0);
			if (breaks) sentences.push([]);
			current().push({ kind: 'text', text: (breaks ? ' ' : '') + piece });
		});
	}
	const result: NightTextSteps = { lines: [], branches: [] };
	for (const raw of sentences) {
		const sentence = trimLine(raw);
		if (sentence.length === 0) continue;
		const split = conditionSplit(sentence);
		if (split) {
			result.branches.push(split);
			continue;
		}
		const branch = result.branches[result.branches.length - 1];
		(branch ? branch.lines : result.lines).push(sentence);
	}
	return result;
}

/** Every line of `steps` in reading order: the lines before any branch, then each branch's. */
export function nightTextStepLines(steps: NightTextSteps): NightTextLine[] {
	return [...steps.lines, ...steps.branches.flatMap((b) => b.lines)];
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

/**
 * Problems with the `:reminder:` mapping against TPI's data: a night text whose
 * `:reminder:`s are not all mapped, a mapping for text that has a different number (or
 * none), and a token that is not one of the character's own. Empty when all is well; the
 * rules coverage check (`npm run check:rules-coverage`) fails otherwise.
 */
export function placeholderProblems(
	characters: readonly Pick<
		Character,
		'id' | 'reminders' | 'remindersGlobal' | 'firstNightReminder' | 'otherNightReminder'
	>[]
): string[] {
	const problems: string[] = [];
	const seen = new Set<string>();
	for (const c of characters) {
		const own = new Set([...c.reminders, ...c.remindersGlobal]);
		for (const night of ['first', 'other'] as const) {
			const text = night === 'first' ? c.firstNightReminder : c.otherNightReminder;
			const count = text?.match(/:reminder:/g)?.length ?? 0;
			const key = placeholderKey(c.id, night);
			const mapped = OFFICIAL_RULES.get(c.id)?.reminderPlaceholders?.[night];
			if (mapped) seen.add(key);
			if ((mapped?.length ?? 0) !== count)
				problems.push(
					`${key}: ${count} :reminder: in TPI's text, ${mapped?.length ?? 0} in its rules file`
				);
			for (const p of mapped ?? [])
				for (const t of p.tokens)
					if (!own.has(t.label)) problems.push(`${key}: "${t.label}" is not one of its tokens`);
		}
	}
	for (const [id, rules] of OFFICIAL_RULES)
		for (const night of ['first', 'other'] as const) {
			const key = placeholderKey(id, night);
			if (rules.reminderPlaceholders?.[night] && !seen.has(key))
				problems.push(`${key}: mapped, but no such character in TPI's data`);
		}
	return problems;
}
