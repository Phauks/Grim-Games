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
	CHARACTER_TYPES,
	type Alignment,
	type Character,
	type CharacterId,
	type CharacterType,
	type NightMarker,
	type NightSheet
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
import { setupModifierFor, type SetupModifier } from './setup-modifiers.ts';

/** A piece of a reminder sentence: a character badge, the player carrying a token, or text. */
export type ReferenceSegment =
	| { kind: 'character'; characterId: CharacterId }
	| { kind: 'target'; token: string }
	| { kind: 'text'; text: string };

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
	'problems'
] as const;
export type ReferenceFilter = (typeof REFERENCE_FILTERS)[number];

export const REFERENCE_FILTER_LABELS: Record<ReferenceFilter, string> = {
	day: 'Day reminder',
	firstNight: 'Wakes first night',
	otherNight: 'Wakes other nights',
	jinxes: 'Has jinxes',
	setup: 'Changes setup',
	problems: 'Possible problems'
};

export interface ReferenceEntry {
	character: Character;
	/** From the character type; Travellers get theirs when assigned. */
	alignment?: Alignment;
	alignmentNote: string;
	setup?: SetupModifier;
	jinxes: ReferenceJinx[];
	firstNight: ReferenceNight;
	otherNight: ReferenceNight;
	dayReminders: ReferenceDayReminder[];
	/** Why the character has no pre-day reminders (`NO_DAY_RELEVANCE`). */
	noDayReason?: string;
	wiki?: string;
	/** Consistency checks that failed: things to look at. */
	problems: string[];
	filters: ReadonlySet<ReferenceFilter>;
}

/** Plain-words alignment from the type (`defaultAlignment`). */
export function alignmentNote(type: CharacterType): string {
	const alignment = defaultAlignment(type);
	if (alignment) return `${alignment === 'good' ? 'Good' : 'Evil'} (from the character type)`;
	if (type === 'traveller') return 'Set by the Storyteller when a Traveller joins';
	return 'None: a rule character, never seated';
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
	return {
		...(found?.position !== undefined ? { position: found.position } : {}),
		...(found?.number !== undefined ? { number: found.number } : {}),
		...(text !== undefined ? { text } : {}),
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
			for (const state of ['poisoned', 'drunk']) {
				reminders.push({
					group,
					groupTitle: DAY_GROUP_TITLES[group],
					segments: [
						{ kind: 'character', characterId: character.id },
						{ kind: 'text', text: `is ${state}` }
					],
					when: describeImpairable(character),
					impairment: true
				});
			}
		}
		if (!samePage(entry.wiki, wikiUrl(character)))
			problems.push(`Day-reminder wiki link (${entry.wiki}) is not the character’s wiki page.`);
	} else if (noDayReason === undefined) {
		problems.push('Not in the curated day-reminder list: reminders are guessed from the ability.');
		for (const r of detectDayReminders(character)) {
			reminders.push({
				group: r.group,
				groupTitle: DAY_GROUP_TITLES[r.group],
				segments: r.segments.map((s) =>
					s.kind === 'character'
						? { kind: 'character', characterId: s.ref.characterId }
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
		const firstNight = nightFor(character, 'first', first);
		const otherNight = nightFor(character, 'other', other);
		problems.push(...firstNight.issues.map((i) => `First night: ${i}`));
		problems.push(...otherNight.issues.map((i) => `Other nights: ${i}`));
		const day = dayFor(character, name, problems);

		const filters = new Set<ReferenceFilter>();
		if (day.reminders.length > 0) filters.add('day');
		if (firstNight.text !== undefined) filters.add('firstNight');
		if (otherNight.text !== undefined) filters.add('otherNight');
		if (jinxes.length > 0) filters.add('jinxes');
		if (character.setup || setup) filters.add('setup');
		if (problems.length > 0) filters.add('problems');

		const alignment = defaultAlignment(character.type);
		return {
			character,
			...(alignment ? { alignment } : {}),
			alignmentNote: alignmentNote(character.type),
			...(setup ? { setup } : {}),
			jinxes,
			firstNight,
			otherNight,
			dayReminders: day.reminders,
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

/** Entries grouped by character type, in TPI's type order; empty types left out. */
export function groupByType(
	entries: readonly ReferenceEntry[]
): { type: CharacterType; entries: ReferenceEntry[] }[] {
	return CHARACTER_TYPES.map((type) => ({
		type,
		entries: entries.filter((e) => e.character.type === type)
	})).filter((g) => g.entries.length > 0);
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
