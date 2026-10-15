/**
 * Pre-day reminders: shown after the night order, what the Storyteller should watch for
 * during the coming day, as short state-based sentences ("[Witch · Sam] has chosen
 * [Librarian · Alex]", "[Saint] is alive", "[Slayer] is poisoned") (Trevor, 2026-10-15).
 *
 * The curated list is `day-reminders.data.ts`. Homebrew and unlisted characters fall back
 * to keywords in their ability text and TPI `special`, flagged `autoDetected`.
 *
 * Everything is driven by grimoire state: seats, their reminders, who is dead and (when
 * known) how they died. The app does not track day or night. The Storyteller can override
 * any generated reminder (hide or reword it) and add their own (`DayReminderOverride`).
 */
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import type { DeathCause, Game, Reminder, SeatId } from '#lib/core/model/types.ts';
import {
	DAY_GROUP_TITLES,
	DAY_GROUPS,
	DAY_REMINDER_ENTRIES,
	NO_DAY_RELEVANCE,
	type DayCondition,
	type DayGroup,
	type DayReminderEntry,
	type DayReminderSpec,
	type DeathCauseMatch
} from './day-reminders.data.ts';

export { DAY_GROUP_TITLES, DAY_GROUPS, DAY_REMINDER_ENTRIES, NO_DAY_RELEVANCE };
export type { DayCondition, DayGroup, DayReminderEntry, DayReminderSpec, DeathCauseMatch };

/** Defined with the model's `Seat`; re-exported here for existing imports. */
export type { DeathCause };

/** The parts of a seat the reminders read (the model's `Seat` fits, plus `deathCause`). */
export interface DaySeat {
	seatId: SeatId;
	playerName?: string;
	/** The character token in the grimoire; seats without one are skipped. */
	characterId?: CharacterId;
	dead: boolean;
	deathCause?: DeathCause;
	reminders: readonly Reminder[];
}

/**
 * A Storyteller override, stored with the game:
 * - `hide`: drop a generated reminder (by its `key`);
 * - `edit`: keep the reminder's character badge but replace the rest with `text`;
 * - `add`: a reminder of the Storyteller's own, optionally about a character or seat.
 */
export type DayReminderOverride =
	| { kind: 'hide'; key: string }
	| { kind: 'edit'; key: string; text: string }
	| {
			kind: 'add';
			/** The Storyteller's own key, unique among overrides ("custom-1"). */
			key: string;
			group: DayGroup;
			text: string;
			characterId?: CharacterId;
			seatId?: SeatId;
	  };

export interface DayState {
	/** Seats in seating order. */
	seats: readonly DaySeat[];
	/** Fabled and Loric in play (not seated). */
	ruleCharacters?: readonly CharacterId[];
	/** Character lookup (official and homebrew). */
	character: (id: CharacterId) => Character | undefined;
	overrides?: readonly DayReminderOverride[];
	/** Values the Storyteller entered during prep (`Game.prepValues`). */
	prepValues?: Readonly<Record<string, string>>;
}

/** A badge for a character, with the seat and player name when there is one. */
export interface CharacterRef {
	characterId: CharacterId;
	seatId?: SeatId;
	playerName?: string;
}

export type ReminderSegment =
	| { kind: 'character'; ref: CharacterRef }
	| { kind: 'text'; text: string }
	/**
	 * A value the Storyteller enters during prep (`prepValueKey(characterId, key)`); `value`
	 * absent until entered, when the UI shows `placeholder`.
	 */
	| { kind: 'value'; characterId: CharacterId; key: string; placeholder: string; value?: string };

/** Where a prep value is stored in `Game.prepValues`: "yaggababble.phrase". */
export const prepValueKey = (characterId: CharacterId, key: string) => `${characterId}.${key}`;

export interface DayReminder {
	/** Stable id for overrides: the same state gives the same key. */
	key: string;
	characterId?: CharacterId;
	group: DayGroup;
	segments: ReminderSegment[];
	/** True when found by keywords in a homebrew or unlisted character's ability. */
	autoDetected: boolean;
	/** True when it depends on a death whose cause was not recorded. */
	uncertain?: boolean;
	/** Set when a Storyteller override changed or added it. */
	overridden?: 'edited' | 'added';
	wiki?: string;
}

export interface DayReminderGroup {
	group: DayGroup;
	title: string;
	reminders: DayReminder[];
}

export interface DayReminders {
	groups: DayReminderGroup[];
	/** Generated reminders the Storyteller hid, so they can be shown again. */
	hidden: DayReminder[];
}

const ENTRIES = new Map(DAY_REMINDER_ENTRIES.map((e) => [e.id, e]));
const QUIET = new Set(Object.keys(NO_DAY_RELEVANCE));

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** "poisoned" or "drunk" when a reminder token says so ("Poisoned", "Is The Drunk", "Drunk 2"). */
export function impairment(label: string): 'poisoned' | 'drunk' | undefined {
	if (/\bpoisoned\b/i.test(label)) return 'poisoned';
	if (/\bdrunk\b/i.test(label)) return 'drunk';
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
				: s.kind === 'value'
					? `(${s.value ?? s.placeholder})`
					: `[${name(s.ref.characterId)}${s.ref.playerName ? ` · ${s.ref.playerName}` : ''}]`
		)
		.join(' ');
}

/**
 * The model's game as `DayState` (seats in seating order), with the Storyteller's stored
 * overrides unless `overrides` is given.
 */
export function dayStateFromGame(
	game: Game,
	character: (id: CharacterId) => Character | undefined,
	overrides: readonly DayReminderOverride[] | undefined = game.dayReminderOverrides
): DayState {
	return {
		seats: game.seating.map((id) => game.seats[id]).filter((s) => s !== undefined),
		ruleCharacters: game.ruleCharacters,
		character,
		...(game.prepValues ? { prepValues: game.prepValues } : {}),
		...(overrides ? { overrides } : {})
	};
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

function carriers(state: DayState, source: CharacterId, label: string): DaySeat[] {
	return state.seats.filter((s) =>
		s.reminders.some((r) => r.characterId === source && same(r.label, label))
	);
}

function fill(
	spec: DayReminderSpec,
	selfRef: CharacterRef,
	targetSeat: DaySeat | undefined,
	values: Readonly<Record<string, string>> = {}
): ReminderSegment[] {
	return spec.template.map((part): ReminderSegment => {
		if ('text' in part) return { kind: 'text', text: part.text };
		if ('self' in part) return { kind: 'character', ref: selfRef };
		if ('value' in part) {
			const value = values[prepValueKey(selfRef.characterId, part.value)];
			return {
				kind: 'value',
				characterId: selfRef.characterId,
				key: part.value,
				placeholder: part.placeholder,
				...(value ? { value } : {})
			};
		}
		return { kind: 'character', ref: refFor(targetSeat, targetSeat?.characterId ?? '') };
	});
}

/**
 * Whether a death cause matches. Returns 'unknown' when no cause was recorded, so the
 * reminder still shows, flagged uncertain.
 */
function causeMatches(
	cause: DeathCause | undefined,
	wanted: readonly DeathCauseMatch[],
	state: DayState
): boolean | 'unknown' {
	if (cause === undefined) return 'unknown';
	if (wanted.includes(cause)) return true;
	return wanted.includes('demon') && state.character(cause)?.type === 'demon';
}

/** Whether `when` holds, apart from the reminder-carrier part. */
function conditionHolds(
	when: DayCondition,
	seat: DaySeat | undefined,
	state: DayState,
	alive: number
): boolean | 'unknown' {
	const self = when.self ?? 'alive';
	const dead = seat?.dead ?? false;
	if (self === 'alive' && dead) return false;
	if (self === 'dead' && !dead) return false;
	if (when.minAlive !== undefined && alive < when.minAlive) return false;
	if (when.cause && seat) return causeMatches(seat.deathCause, when.cause, state);
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
	const at = seat?.seatId ?? 'rule';
	entry.reminders.forEach((spec, index) => {
		const when = spec.when ?? {};
		const holds = conditionHolds(when, seat, state, alive);
		if (holds === false) return;
		if (when.noReminder && carriers(state, entry.id, when.noReminder).length > 0) return;
		const base = {
			characterId: entry.id,
			group: spec.group,
			autoDetected: false,
			wiki: entry.wiki,
			...(holds === 'unknown' ? { uncertain: true } : {})
		};
		const key = `${entry.id}#${index}@${at}`;
		if (when.reminder) {
			const targets = carriers(state, entry.id, when.reminder);
			const hasTarget = spec.template.some((p) => 'target' in p);
			if (hasTarget) {
				for (const target of targets) {
					out.push({
						...base,
						key: `${key}>${target.seatId}`,
						segments: fill(spec, selfRef, target, state.prepValues)
					});
				}
			} else if (targets.length > 0) {
				out.push({ ...base, key, segments: fill(spec, selfRef, undefined, state.prepValues) });
			}
		} else out.push({ ...base, key, segments: fill(spec, selfRef, undefined, state.prepValues) });
	});
	if (entry.impairable && seat && !seat.dead) {
		const states = new Set(seat.reminders.map((r) => impairment(r.label)));
		for (const impaired of ['poisoned', 'drunk'] as const) {
			if (!states.has(impaired)) continue;
			out.push({
				key: `${entry.id}#${impaired}@${at}`,
				characterId: entry.id,
				group: entry.reminders[0]?.group ?? 'day-ability',
				segments: [
					{ kind: 'character', ref: selfRef },
					{ kind: 'text', text: `is ${impaired}` }
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
			key: `${character.id}~${group}@${ref.seatId ?? 'rule'}`,
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

/** Applies the Storyteller's overrides: hide, edit, add. Unknown keys are ignored. */
export function applyDayOverrides(
	reminders: readonly DayReminder[],
	overrides: readonly DayReminderOverride[],
	state: Pick<DayState, 'seats'>
): { shown: DayReminder[]; hidden: DayReminder[] } {
	const hide = new Set<string>();
	const edits = new Map<string, string>();
	for (const o of overrides) {
		if (o.kind === 'hide') hide.add(o.key);
		else if (o.kind === 'edit') edits.set(o.key, o.text);
	}
	const shown: DayReminder[] = [];
	const hidden: DayReminder[] = [];
	for (const reminder of reminders) {
		if (hide.has(reminder.key)) {
			hidden.push(reminder);
			continue;
		}
		const text = edits.get(reminder.key);
		if (text === undefined) {
			shown.push(reminder);
			continue;
		}
		const badge = reminder.segments.find((s) => s.kind === 'character');
		shown.push({
			...reminder,
			segments: [...(badge ? [badge] : []), { kind: 'text', text }],
			overridden: 'edited'
		});
	}
	for (const o of overrides) {
		if (o.kind !== 'add' || hide.has(o.key)) continue;
		const seat = o.seatId ? state.seats.find((s) => s.seatId === o.seatId) : undefined;
		const characterId = o.characterId ?? seat?.characterId;
		shown.push({
			key: o.key,
			...(characterId ? { characterId } : {}),
			group: o.group,
			segments: [
				...(characterId ? [{ kind: 'character' as const, ref: refFor(seat, characterId) }] : []),
				{ kind: 'text', text: edits.get(o.key) ?? o.text }
			],
			autoDetected: false,
			overridden: 'added'
		});
	}
	return { shown, hidden };
}

/** Reminders for the coming day, grouped in `DAY_GROUPS` order; empty groups left out. */
export function dayReminders(state: DayState): DayReminders {
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
	for (const seat of state.seats) if (seat.characterId) visit(seat.characterId, seat);
	for (const id of state.ruleCharacters ?? []) visit(id, undefined);
	const { shown, hidden } = applyDayOverrides(all, state.overrides ?? [], state);
	const groups = DAY_GROUPS.map((group) => ({
		group,
		title: DAY_GROUP_TITLES[group],
		reminders: shown.filter((r) => r.group === group)
	})).filter((g) => g.reminders.length > 0);
	return { groups, hidden };
}

/**
 * Whether a character's day ability is once per game and marked by its "No Ability"
 * reminder token (the Slayer, Artist, Fisherman, Virgin, Fool), so the day panel offers a
 * one-tap "Used" (`UseAbility` places the token).
 */
export function isOnceOnlyDayAbility(characterId: CharacterId): boolean {
	return (
		ENTRIES.get(characterId)?.reminders.some((r) => r.when?.noReminder === 'No Ability') ?? false
	);
}
