/**
 * Night information worked out from the grimoire and today's day log, so the Storyteller
 * does not have to count or remember it:
 * - answers for characters whose information depends on the day (Town Crier, Flowergirl,
 *   Undertaker, Juggler) or on who is dead (Oracle);
 * - an info picker for the first-night information characters (Washerwoman, Librarian,
 *   Investigator, Chef, Empath, Fortune Teller, Steward, Noble): the truthful options.
 *
 * Everything here is a suggestion (04-architecture.md §4: assist, never rule):
 * - `unreliable` says the waking player is poisoned or drunk (a reminder token says so, or
 *   they are the Drunk), so the Storyteller may give any answer;
 * - `mustBeFalse` says a Vortox is in play, so a Townsfolk's information must be false
 *   (https://wiki.bloodontheclocktower.com/Vortox);
 * - `misregister` lists players who might register as something else (Spy, Recluse), so
 *   the truthful answer may differ;
 * - `shown` is what the Storyteller recorded as shown (`RecordNightInfo`): their override.
 *
 * The answers read the *current* day log. The Storyteller clears it by hand with "New
 * day"; opening the night order never does (Trevor, 2026-10-15).
 */
import type { Character, CharacterId, CharacterType } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import {
	aliveNeighbours,
	alignmentOf,
	getSeat,
	registersAsDead,
	trueCharacter,
	typeOf
} from '#lib/core/model/selectors.ts';
import type { DayEntry, DayEntryId, Game, Reminder, SeatId } from '#lib/core/model/types.ts';
import { impairment } from './day-reminders.ts';

const W = 'https://wiki.bloodontheclocktower.com/';

/**
 * Characters that might register as another character type or alignment, so a truthful
 * answer about them is the Storyteller's choice.
 * https://wiki.bloodontheclocktower.com/Spy, https://wiki.bloodontheclocktower.com/Recluse
 */
export const MAY_MISREGISTER: Readonly<Record<CharacterId, string>> = {
	spy: `${W}Spy`,
	recluse: `${W}Recluse`
};

export interface Reliability {
	/** The waking player is poisoned or drunk: any answer is allowed. */
	unreliable?: 'poisoned' | 'drunk';
	/** A Vortox is in play and the waking character is a Townsfolk: the answer must be false. */
	mustBeFalse?: boolean;
	/** Players who might register falsely (Spy, Recluse). */
	misregister: SeatId[];
	/** The latest info the Storyteller recorded for this player and character today. */
	shown?: { entryId: DayEntryId; text: string };
}

/** An answer's value, worked out from the grimoire. */
export type AnswerValue =
	| { kind: 'yes-no'; value: boolean }
	| { kind: 'character'; value: CharacterId }
	| { kind: 'number'; value: number }
	/** Nothing to give yet: `reason` in our words ("Nobody died by execution today"). */
	| { kind: 'none'; reason: string };

export type NightAnswer = AnswerValue &
	Reliability & {
		characterId: CharacterId;
		/** The waking player. */
		seatId: SeatId;
		/** The players behind the answer (who nominated, who was executed, correct guesses). */
		because: SeatId[];
		wiki: string;
	};

function seatsWith(game: Game, characters: CharacterLookup, id: CharacterId): SeatId[] {
	return game.seating.filter((s) => trueCharacter(game, s, characters) === id);
}

/** Poisoned, drunk, Vortox, misregistration and recorded info for a waking player. */
export function reliability(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup
): Reliability {
	const out: Reliability = { misregister: [] };
	const seat = getSeat(game, seatId);
	if (!seat) return out;
	const states = seat.reminders.map((r) => impairment(r.label));
	if (states.includes('poisoned')) out.unreliable = 'poisoned';
	else if (states.includes('drunk') || trueCharacter(game, seatId, characters) === 'drunk') {
		out.unreliable = 'drunk';
	}
	if (
		characters.get(characterId)?.type === 'townsfolk' &&
		seatsWith(game, characters, 'vortox').length > 0
	) {
		out.mustBeFalse = true;
	}
	out.misregister = game.seating.filter((s) => {
		const id = trueCharacter(game, s, characters);
		return s !== seatId && id !== undefined && Object.hasOwn(MAY_MISREGISTER, id);
	});
	const shown = game.today.entries.findLast(
		(e): e is Extract<DayEntry, { kind: 'info' }> =>
			e.kind === 'info' && e.seatId === seatId && e.characterId === characterId
	);
	if (shown) out.shown = { entryId: shown.entryId, text: shown.text };
	return out;
}

function answer(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup,
	value: AnswerValue,
	because: SeatId[]
): NightAnswer {
	return {
		...value,
		...reliability(game, seatId, characterId, characters),
		characterId,
		seatId,
		because,
		wiki: ANSWER_WIKI[characterId] ?? W
	};
}

const ANSWER_WIKI: Readonly<Record<CharacterId, string>> = {
	towncrier: `${W}Town_Crier`,
	flowergirl: `${W}Flowergirl`,
	undertaker: `${W}Undertaker`,
	juggler: `${W}Juggler`,
	oracle: `${W}Oracle`
};

function entriesOf<K extends DayEntry['kind']>(game: Game, kind: K) {
	return game.today.entries.filter((e): e is Extract<DayEntry, { kind: K }> => e.kind === kind);
}

/**
 * Town Crier: whether a Minion nominated today, and who
 * (https://wiki.bloodontheclocktower.com/Town_Crier). Uses each nominator's true character.
 */
export function townCrierAnswer(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): NightAnswer {
	const minions = entriesOf(game, 'nomination')
		.map((e) => e.nominator)
		.filter((s, i, all) => all.indexOf(s) === i)
		.filter((s) => typeOf(game, s, characters) === 'minion');
	return answer(
		game,
		seatId,
		'towncrier',
		characters,
		{ kind: 'yes-no', value: minions.length > 0 },
		minions
	);
}

/**
 * Flowergirl: whether the Demon voted today (https://wiki.bloodontheclocktower.com/Flowergirl).
 * Votes are not tracked, so this is the Storyteller's "Demon voted" mark.
 */
export function flowergirlAnswer(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): NightAnswer {
	const demons = game.seating.filter((s) => typeOf(game, s, characters) === 'demon');
	const voted = game.today.demonVoted;
	return answer(
		game,
		seatId,
		'flowergirl',
		characters,
		voted === undefined
			? { kind: 'none', reason: 'Mark whether the Demon voted today' }
			: { kind: 'yes-no', value: voted },
		voted ? demons : []
	);
}

/**
 * Undertaker: the character of the player who died by execution today
 * (https://wiki.bloodontheclocktower.com/Undertaker). The grimoire's true character: the
 * Drunk shows as the Drunk. Nobody died by execution: the Undertaker learns nothing.
 */
export function undertakerAnswer(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): NightAnswer {
	const executed = entriesOf(game, 'execution').findLast(
		(e) => e.died && getSeat(game, e.seatId)?.dead
	);
	const id = executed && trueCharacter(game, executed.seatId, characters);
	return answer(
		game,
		seatId,
		'undertaker',
		characters,
		id === undefined
			? { kind: 'none', reason: 'Nobody died by execution today' }
			: { kind: 'character', value: id },
		executed ? [executed.seatId] : []
	);
}

/**
 * Juggler: how many of today's guesses are correct
 * (https://wiki.bloodontheclocktower.com/Juggler). Guesses come from the Juggler's day notes
 * and are checked against each player's true character; a player guessed twice counts once,
 * by the latest guess.
 */
export function jugglerAnswer(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): NightAnswer {
	const latest = new Map<SeatId, CharacterId>();
	for (const note of entriesOf(game, 'note')) {
		if (note.characterId !== 'juggler' || (note.seatId !== undefined && note.seatId !== seatId)) {
			continue;
		}
		for (const guess of note.guesses ?? []) latest.set(guess.seatId, guess.characterId);
	}
	const correct = [...latest].filter(([s, id]) => trueCharacter(game, s, characters) === id);
	return answer(
		game,
		seatId,
		'juggler',
		characters,
		latest.size === 0
			? { kind: 'none', reason: 'No guesses logged today' }
			: { kind: 'number', value: correct.length },
		correct.map(([s]) => s)
	);
}

/**
 * Oracle: how many dead players are evil (https://wiki.bloodontheclocktower.com/Oracle).
 * Dead as abilities see it, and the alignment the rules use (overrides win).
 */
export function oracleAnswer(game: Game, seatId: SeatId, characters: CharacterLookup): NightAnswer {
	const evilDead = game.seating.filter(
		(s) => registersAsDead(game, s) && alignmentOf(game, s) === 'evil'
	);
	return answer(
		game,
		seatId,
		'oracle',
		characters,
		{ kind: 'number', value: evilDead.length },
		evilDead
	);
}

/** The characters with answers worked out here. */
export const NIGHT_ANSWERS: Readonly<
	Record<CharacterId, (game: Game, seatId: SeatId, characters: CharacterLookup) => NightAnswer>
> = {
	towncrier: townCrierAnswer,
	flowergirl: flowergirlAnswer,
	undertaker: undertakerAnswer,
	juggler: jugglerAnswer,
	oracle: oracleAnswer
};

// ── Info picker ─────────────────────────────────────────────────────────────

/**
 * - `pair-character`: two players and a character, one of whom is that character
 *   (Washerwoman, Librarian, Investigator);
 * - `number`: a number (Chef, Empath);
 * - `players`: players to point at (Steward: 1 good player; Noble: 3, exactly 1 evil);
 * - `yes-no`: the player chose 2 players; yes or no (Fortune Teller).
 */
export type PickerKind = 'pair-character' | 'number' | 'players' | 'yes-no';

/** One option the Storyteller could show. */
export interface InfoOption {
	seats: SeatId[];
	characterId?: CharacterId;
	number?: number;
	yes?: boolean;
	/** "There are none in play" (a Librarian with no Outsiders learns 0). */
	none?: boolean;
}

export interface InfoPicker extends Reliability {
	kind: PickerKind;
	characterId: CharacterId;
	/** The waking player. */
	seatId: SeatId;
	/** How many players the Storyteller taps (0 for a number). */
	seatCount: number;
	/** For `pair-character`: the character type shown. */
	characterType?: CharacterType;
	/** The truthful options, from the grimoire. */
	options: InfoOption[];
	/** Every option is allowed, because the waking player is poisoned or drunk. */
	anyAllowed: boolean;
	/**
	 * Reminder tokens to place: `target` on the player who is the shown character (or the
	 * first player tapped), `other` on the second player, `each` on every player tapped.
	 */
	reminders: { target?: string; other?: string; each?: string };
	wiki: string;
}

/** What the Storyteller chose to show. */
export interface InfoChoice {
	seats: SeatId[];
	characterId?: CharacterId;
	number?: number;
	yes?: boolean;
	none?: boolean;
}

interface PickerSpec {
	kind: PickerKind;
	seatCount: number;
	characterType?: CharacterType;
	reminders: InfoPicker['reminders'];
	wiki: string;
}

/** The first-night information characters the picker covers. */
export const INFO_PICKERS: Readonly<Record<CharacterId, PickerSpec>> = {
	washerwoman: {
		kind: 'pair-character',
		seatCount: 2,
		characterType: 'townsfolk',
		reminders: { target: 'Townsfolk', other: 'Wrong' },
		wiki: `${W}Washerwoman`
	},
	librarian: {
		kind: 'pair-character',
		seatCount: 2,
		characterType: 'outsider',
		reminders: { target: 'Outsider', other: 'Wrong' },
		wiki: `${W}Librarian`
	},
	investigator: {
		kind: 'pair-character',
		seatCount: 2,
		characterType: 'minion',
		reminders: { target: 'Minion', other: 'Wrong' },
		wiki: `${W}Investigator`
	},
	chef: { kind: 'number', seatCount: 0, reminders: {}, wiki: `${W}Chef` },
	empath: { kind: 'number', seatCount: 0, reminders: {}, wiki: `${W}Empath` },
	fortuneteller: { kind: 'yes-no', seatCount: 2, reminders: {}, wiki: `${W}Fortune_Teller` },
	steward: { kind: 'players', seatCount: 1, reminders: { each: 'Know' }, wiki: `${W}Steward` },
	noble: { kind: 'players', seatCount: 3, reminders: { each: 'Know' }, wiki: `${W}Noble` }
};

/** Every unordered selection of `k` items. */
function choose<T>(items: readonly T[], k: number): T[][] {
	if (k === 0) return [[]];
	if (items.length < k) return [];
	const [first, ...rest] = items;
	return [...choose(rest, k - 1).map((c) => [first, ...c]), ...choose(rest, k)];
}

function isEvil(game: Game, seatId: SeatId): boolean {
	return alignmentOf(game, seatId) === 'evil';
}

function truthfulOptions(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	spec: PickerSpec,
	characters: CharacterLookup
): InfoOption[] {
	// Information is about the other players: the waking player is never one of them
	// (a rules question for Trevor; see the report).
	const others = game.seating.filter((s) => s !== seatId);
	switch (characterId) {
		case 'washerwoman':
		case 'librarian':
		case 'investigator': {
			// https://wiki.bloodontheclocktower.com/Washerwoman, /Librarian, /Investigator:
			// one of the two players is the character shown; the other is anyone else.
			const targets = others.filter((s) => typeOf(game, s, characters) === spec.characterType);
			const options = targets.flatMap((target) => {
				const id = trueCharacter(game, target, characters)!;
				return others
					.filter((s) => s !== target)
					.map((other): InfoOption => ({ seats: [target, other], characterId: id }));
			});
			// The Librarian learns there are no Outsiders when none are in play.
			if (characterId === 'librarian' && targets.length === 0) {
				options.push({ seats: [], none: true, number: 0 });
			}
			return options;
		}
		case 'chef': {
			// https://wiki.bloodontheclocktower.com/Chef: pairs of evil players sitting next to
			// each other, around the whole circle.
			const n = game.seating.length;
			let pairs = 0;
			for (let i = 0; i < n && n > 1; i++) {
				if (n === 2 && i === 1) break;
				if (isEvil(game, game.seating[i]) && isEvil(game, game.seating[(i + 1) % n])) pairs++;
			}
			return [{ seats: [], number: pairs }];
		}
		case 'empath': {
			// https://wiki.bloodontheclocktower.com/Empath: evil among the alive neighbours.
			const neighbours = aliveNeighbours(game, seatId);
			return [{ seats: [], number: neighbours.filter((s) => isEvil(game, s)).length }];
		}
		case 'fortuneteller': {
			// https://wiki.bloodontheclocktower.com/Fortune_Teller: yes when either chosen player
			// is the Demon or the red herring. The player may choose themselves.
			const flagged = (s: SeatId) =>
				typeOf(game, s, characters) === 'demon' ||
				(getSeat(game, s)?.reminders ?? []).some(
					(r) => r.characterId === 'fortuneteller' && r.label === 'Red Herring'
				);
			return choose(game.seating, 2).map((pair) => ({ seats: pair, yes: pair.some(flagged) }));
		}
		case 'steward':
			// https://wiki.bloodontheclocktower.com/Steward: one good player.
			return others.filter((s) => !isEvil(game, s)).map((s) => ({ seats: [s] }));
		case 'noble':
			// https://wiki.bloodontheclocktower.com/Noble: three players, exactly one evil.
			return choose(others, 3)
				.filter((trio) => trio.filter((s) => isEvil(game, s)).length === 1)
				.map((trio) => ({ seats: trio }));
		default:
			return [];
	}
}

/** The info picker for a waking player, or undefined for a character it does not cover. */
export function infoPicker(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup
): InfoPicker | undefined {
	const spec = Object.hasOwn(INFO_PICKERS, characterId) ? INFO_PICKERS[characterId] : undefined;
	if (!spec) return undefined;
	const r = reliability(game, seatId, characterId, characters);
	return {
		...r,
		kind: spec.kind,
		characterId,
		seatId,
		seatCount: spec.seatCount,
		...(spec.characterType ? { characterType: spec.characterType } : {}),
		options: truthfulOptions(game, seatId, characterId, spec, characters),
		anyAllowed: r.unreliable !== undefined,
		reminders: spec.reminders,
		wiki: spec.wiki
	};
}

const sameSeats = (a: readonly SeatId[], b: readonly SeatId[]) =>
	a.length === b.length && a.every((s) => b.includes(s));

/** Whether a choice is one of the picker's truthful options. */
export function isTruthful(picker: InfoPicker, choice: InfoChoice): boolean {
	return picker.options.some((o) => {
		switch (picker.kind) {
			case 'pair-character':
				return o.none
					? choice.none === true
					: !choice.none &&
							o.characterId === choice.characterId &&
							sameSeats(o.seats, choice.seats);
			case 'number':
				return o.number === choice.number;
			case 'players':
				return sameSeats(o.seats, choice.seats);
			case 'yes-no':
				return sameSeats(o.seats, choice.seats) && o.yes === choice.yes;
		}
	});
}

/**
 * Whether the choice is allowed: truthful, or anything when the waking player is poisoned
 * or drunk. With a Vortox in play a Townsfolk's info must be false instead.
 */
export function isAllowed(picker: InfoPicker, choice: InfoChoice): boolean {
	if (picker.anyAllowed) return true;
	const truthful = isTruthful(picker, choice);
	return picker.mustBeFalse ? !truthful : truthful;
}

/**
 * Seats and characters for the picker's display, truthful ones first: seats that are part
 * of a truthful option (the shown character's seat before the other), then the rest.
 */
export function truthfulFirst(
	picker: InfoPicker,
	game: Game
): { seats: SeatId[]; characters: CharacterId[] } {
	const seats: SeatId[] = [];
	const ids: CharacterId[] = [];
	for (const o of picker.options) {
		if (picker.kind === 'pair-character' && o.seats[0] && !seats.includes(o.seats[0])) {
			seats.push(o.seats[0]);
		}
		if (o.characterId && !ids.includes(o.characterId)) ids.push(o.characterId);
	}
	for (const s of game.seating) if (!seats.includes(s)) seats.push(s);
	return { seats, characters: ids };
}

/** The `RecordNightInfo` fields for a choice: text in our words, and tokens to place. */
export function infoRecord(
	picker: InfoPicker,
	choice: InfoChoice,
	name: { seat: (seatId: SeatId) => string; character: (id: CharacterId) => string },
	game: Game,
	characters: CharacterLookup
): { text: string; reminders: { seatId: SeatId; reminder: Reminder }[] } {
	const token = (seatId: SeatId, label: string) => ({
		seatId,
		reminder: { characterId: picker.characterId, label }
	});
	const players = choice.seats.map(name.seat);
	switch (picker.kind) {
		case 'pair-character': {
			if (choice.none) return { text: `Shown 0 (none in play)`, reminders: [] };
			const id = choice.characterId ?? '';
			// The token goes on the player who really is the character, when one is.
			const target =
				choice.seats.find((s) => trueCharacter(game, s, characters) === id) ?? choice.seats[0];
			const other = choice.seats.find((s) => s !== target);
			const reminders = [];
			if (target && picker.reminders.target) reminders.push(token(target, picker.reminders.target));
			if (other && picker.reminders.other) reminders.push(token(other, picker.reminders.other));
			return {
				text: `Shown ${players.join(' and ')}: one is the ${name.character(id)}`,
				reminders
			};
		}
		case 'number':
			return { text: `Shown ${choice.number ?? 0}`, reminders: [] };
		case 'players':
			return {
				text: `Shown ${players.join(', ')}`,
				reminders: picker.reminders.each
					? choice.seats.map((s) => token(s, picker.reminders.each!))
					: []
			};
		case 'yes-no':
			return {
				text: `Chose ${players.join(' and ')}: shown ${choice.yes ? 'yes' : 'no'}`,
				reminders: []
			};
	}
}

// ── Night order steps ───────────────────────────────────────────────────────

/** Data a night step carries: worked-out answers, or pickers, one per waking player. */
export type NightStepInfo =
	{ kind: 'answer'; answers: NightAnswer[] } | { kind: 'picker'; pickers: InfoPicker[] };

/**
 * The night info for one character step: one entry per player whose token is that
 * character (a Drunk who thinks they are the Washerwoman wakes as the Washerwoman, and the
 * answer is marked unreliable). Undefined when nothing is worked out for the character.
 */
export function nightStepInfo(
	game: Game,
	character: Pick<Character, 'id'>,
	characters: CharacterLookup
): NightStepInfo | undefined {
	const seats = game.seating.filter((s) => game.seats[s].characterId === character.id);
	if (seats.length === 0) return undefined;
	const answerFor = Object.hasOwn(NIGHT_ANSWERS, character.id)
		? NIGHT_ANSWERS[character.id]
		: undefined;
	if (answerFor) {
		return { kind: 'answer', answers: seats.map((s) => answerFor(game, s, characters)) };
	}
	const pickers = seats.flatMap((s) => infoPicker(game, s, character.id, characters) ?? []);
	return pickers.length > 0 ? { kind: 'picker', pickers } : undefined;
}

/**
 * Adds `info` to the steps of a night order (see `nightOrder`). The order itself is not
 * changed; steps get a copy with `info` set.
 */
export function withNightInfo<T extends { character?: Character; info?: NightStepInfo }>(
	steps: readonly T[],
	game: Game,
	characters: CharacterLookup
): T[] {
	return steps.map((step) => {
		if (!step.character) return step;
		const info = nightStepInfo(game, step.character, characters);
		return info ? { ...step, info } : step;
	});
}
