/**
 * What the Savant's statement templates read (`savant-templates.ts`): the game's facts, the
 * template shapes, and the helpers the templates share. `savant.ts` works them out.
 */
import type { CharacterId, CharacterType } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { DayEntry, DayLog, Game, SeatId } from '#lib/core/model/types.ts';
import type { RegistrationWorld } from './ability.ts';

import type { SavantGroup, SavantPart } from './savant.ts';

// ── Facts the templates read ────────────────────────────────────────────────

export const text = (t: string): SavantPart => ({ text: t });

export interface Facts {
	game: Game;
	characters: CharacterLookup;
	savant: SeatId;
	/** Seats with a character, in seating order. */
	seats: SeatId[];
	n: number;
	others: SeatId[];
	inPlay: Set<CharacterId>;
	/** Script characters a player can be (no Travellers, Fabled or Loric). */
	script: CharacterId[];
	dead: (s: SeatId) => boolean;
	/** The day log closed by the last "New day": yesterday and last night. */
	yesterday?: DayLog;
	/** The game just after each "New day", oldest first (the first is the start). */
	dawns: readonly Game[];
	/** The game at this morning's "New day", when there was one. */
	lastDawn?: Game;
	/** The night just gone was the first night. */
	firstNightJustGone: boolean;
	impaired: (s: SeatId) => boolean;
}

/** Steps round the circle between two seats, the shorter way. */
export function distance(f: Facts, a: SeatId, b: SeatId): number {
	const d = Math.abs(f.game.seating.indexOf(a) - f.game.seating.indexOf(b));
	return Math.min(d, f.game.seating.length - d);
}

/** The seats either side, alive or dead. */
export function sideBySide(f: Facts, s: SeatId): SeatId[] {
	const { seating } = f.game;
	const i = seating.indexOf(s);
	const n = seating.length;
	return [seating[(i - 1 + n) % n], seating[(i + 1) % n]].filter(
		(x, j, all) => x !== s && all.indexOf(x) === j
	);
}

// ── Templates ───────────────────────────────────────────────────────────────

/** One filled-in template: its words, and whether it holds in a world. */
export interface Instance {
	blanks: string;
	parts: SavantPart[];
	holds: (w: RegistrationWorld) => boolean;
	/** The Storyteller decides (`check`). */
	manual?: boolean;
}

export interface Template {
	id: string;
	group: SavantGroup;
	instances: (f: Facts, w0: RegistrationWorld) => Instance[];
}

/** Numbers to offer for a count: the truth and up to two either side, within the range. */
function near(truth: number, min: number, max: number): number[] {
	const out: number[] = [];
	for (let v = truth - 2; v <= truth + 2; v++) if (v >= min && v <= max) out.push(v);
	return out;
}

/** "There are N …" templates: a count in each world, offered near the default world's. */
export function count(
	id: string,
	group: SavantGroup,
	value: (f: Facts, w: RegistrationWorld) => number | undefined,
	words: (n: number) => SavantPart[],
	max: (f: Facts) => number,
	min = 0
): Template {
	return {
		id,
		group,
		instances(f, w0) {
			const truth = value(f, w0);
			if (truth === undefined) return [];
			return near(truth, Math.min(min, truth), Math.max(max(f), truth)).map((v) => ({
				blanks: String(v),
				parts: words(v),
				holds: (w) => value(f, w) === v
			}));
		}
	};
}

export const alive = (f: Facts) => f.seats.filter((s) => !f.dead(s));
export const typed = (f: Facts, w: RegistrationWorld, t: CharacterType) =>
	f.seats.filter((s) => w.type(s) === t);
export const isEvil = (w: RegistrationWorld, s: SeatId) => w.alignment(s) === 'evil';

/** The one Demon's seat, or none when there is no Demon or more than one (Legion). */
export function demonSeat(f: Facts, w: RegistrationWorld): SeatId | undefined {
	const demons = typed(f, w, 'demon');
	return demons.length === 1 ? demons[0] : undefined;
}

export const demonsOnScript = (f: Facts) =>
	f.script.filter((id) => f.characters.get(id)?.type === 'demon').length;

export function pairs<T>(list: readonly T[]): [T, T][] {
	const out: [T, T][] = [];
	for (let i = 0; i < list.length; i++)
		for (let j = i + 1; j < list.length; j++) out.push([list[i], list[j]]);
	return out;
}

/** The longest run of players of one alignment round the circle (all of them if everyone is). */
export function longestRun(f: Facts, w: RegistrationWorld, alignment: 'good' | 'evil'): number {
	const seating = f.game.seating;
	const good = seating.map((s) => w.alignment(s) === alignment);
	if (good.every(Boolean)) return seating.length;
	let best = 0;
	let run = 0;
	for (let i = 0; i < seating.length * 2; i++) {
		run = good[i % seating.length] ? run + 1 : 0;
		best = Math.max(best, run);
	}
	return best;
}

export const hasReminder = (f: Facts, s: SeatId, characterId: CharacterId, label: string) =>
	f.game.seats[s].reminders.some((r) => r.characterId === characterId && r.label === label);
export const hasLabel = (f: Facts, s: SeatId, label: string) =>
	f.game.seats[s].reminders.some((r) => r.label === label);
export const ownNoAbility = (f: Facts, s: SeatId) =>
	f.game.seats[s].reminders.some(
		(r) => r.label === 'No Ability' && r.characterId === trueCharacter(f.game, s, f.characters)
	);
export const seatOf = (f: Facts, id: CharacterId) =>
	f.seats.find((s) => trueCharacter(f.game, s, f.characters) === id);
export const nominations = (log: DayLog | undefined) =>
	(log?.entries ?? []).filter(
		(e): e is Extract<DayEntry, { kind: 'nomination' }> => e.kind === 'nomination'
	);

/** A Minion's reminders that mark whom it chose (TPI's reminder names). */
export const MINION_CHOICES: Readonly<Record<CharacterId, readonly string[]>> = {
	poisoner: ['Poisoned'],
	widow: ['Poisoned'],
	witch: ['Cursed'],
	cerenovus: ['Mad'],
	harpy: ['Mad'],
	fearmonger: ['Fear'],
	devilsadvocate: ['Survives Execution'],
	assassin: ['Dead'],
	godfather: ['Dead']
};

export function triples<T>(list: readonly T[]): [T, T, T][] {
	const out: [T, T, T][] = [];
	for (let i = 0; i < list.length; i++)
		for (let j = i + 1; j < list.length; j++)
			for (let k = j + 1; k < list.length; k++) out.push([list[i], list[j], list[k]]);
	return out;
}

/**
 * The two statements the app cannot work out: what the Snake Charmer chose leaves no trace
 * unless it hits the Demon, and declining an ability is not recorded. The Storyteller says
 * whether each holds (`check`).
 */
export function manual(id: string, parts: (f: Facts) => SavantPart[] | undefined): Template {
	return {
		id,
		group: 'manual',
		instances(f) {
			const p = parts(f);
			return p ? [{ blanks: '', parts: p, holds: () => false, manual: true }] : [];
		}
	};
}

/** A Townsfolk's reminders that mark whom it chose last night (TPI's reminder names). */
export const TOWNSFOLK_CHOICES: Readonly<Record<CharacterId, readonly string[]>> = {
	monk: ['Safe'],
	innkeeper: ['Safe'],
	exorcist: ['Chosen']
};

/** Characters whose night information is a number. */
export const NUMBER_INFO: ReadonlySet<CharacterId> = new Set([
	'chef',
	'empath',
	'clockmaker',
	'mathematician',
	'oracle',
	'juggler',
	'chambermaid'
]);

/** Information characters whose ability works once per game. */
export const ONCE_INFO: ReadonlySet<CharacterId> = new Set(['seamstress', 'fisherman', 'artist']);

/**
 * Why a Minion might not learn the Demon at the start: fewer than 7 players (wiki Glossary,
 * "Minion Info"), the Magician,
 * the Marionette (never learns), the Poppy Grower, Lil' Monsta.
 * https://wiki.bloodontheclocktower.com/Magician, /Marionette, /Poppy_Grower, /Lil%27_Monsta
 */
export const HIDES_DEMON: readonly CharacterId[] = [
	'magician',
	'marionette',
	'poppygrower',
	'lilmonsta'
];

export const infoEntries = (log: DayLog | undefined) =>
	(log?.entries ?? []).filter((e): e is Extract<DayEntry, { kind: 'info' }> => e.kind === 'info');

/** Whether a character wakes on the night just gone. */
export function wakes(f: Facts, id: CharacterId | undefined): boolean {
	const c = id === undefined ? undefined : f.characters.get(id);
	return ((f.firstNightJustGone ? c?.firstNight : c?.otherNight) ?? 0) > 0;
}

/** Characters by seat in a game, true characters. */
export const castOf = (f: Facts, g: Game) =>
	new Map(g.seating.map((s) => [s, trueCharacter(g, s, f.characters)] as const));

/** Whether the Demon may pass to another player (the Imp, Fang Gu, Scarlet Woman, Pit-Hag). */
export function demonCanPass(f: Facts, w: RegistrationWorld): boolean | undefined {
	const d = demonSeat(f, w);
	if (d === undefined) return undefined;
	const demon = trueCharacter(f.game, d, f.characters);
	const living = (t: CharacterType) => alive(f).some((s) => s !== d && w.type(s) === t);
	const livingAs = (id: CharacterId) =>
		alive(f).some((s) => trueCharacter(f.game, s, f.characters) === id);
	return (
		(demon === 'imp' && living('minion')) ||
		(demon === 'fanggu' && living('outsider')) ||
		(livingAs('scarletwoman') && alive(f).length >= 5) ||
		livingAs('pithag')
	);
}
