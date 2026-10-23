/**
 * The Character reference: everything the app uses about each official character, put
 * together at runtime from TPI's data and our rules code (never a hand-kept copy), so
 * anyone can read it and spot mistakes. Also runs a few consistency checks between the
 * sources and lists what they find as `problems`.
 */
import { defaultAlignment } from '#lib/core/data/character-type.ts';
import type { GameData } from '#lib/core/data/game-data.ts';
import { jinxesFor } from '#lib/core/data/jinxes.ts';
import type { NumericNightOrder } from '#lib/core/data/night-order-numeric.ts';
import {
	type Alignment,
	type Character,
	type CharacterId,
	type CharacterType,
	type NightMarker,
	type NightSheet,
	type ReminderLabel
} from '#lib/core/data/types.ts';
import { wikiUrl } from '#lib/core/data/wiki.ts';
import {
	DAY_GROUP_TITLES,
	DAY_REMINDER_ENTRIES,
	NO_DAY_RELEVANCE,
	type DayGroup
} from './day-reminders.data.ts';
import { detectDayReminders } from './day-reminders.ts';
import { describeImpairable, describeWhen } from './describe.ts';
import { MAX_DEALT_PLAYERS } from './distribution.ts';
import { isExclusiveJinx } from './jinxes.ts';
import { nightOrder, type Night, type NightOrder } from './night-order.ts';
import { nightTextOverride, type NightTextOverride } from './night-text.ts';
import { setupModifierFor, type SetupModifier } from './setup-modifiers.ts';
import { setupPrepOf } from './setup-reminders.ts';

/**
 * A piece of a reminder sentence: a character badge, the player carrying a token, a value
 * the Storyteller enters during prep (shown as its placeholder), or text.
 */
export type ReferenceSegment =
	| { kind: 'character'; characterId: CharacterId }
	| { kind: 'target'; token: string }
	| { kind: 'value'; placeholder: string }
	| { kind: 'text'; text: string };

/**
 * Where our night text departs from TPI's: TPI's original, ours, and why (for the parked
 * "Differs from source" marker, `SHOW_DIFFERS_FROM_SOURCE`).
 */
export interface ReferenceDifference {
	part: 'firstNight' | 'otherNight';
	/** "First night", "Other nights". */
	title: string;
	source: string;
	ours: string;
	reason: string;
}

export interface ReferenceDayReminder {
	group: DayGroup;
	groupTitle: string;
	segments: ReferenceSegment[];
	/** When it shows, in plain words. */
	when: string;
	/** The automatic "is poisoned / is drunk" line of an impairable character. */
	impairment?: boolean;
	/** Found by keywords because the curated list does not cover the character. */
	autoDetected?: boolean;
}

/** One night for one character: TPI's place, the provisional number, the Storyteller text. */
export interface ReferenceNight {
	/** 1-based position on TPI's night sheet, counting Dusk as #1. */
	position?: number;
	/** Number in `night-order-provisional.json`. */
	number?: number;
	text?: string;
	/** Our text shown instead of TPI's (Trevor's reviewed edit), with why. */
	ours?: NightTextOverride;
	/** Where the two orders disagree, or one is missing. */
	issues: string[];
}

export interface ReferenceJinx {
	with: CharacterId;
	reason: string;
	/** Only one of the pair can be in play. */
	exclusive: boolean;
}

export const REFERENCE_FILTERS = [
	'day',
	'firstNight',
	'otherNight',
	'jinxes',
	'setup',
	'differs',
	'problems'
] as const;
export type ReferenceFilter = (typeof REFERENCE_FILTERS)[number];

export const REFERENCE_FILTER_LABELS: Record<ReferenceFilter, string> = {
	day: 'Day reminder',
	firstNight: 'Wakes first night',
	otherNight: 'Wakes other nights',
	jinxes: 'Has jinxes',
	setup: 'Changes setup',
	differs: 'Differs from source',
	problems: 'Possible problems'
};

/**
 * One of a character's reminder tokens, as TPI lists them (`copies` of the same label are
 * one entry), and how many the setup reminders (`setupPrep` rules, the list the board's
 * setup tray uses) place for one copy of the character: before the first night (`setup`) or
 * at the start of the first day (`firstDay`). Shown on Reference so the classification can be
 * checked (Trevor, 2026-10-17).
 */
export interface ReferenceToken {
	label: ReminderLabel;
	global: boolean;
	copies: number;
	setup: number;
	firstDay: number;
}

/** A character's setup tokens, from its own rules block or our overlay file. */
const setupSpecs = (character: Character) =>
	setupPrepOf(character.id, new Map([[character.id, character]]))?.reminders ?? [];

/** A character's reminder tokens with their setup counts, in TPI's order. */
export function referenceTokens(character: Character): ReferenceToken[] {
	const out: ReferenceToken[] = [];
	for (const [labels, global] of [
		[character.reminders, false],
		[character.remindersGlobal, true]
	] as const) {
		for (const label of labels) {
			const same = out.find((t) => t.label === label && t.global === global);
			if (same) same.copies += 1;
			else out.push({ label, global, copies: 1, setup: 0, firstDay: 0 });
		}
	}
	for (const spec of setupSpecs(character)) {
		const token = out.find((t) => t.label === spec.label);
		if (!token) continue;
		if ((spec.timing ?? 'setup') === 'setup') token.setup += 1;
		else token.firstDay += 1;
	}
	return out;
}

/** Placed at setup or at the start of the first day. */
export const atSetup = (token: ReferenceToken) => token.setup + token.firstDay > 0;

export interface ReferenceEntry {
	character: Character;
	/** From the character type; Travellers get theirs when assigned. */
	alignment?: Alignment;
	alignmentNote: string;
	setup?: SetupModifier;
	/** TPI's reminder tokens, one per label, with how many of them setup places. */
	tokens: ReferenceToken[];
	jinxes: ReferenceJinx[];
	firstNight: ReferenceNight;
	otherNight: ReferenceNight;
	dayReminders: ReferenceDayReminder[];
	/** Where our night text departs from TPI's. */
	differences: ReferenceDifference[];
	/** Why the character has no pre-day reminders (`NO_DAY_RELEVANCE`). */
	noDayReason?: string;
	wiki?: string;
	/** Consistency checks that failed: things to look at. */
	problems: string[];
	filters: ReadonlySet<ReferenceFilter>;
}

/** Starting alignment in plain words, from the type (`defaultAlignment`). */
export function alignmentNote(type: CharacterType): string {
	const alignment = defaultAlignment(type);
	if (alignment) return alignment === 'good' ? 'Good' : 'Evil';
	if (type === 'traveller') return 'Storyteller chooses';
	return 'None';
}

/**
 * Compares TPI's order with the provisional numbers for one night: each step's 1-based
 * position, its number, and any disagreement (no number, number but not on the sheet,
 * or a number out of order with its neighbours).
 */
export function compareNightOrders(
	list: readonly string[],
	numbers: ReadonlyMap<CharacterId, number> | undefined
): Map<string, { position?: number; number?: number; issues: string[] }> {
	const out = new Map<string, { position?: number; number?: number; issues: string[] }>();
	const markers: readonly string[] = ['dusk', 'minioninfo', 'demoninfo', 'dawn'];
	list.forEach((id, i) => {
		const number = numbers?.get(id);
		const issues: string[] = [];
		if (numbers && number === undefined && !markers.includes(id))
			issues.push('On TPI’s night sheet but has no provisional number.');
		out.set(id, { position: i + 1, ...(number !== undefined ? { number } : {}), issues });
	});
	if (!numbers) return out;
	// Out of order: a numbered step whose number is not between its numbered neighbours.
	const numbered = list.filter((id) => numbers.has(id));
	numbered.forEach((id, i) => {
		const n = numbers.get(id)!;
		const prev = i > 0 ? numbers.get(numbered[i - 1])! : -Infinity;
		const next = i < numbered.length - 1 ? numbers.get(numbered[i + 1])! : Infinity;
		if (n <= prev || n >= next)
			out
				.get(id)!
				.issues.push('Provisional number puts it in a different place from TPI’s night sheet.');
	});
	for (const [id, number] of numbers) {
		if (!out.has(id))
			out.set(id, {
				number,
				issues: ['Has a provisional number but is not on TPI’s night sheet.']
			});
	}
	return out;
}

function nightFor(
	character: Character,
	night: Night,
	compared: ReturnType<typeof compareNightOrders>
): ReferenceNight {
	const text = night === 'first' ? character.firstNightReminder : character.otherNightReminder;
	const found = compared.get(character.id);
	const ours = text !== undefined ? nightTextOverride(character.id, night) : undefined;
	return {
		...(found?.position !== undefined ? { position: found.position } : {}),
		...(found?.number !== undefined ? { number: found.number } : {}),
		...(text !== undefined ? { text } : {}),
		...(ours ? { ours } : {}),
		issues: found ? [...found.issues] : []
	};
}

const samePage = (a: string | undefined, b: string | undefined) => {
	const norm = (u: string) => {
		try {
			return decodeURIComponent(u);
		} catch {
			return u;
		}
	};
	return a === undefined || b === undefined || norm(a) === norm(b);
};

const ENTRIES = new Map(DAY_REMINDER_ENTRIES.map((e) => [e.id, e]));

function dayFor(character: Character, name: (id: CharacterId) => string, problems: string[]) {
	const entry = ENTRIES.get(character.id);
	const noDayReason = NO_DAY_RELEVANCE[character.id];
	const reminders: ReferenceDayReminder[] = [];
	if (entry && noDayReason !== undefined)
		problems.push('Listed both with day reminders and as having none.');
	if (entry) {
		const tokens = new Set([...character.reminders, ...character.remindersGlobal]);
		for (const spec of entry.reminders) {
			reminders.push({
				group: spec.group,
				groupTitle: DAY_GROUP_TITLES[spec.group],
				segments: spec.template.map((part): ReferenceSegment =>
					'self' in part
						? { kind: 'character', characterId: character.id }
						: 'target' in part
							? { kind: 'target', token: spec.when?.reminder ?? '' }
							: 'value' in part
								? { kind: 'value', placeholder: part.placeholder }
								: { kind: 'text', text: part.text }
				),
				when: describeWhen(spec, character, name)
			});
			for (const token of [spec.when?.reminder, spec.when?.noReminder]) {
				if (token !== undefined && !tokens.has(token))
					problems.push(`A day reminder uses “${token}”, which is not one of its reminder tokens.`);
			}
			if (spec.template.some((p) => 'target' in p) && !spec.when?.reminder)
				problems.push('A day reminder names a player but no reminder token says which.');
		}
		if (entry.impairable) {
			const group = entry.reminders[0]?.group ?? 'day-ability';
			// The app shows "is poisoned" or "is drunk", whichever applies; one line here.
			reminders.push({
				group,
				groupTitle: DAY_GROUP_TITLES[group],
				segments: [
					{ kind: 'character', characterId: character.id },
					{ kind: 'text', text: 'is poisoned / is drunk' }
				],
				when: describeImpairable(character),
				impairment: true
			});
		}
		if (!samePage(entry.wiki, wikiUrl(character)))
			problems.push(`Day-reminder wiki link (${entry.wiki}) is not the character’s wiki page.`);
	} else if (noDayReason === undefined) {
		problems.push('Not in the curated day-reminder list: reminders are guessed from the ability.');
		for (const r of detectDayReminders(character)) {
			reminders.push({
				group: r.group,
				groupTitle: DAY_GROUP_TITLES[r.group],
				segments: r.segments.map((s): ReferenceSegment =>
					s.kind === 'character'
						? { kind: 'character', characterId: s.ref.characterId }
						: s.kind === 'value'
							? { kind: 'value', placeholder: s.placeholder }
							: { kind: 'text', text: s.text }
				),
				when: `${character.name} is alive`,
				autoDetected: true
			});
		}
	}
	return { reminders, noDayReason: entry ? undefined : noDayReason };
}

/** The reference for every official character, in TPI's order. */
export function characterReference(data: GameData, numeric?: NumericNightOrder): ReferenceEntry[] {
	const name = (id: CharacterId) => data.byId.get(id)?.name ?? id;
	const byName = new Map(data.characters.map((c) => [c.name.toLowerCase(), c.id]));
	const first = compareNightOrders(data.nightSheet.firstNight, numeric?.firstNight);
	const other = compareNightOrders(data.nightSheet.otherNight, numeric?.otherNight);
	return data.characters.map((character) => {
		const problems: string[] = [];
		const wiki = wikiUrl(character);
		const setup = setupModifierFor(character, (n) => byName.get(n.trim().toLowerCase()));
		if (character.setup && setup?.source !== 'table')
			problems.push('Has [setup] text but no curated setup modifier: read from the text.');
		if (setup && !samePage(setup.wiki, wiki))
			problems.push(`Setup-modifier wiki link (${setup.wiki}) is not the character’s wiki page.`);
		const jinxes = jinxesFor(data.jinxes, character.id).map((j) => ({
			with: j.characters[0] === character.id ? j.characters[1] : j.characters[0],
			reason: j.reason,
			exclusive: isExclusiveJinx(j.reason)
		}));
		const tokens = referenceTokens(character);
		for (const spec of setupSpecs(character)) {
			if (!tokens.some((t) => t.label === spec.label))
				problems.push(`Setup places [${spec.label}], which is not one of TPI’s reminder tokens.`);
		}
		for (const t of tokens) {
			if (t.setup + t.firstDay > t.copies)
				problems.push(
					`Setup places ${t.setup + t.firstDay} [${t.label}] but TPI lists ${t.copies}.`
				);
		}
		const firstNight = nightFor(character, 'first', first);
		const otherNight = nightFor(character, 'other', other);
		problems.push(...firstNight.issues.map((i) => `First night: ${i}`));
		problems.push(...otherNight.issues.map((i) => `Other nights: ${i}`));
		const day = dayFor(character, name, problems);
		const differences: ReferenceDifference[] = [];
		for (const [part, title, info] of [
			['firstNight', 'First night', firstNight],
			['otherNight', 'Other nights', otherNight]
		] as const) {
			if (info.ours && info.text !== undefined)
				differences.push({
					part,
					title,
					source: info.text,
					ours: info.ours.text,
					reason: info.ours.reason
				});
		}

		const filters = new Set<ReferenceFilter>();
		if (day.reminders.length > 0) filters.add('day');
		if (firstNight.text !== undefined) filters.add('firstNight');
		if (otherNight.text !== undefined) filters.add('otherNight');
		if (jinxes.length > 0) filters.add('jinxes');
		if (character.setup || setup) filters.add('setup');
		if (differences.length > 0) filters.add('differs');
		if (problems.length > 0) filters.add('problems');

		const alignment = defaultAlignment(character.type);
		return {
			character,
			...(alignment ? { alignment } : {}),
			alignmentNote: alignmentNote(character.type),
			...(setup ? { setup } : {}),
			tokens,
			jinxes,
			firstNight,
			otherNight,
			dayReminders: day.reminders,
			differences,
			...(day.noDayReason !== undefined ? { noDayReason: day.noDayReason } : {}),
			...(wiki ? { wiki } : {}),
			problems,
			filters
		};
	});
}

/** Plain text of a reminder sentence: "[Witch] has chosen [player with “Cursed”]". */
export function referenceText(
	segments: readonly ReferenceSegment[],
	name: (id: CharacterId) => string = (id) => id
): string {
	return segments
		.map((s) =>
			s.kind === 'text'
				? s.text
				: s.kind === 'character'
					? `[${name(s.characterId)}]`
					: s.kind === 'value'
						? `(${s.placeholder})`
						: `[player with “${s.token}”]`
		)
		.join(' ');
}

export interface ReferenceQuery {
	/** Matched against name, id, ability, reminder tokens and jinx text. */
	search?: string;
	/** Character types to show; empty or absent shows every type. */
	types?: readonly CharacterType[];
	/** Every listed filter must hold. */
	filters?: readonly ReferenceFilter[];
}

const fold = (s: string) =>
	s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '').toLowerCase();

export function matchesReference(entry: ReferenceEntry, query: ReferenceQuery): boolean {
	const { character } = entry;
	if (query.types?.length && !query.types.includes(character.type)) return false;
	if (query.filters?.some((f) => !entry.filters.has(f))) return false;
	const words = fold(query.search ?? '')
		.split(/\s+/)
		.filter(Boolean);
	if (words.length === 0) return true;
	const haystack = fold(
		[
			character.name,
			character.id,
			character.ability,
			...character.reminders,
			...character.remindersGlobal,
			...entry.jinxes.map((j) => j.reason)
		].join(' ')
	);
	return words.every((w) => haystack.includes(w));
}

/**
 * The night order with every official character in play and a full table (15 players),
 * exactly as the night-order engine builds it for a game.
 */
export function fullNightOrder(
	data: GameData,
	night: Night,
	numeric?: NumericNightOrder
): NightOrder {
	return nightOrder({
		night,
		sheet: data.nightSheet,
		inPlay: data.characters,
		players: MAX_DEALT_PLAYERS,
		...(numeric ? { numeric } : {})
	});
}

/** Position of each step on TPI's sheet (Dusk = #1), for the night-order view. */
export function sheetPosition(sheet: NightSheet, night: Night, id: CharacterId | NightMarker) {
	const list = night === 'first' ? sheet.firstNight : sheet.otherNight;
	const i = list.indexOf(id);
	return i >= 0 ? i + 1 : undefined;
}
