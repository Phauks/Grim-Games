/**
 * Pre-day reminders: shown after the night order, what the Storyteller should watch for
 * during the coming day, as short state-based sentences ("[Witch · Sam] has chosen
 * [Librarian · Alex]", "[Saint] is alive", "[Slayer] is poisoned") (Trevor, 2026-10-15).
 *
 * The curated list is `day-reminders.data.ts`. Homebrew and unlisted characters fall back
 * to keywords in their ability text and TPI `special`, flagged `autoDetected`.
 *
 * The game state comes in as a minimal local shape (`DayState`) until the domain model
 * lands; the lead can map the real model onto it.
 */
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import {
	DAY_GROUP_TITLES,
	DAY_GROUPS,
	DAY_REMINDER_ENTRIES,
	NO_DAY_RELEVANCE,
	type DayCondition,
	type DayGroup,
	type DayReminderEntry,
	type DayReminderSpec
} from './day-reminders.data.ts';

export { DAY_GROUP_TITLES, DAY_GROUPS, DAY_REMINDER_ENTRIES, NO_DAY_RELEVANCE };
export type { DayCondition, DayGroup, DayReminderEntry, DayReminderSpec };

/** A reminder token on a seat, placed by `source`'s ability ("Cursed" from the Witch). */
export interface SeatReminder {
	source: CharacterId;
	token: string;
}

export interface DaySeat {
	seatId: string;
	/** The character in the grimoire for this seat. */
	characterId: CharacterId;
	playerName?: string;
	dead: boolean;
	reminders: readonly SeatReminder[];
}

export interface DayState {
	/** The coming day: 1 for the first day. */
	day: number;
	seats: readonly DaySeat[];
	/** Fabled and Loric in play (not seated). */
	rules?: readonly CharacterId[];
	/** Character lookup (official and homebrew). */
	character: (id: CharacterId) => Character | undefined;
}

/** A badge for a character, with the seat and player name when there is one. */
export interface CharacterRef {
	characterId: CharacterId;
	seatId?: string;
	playerName?: string;
}

export type ReminderSegment =
	{ kind: 'character'; ref: CharacterRef } | { kind: 'text'; text: string };

export interface DayReminder {
	characterId: CharacterId;
	group: DayGroup;
	segments: ReminderSegment[];
	/** True when found by keywords in a homebrew or unlisted character's ability. */
	autoDetected: boolean;
	wiki?: string;
}

export interface DayReminderGroup {
	group: DayGroup;
	title: string;
	reminders: DayReminder[];
}

const ENTRIES = new Map(DAY_REMINDER_ENTRIES.map((e) => [e.id, e]));
const QUIET = new Set(Object.keys(NO_DAY_RELEVANCE));

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** "poisoned" or "drunk" when a reminder token says so ("Poisoned", "Is The Drunk", "Drunk 2"). */
export function impairment(token: string): 'poisoned' | 'drunk' | undefined {
	if (/\bpoisoned\b/i.test(token)) return 'poisoned';
	if (/\bdrunk\b/i.test(token)) return 'drunk';
	return undefined;
}

/** Plain text, for the draft list and tests: "[Witch · Sam] has chosen [Librarian]". */
export function renderReminder(
	segments: readonly ReminderSegment[],
	name: (id: CharacterId) => string = (id) => id
): string {
	return segments
		.map((s) =>
			s.kind === 'text'
				? s.text
				: `[${name(s.ref.characterId)}${s.ref.playerName ? ` · ${s.ref.playerName}` : ''}]`
		)
		.join(' ');
}

function refFor(seat: DaySeat | undefined, characterId: CharacterId): CharacterRef {
	return seat
		? {
				characterId,
				seatId: seat.seatId,
				...(seat.playerName ? { playerName: seat.playerName } : {})
			}
		: { characterId };
}

function carriers(state: DayState, source: CharacterId, token: string): DaySeat[] {
	return state.seats.filter((s) =>
		s.reminders.some((r) => r.source === source && same(r.token, token))
	);
}

function fill(
	spec: DayReminderSpec,
	selfRef: CharacterRef,
	targetSeat: DaySeat | undefined
): ReminderSegment[] {
	return spec.template.map((part): ReminderSegment => {
		if ('text' in part) return { kind: 'text', text: part.text };
		if ('self' in part) return { kind: 'character', ref: selfRef };
		return { kind: 'character', ref: refFor(targetSeat, targetSeat?.characterId ?? '') };
	});
}

/** Whether `when` holds, apart from the reminder-carrier part. */
function conditionHolds(
	when: DayCondition,
	seat: DaySeat | undefined,
	state: DayState,
	alive: number
): boolean {
	const self = when.self ?? 'alive';
	const dead = seat?.dead ?? false;
	if (self === 'alive' && dead) return false;
	if (self === 'dead' && !dead) return false;
	if (when.day !== undefined && state.day !== when.day) return false;
	if (when.fromDay !== undefined && state.day < when.fromDay) return false;
	if (when.minAlive !== undefined && alive < when.minAlive) return false;
	return true;
}

function curated(
	entry: DayReminderEntry,
	seat: DaySeat | undefined,
	state: DayState,
	alive: number
): DayReminder[] {
	const out: DayReminder[] = [];
	const selfRef = refFor(seat, entry.id);
	for (const spec of entry.reminders) {
		const when = spec.when ?? {};
		if (!conditionHolds(when, seat, state, alive)) continue;
		if (when.noReminder && carriers(state, entry.id, when.noReminder).length > 0) continue;
		const base = {
			characterId: entry.id,
			group: spec.group,
			autoDetected: false,
			wiki: entry.wiki
		};
		if (when.reminder) {
			const targets = carriers(state, entry.id, when.reminder);
			const hasTarget = spec.template.some((p) => 'target' in p);
			if (hasTarget)
				for (const target of targets) out.push({ ...base, segments: fill(spec, selfRef, target) });
			else if (targets.length > 0) out.push({ ...base, segments: fill(spec, selfRef, undefined) });
		} else out.push({ ...base, segments: fill(spec, selfRef, undefined) });
	}
	if (entry.impairable && seat && !seat.dead) {
		const states = new Set(
			seat.reminders.map((r) => impairment(r.token)).filter((x) => x !== undefined)
		);
		for (const state of ['poisoned', 'drunk'] as const) {
			if (!states.has(state)) continue;
			out.push({
				characterId: entry.id,
				group: entry.reminders[0]?.group ?? 'day-ability',
				segments: [
					{ kind: 'character', ref: selfRef },
					{ kind: 'text', text: `is ${state}` }
				],
				autoDetected: false,
				wiki: entry.wiki
			});
		}
	}
	return out;
}

/** Keyword rules for homebrew and unlisted characters, one reminder per group. */
const HEURISTICS: readonly [DayGroup, RegExp, string][] = [
	[
		'day-ability',
		/\b(during the day|each day|once per day|today|before nominations|publicly)\b/i,
		'may act today'
	],
	['nomination', /\bnominat/i, 'affects nominations'],
	['vote', /\bvot(e|es|ed|ing)\b/i, 'affects voting'],
	['execution-death', /\b(execut\w*|exiled?|dies|die|died|death)\b/i, 'affects deaths'],
	['madness', /\bmad\b|[“"]mad[”"]/i, 'involves madness'],
	['announcement', /\b(all players (know|learn)|everyone knows?)\b/i, 'is public']
];

/** Auto-detected reminders for a character the curated list does not cover. */
export function detectDayReminders(
	character: Character,
	ref: CharacterRef = { characterId: character.id }
): DayReminder[] {
	const out: DayReminder[] = [];
	const groups = new Set<DayGroup>();
	const push = (group: DayGroup, text: string) => {
		if (groups.has(group)) return;
		groups.add(group);
		out.push({
			characterId: character.id,
			group,
			segments: [
				{ kind: 'character', ref },
				{ kind: 'text', text }
			],
			autoDetected: true
		});
	};
	// [Brackets] are setup-only.
	const ability = character.ability.replace(/\[[^\]]*\]/g, '');
	for (const [group, pattern, text] of HEURISTICS) if (pattern.test(ability)) push(group, text);
	for (const s of character.special) {
		if (s.type === 'vote' || s.name === 'ghost-votes') push('vote', 'affects voting');
		if (s.name === 'pointing' && s.time === 'day') push('day-ability', 'may act today');
		if (s.name === 'public') push('announcement', 'is public');
	}
	return out;
}

/** Reminders for the coming day, grouped in `DAY_GROUPS` order; empty groups left out. */
export function dayReminders(state: DayState): DayReminderGroup[] {
	const alive = state.seats.filter((s) => !s.dead).length;
	const all: DayReminder[] = [];
	const visit = (characterId: CharacterId, seat: DaySeat | undefined) => {
		const character = state.character(characterId);
		const homebrew = character !== undefined && character.edition === undefined;
		const entry = homebrew ? undefined : ENTRIES.get(characterId);
		if (entry) all.push(...curated(entry, seat, state, alive));
		else if (character && (homebrew || !QUIET.has(characterId)) && !seat?.dead) {
			all.push(...detectDayReminders(character, refFor(seat, characterId)));
		}
	};
	for (const seat of state.seats) visit(seat.characterId, seat);
	for (const id of state.rules ?? []) visit(id, undefined);
	return DAY_GROUPS.map((group) => ({
		group,
		title: DAY_GROUP_TITLES[group],
		reminders: all.filter((r) => r.group === group)
	})).filter((g) => g.reminders.length > 0);
}
