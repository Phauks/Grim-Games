/**
 * Night information worked out from the grimoire and today's day log, so the Storyteller
 * does not have to count or remember it:
 * - answers for characters whose information depends on the day (Town Crier, Flowergirl,
 *   Undertaker, Juggler), on who is dead (Oracle) or on abilities that went wrong
 *   (Mathematician);
 * - an info picker for the first-night information characters (Washerwoman, Librarian,
 *   Investigator, Chef, Empath, Fortune Teller, Steward, Noble, Clockmaker): the truthful
 *   options;
 * - death checks for characters whose own ability kills (`night-deaths.ts`).
 *
 * Everything here is a suggestion (04-architecture.md §4: assist, never rule):
 * - `unreliable` says the waking player's ability does not work (`abilityState`: drunk,
 *   poisoned, or no ability), with every source in `impairments`, so the Storyteller may
 *   give any answer; the true answer is still worked out and shown;
 * - `mustBeFalse` says a Vortox is in play, so a Townsfolk's information must be false
 *   (https://wiki.bloodontheclocktower.com/Vortox);
 * - `misregister` lists players who might register as something else (Spy, Recluse, the
 *   Faux Paw player) and whose registration could change this information (Trevor,
 *   2026-10-17: a Recluse who isn't the Empath's neighbour is not offered); answers and
 *   pickers include every answer their registration allows, marked with the players it
 *   relies on;
 * - `why` is the logic behind a suggestion (Trevor, 2026-10-17: "show the logic"): the
 *   players the answer is worked out from, as facts (character, alignment, type), and what
 *   each relevant misregistration would change it to. Data only; the UI draws badges.
 * - `shown` is what the Storyteller recorded as shown (`RecordNightInfo`): their override;
 * - `abnormalCauses` / `answerCauses` say why a recorded answer worked abnormally, for the
 *   Mathematician.
 *
 * The answers read the *current* day log. The Storyteller clears it by hand with "New
 * day"; opening the night order never does (Trevor, 2026-10-15).
 */
import type { Alignment, Character, CharacterId, CharacterType } from '#lib/core/data/types.ts';
import { scriptCharacterIds, type CharacterLookup } from '#lib/core/model/characters.ts';
import {
	aliveNeighbours,
	getSeat,
	registersAsDead,
	trueCharacter,
	typeOf
} from '#lib/core/model/selectors.ts';
import type {
	AbnormalCause,
	DayEntry,
	DayEntryId,
	Game,
	Reminder,
	SeatId
} from '#lib/core/model/types.ts';
import {
	abilityState,
	registrations,
	registrationWorlds,
	type AbilityState,
	type Impairment,
	type ImpairmentReason,
	type Registration,
	type RegistrationWorld
} from './ability.ts';
import { withTravellerAlignmentStep } from './traveller-alignment.ts';
import { withGainedSteps } from './gained-abilities.ts';
import { causesOf, deathCheck, type DeathCheck } from './night-deaths.ts';
import type { Night, NightStep } from './night-order.ts';

const W = 'https://wiki.bloodontheclocktower.com/';

/**
 * Characters that might register as another character type or alignment, so a truthful
 * answer about them is the Storyteller's choice (`registrations` has the full rule).
 * https://wiki.bloodontheclocktower.com/Spy, https://wiki.bloodontheclocktower.com/Recluse
 */
export const MAY_MISREGISTER: Readonly<Record<CharacterId, string>> = {
	spy: `${W}Spy`,
	recluse: `${W}Recluse`
};

export interface Reliability {
	/** The waking player's ability does not work (the first reason): any answer is allowed. */
	unreliable?: ImpairmentReason;
	/** Every reason the waking player's ability does not work, with its source. */
	impairments: Impairment[];
	/** A Vortox is in play and the waking character is a Townsfolk: the answer must be false. */
	mustBeFalse?: boolean;
	/** The Vortox's seat, when `mustBeFalse`. */
	vortox?: SeatId;
	/**
	 * Players who might register falsely (Spy, Recluse, the Faux Paw player) where that could
	 * change this information.
	 */
	misregister: SeatId[];
	/** How each of them may register. */
	registrations: Registration[];
	/** The latest info the Storyteller recorded for this player and character today. */
	shown?: { entryId: DayEntryId; text: string };
}

/** One player an answer is worked out from, as the default registration sees them. */
export interface WhyFact {
	seatId: SeatId;
	/** The true character. */
	characterId?: CharacterId;
	alignment?: Alignment;
	type?: CharacterType;
	dead?: boolean;
	/** The Fortune Teller's red herring. */
	redHerring?: boolean;
	/** The Juggler's guess for this player, and whether it is right. */
	guess?: { characterId: CharacterId; correct: boolean };
}

/** What the information becomes if one player registers as something else. */
export interface WhyAlternative {
	seatId: SeatId;
	/** The character whose ability lets them misregister (Recluse, Spy, Lycanthrope). */
	source: CharacterId;
	/** Each other way they may register, and the answer it gives (when it is one value). */
	as: { alignment?: Alignment; type?: CharacterType; value?: AnswerValue }[];
}

export interface Why {
	facts: WhyFact[];
	/** One per relevant player in `misregister`. */
	alternatives: WhyAlternative[];
}

/** An answer's value, worked out from the grimoire. */
export type AnswerValue =
	| { kind: 'yes-no'; value: boolean }
	| { kind: 'character'; value: CharacterId }
	| { kind: 'number'; value: number }
	/** Nothing to give yet: `reason` in our words ("Nobody died by execution today"). */
	| { kind: 'none'; reason: string };

/** One ability that worked abnormally since dawn, for the Mathematician. */
export interface AbnormalUse {
	seatId: SeatId;
	characterId: CharacterId;
	causes: AbnormalCause[];
	/** The day-log entries that recorded it. */
	entryIds: DayEntryId[];
}

export type NightAnswer = AnswerValue &
	Reliability & {
		characterId: CharacterId;
		/** The waking player. */
		seatId: SeatId;
		/** The players behind the answer (who nominated, who was executed, correct guesses). */
		because: SeatId[];
		/**
		 * Every answer the Storyteller may give truthfully when players may register as
		 * something else, the true answer first. Only set when there is more than one.
		 */
		possible?: AnswerValue[];
		/** The Mathematician: which abilities worked abnormally since dawn. */
		abnormal?: AbnormalUse[];
		why: Why;
		wiki: string;
	};

function seatsWith(game: Game, characters: CharacterLookup, id: CharacterId): SeatId[] {
	return game.seating.filter((s) => trueCharacter(game, s, characters) === id);
}

/**
 * Drunk, poisoned or no ability (`abilityState`), Vortox, misregistration and recorded
 * info for a waking player.
 */
export function reliability(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup
): Reliability {
	const out: Reliability = { misregister: [], registrations: [], impairments: [] };
	const seat = getSeat(game, seatId);
	if (!seat) return out;
	out.impairments = abilityState(game, seatId, characters).impairments;
	if (out.impairments.length > 0) out.unreliable = out.impairments[0].reason;
	const vortox = seatsWith(game, characters, 'vortox').find(
		(s) => abilityState(game, s, characters).works
	);
	if (characters.get(characterId)?.type === 'townsfolk' && vortox !== undefined) {
		out.mustBeFalse = true;
		out.vortox = vortox;
	}
	out.registrations = otherRegistrations(game, seatId, characters);
	out.misregister = out.registrations.map((r) => r.seatId);
	const shown = game.today.entries.findLast(
		(e): e is Extract<DayEntry, { kind: 'info' }> =>
			e.kind === 'info' && e.seatId === seatId && e.characterId === characterId
	);
	if (shown) out.shown = { entryId: shown.entryId, text: shown.text };
	return out;
}

/** Registrations of everyone but the waking player: info is about the others. */
function otherRegistrations(game: Game, seatId: SeatId, characters: CharacterLookup) {
	return registrations(game, characters).filter((r) => r.seatId !== seatId);
}

function fact(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup,
	world?: RegistrationWorld
): WhyFact {
	const characterId = trueCharacter(game, seatId, characters);
	const alignment = world ? world.alignment(seatId) : undefined;
	const type = world ? world.type(seatId) : typeOf(game, seatId, characters);
	return {
		seatId,
		...(characterId ? { characterId } : {}),
		...(alignment ? { alignment } : {}),
		...(type ? { type } : {}),
		...(registersAsDead(game, seatId) ? { dead: true } : {})
	};
}

/** How a world sees every seat but one: worlds that agree here differ only in that seat. */
function worldKey(game: Game, w: RegistrationWorld, except: SeatId): string {
	return game.seating
		.filter((s) => s !== except)
		.map((s) => `${w.alignment(s) ?? ''}/${w.type(s) ?? ''}`)
		.join(',');
}

/**
 * Of the players who may misregister, those whose registration can change the result:
 * two worlds that differ only in how they register give different results.
 */
function relevantSeats(
	game: Game,
	regs: readonly Registration[],
	worlds: readonly RegistrationWorld[],
	result: (w: RegistrationWorld) => string
): SeatId[] {
	const results = worlds.map(result);
	return regs
		.filter((r) => {
			const seen = new Map<string, string>();
			return worlds.some((w, i) => {
				const key = worldKey(game, w, r.seatId);
				const before = seen.get(key);
				if (before === undefined) seen.set(key, results[i]);
				return before !== undefined && before !== results[i];
			});
		})
		.map((r) => r.seatId);
}

/**
 * For each relevant player, what the result is when only they register otherwise: worlds
 * that agree with the default world on everyone else.
 */
function alternatives(
	game: Game,
	regs: readonly Registration[],
	relevant: readonly SeatId[],
	worlds: readonly RegistrationWorld[],
	value?: (w: RegistrationWorld) => AnswerValue | undefined
): WhyAlternative[] {
	const [base] = worlds;
	if (!base) return [];
	return regs
		.filter((r) => relevant.includes(r.seatId))
		.map((r) => {
			const baseKey = worldKey(game, base, r.seatId);
			const as: WhyAlternative['as'] = [];
			const seen = new Set<string>();
			for (const w of worlds.slice(1)) {
				if (worldKey(game, w, r.seatId) !== baseKey) continue;
				const alignment = w.alignment(r.seatId);
				const type = w.type(r.seatId);
				const key = `${alignment}/${type}`;
				if (key === `${base.alignment(r.seatId)}/${base.type(r.seatId)}` || seen.has(key)) {
					continue;
				}
				seen.add(key);
				const v = value?.(w);
				as.push({
					...(alignment ? { alignment } : {}),
					...(type ? { type } : {}),
					...(v ? { value: v } : {})
				});
			}
			return { seatId: r.seatId, source: r.source.characterId, as };
		});
}

/** Keeps only the registrations of `seats` (all when undefined). */
function onlyRelevant(r: Reliability, seats: readonly SeatId[] | undefined): Reliability {
	if (!seats) return r;
	const registrations = r.registrations.filter((x) => seats.includes(x.seatId));
	return { ...r, registrations, misregister: registrations.map((x) => x.seatId) };
}

/** Answers worked out across registration worlds: relevance and alternatives from them. */
function byWorld(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup,
	valueIn: (w: RegistrationWorld) => AnswerValue
) {
	const regs = otherRegistrations(game, seatId, characters);
	const worlds = registrationWorlds(game, characters, regs);
	const values = worlds.map(valueIn);
	const relevant = relevantSeats(game, regs, worlds, (w) => JSON.stringify(valueIn(w)));
	return {
		worlds,
		possible: possibleValues(values),
		relevant,
		alternatives: alternatives(game, regs, relevant, worlds, valueIn)
	};
}

function answer(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup,
	value: AnswerValue,
	because: SeatId[],
	extra: Pick<NightAnswer, 'possible' | 'abnormal'> & {
		/** Players whose registration matters; every one who may misregister when unset. */
		relevant?: readonly SeatId[];
		facts?: WhyFact[];
		alternatives?: WhyAlternative[];
	} = {}
): NightAnswer {
	return {
		...value,
		...onlyRelevant(reliability(game, seatId, characterId, characters), extra.relevant),
		characterId,
		seatId,
		because,
		...(extra.possible && extra.possible.length > 1 ? { possible: extra.possible } : {}),
		...(extra.abnormal ? { abnormal: extra.abnormal } : {}),
		why: { facts: extra.facts ?? [], alternatives: extra.alternatives ?? [] },
		wiki: ANSWER_WIKI[characterId] ?? W
	};
}

const ANSWER_WIKI: Readonly<Record<CharacterId, string>> = {
	towncrier: `${W}Town_Crier`,
	flowergirl: `${W}Flowergirl`,
	godfather: `${W}Godfather`,
	undertaker: `${W}Undertaker`,
	juggler: `${W}Juggler`,
	oracle: `${W}Oracle`,
	mathematician: `${W}Mathematician`
};

/** The true value first, then every other distinct value (numbers ascending). */
function possibleValues(values: readonly AnswerValue[]): AnswerValue[] {
	const key = (v: AnswerValue) => JSON.stringify(v);
	const out = values.filter((v, i, all) => all.findIndex((w) => key(w) === key(v)) === i);
	const [truth, ...rest] = out;
	rest.sort((a, b) => (a.kind === 'number' && b.kind === 'number' ? a.value - b.value : 0));
	return truth ? [truth, ...rest] : [];
}

function entriesOf<K extends DayEntry['kind']>(game: Game, kind: K) {
	return game.today.entries.filter((e): e is Extract<DayEntry, { kind: K }> => e.kind === kind);
}

/**
 * Town Crier: whether a Minion nominated today, and who
 * (https://wiki.bloodontheclocktower.com/Town_Crier). Uses each nominator's true character;
 * a Recluse who nominated might register as a Minion and a Spy might not (`possible`).
 */
export function townCrierAnswer(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): NightAnswer {
	const nominators = entriesOf(game, 'nomination')
		.map((e) => e.nominator)
		.filter((s, i, all) => all.indexOf(s) === i);
	const w = byWorld(game, seatId, characters, (world) => ({
		kind: 'yes-no',
		value: nominators.some((s) => world.type(s) === 'minion')
	}));
	const [base] = w.worlds;
	const minions = nominators.filter((s) => base.type(s) === 'minion');
	return answer(
		game,
		seatId,
		'towncrier',
		characters,
		{ kind: 'yes-no', value: minions.length > 0 },
		minions,
		{
			possible: w.possible,
			relevant: w.relevant,
			facts: nominators.map((s) => fact(game, s, characters, base)),
			alternatives: w.alternatives
		}
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
		voted ? demons : [],
		// Votes are not tracked, so anyone who may register as the Demon stays relevant.
		{ facts: demons.map((s) => fact(game, s, characters)) }
	);
}

/**
 * Undertaker: the character of the player who died by execution today
 * (https://wiki.bloodontheclocktower.com/Undertaker). The grimoire's true character: the
 * Drunk shows as the Drunk. Nobody died by execution: the Undertaker learns nothing.
 *
 * Today's execution comes from the day log; when the log has none (the Storyteller ran the
 * day without the day screen), from the dead player carrying the Undertaker's "Died Today"
 * reminder, which is how the Storyteller marks it on the board.
 */
export function undertakerAnswer(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): NightAnswer {
	const executed =
		entriesOf(game, 'execution').findLast((e) => e.died && getSeat(game, e.seatId)?.dead) ??
		marked(game, 'undertaker', 'Died Today');
	const id = executed && trueCharacter(game, executed.seatId, characters);
	return answer(
		game,
		seatId,
		'undertaker',
		characters,
		id === undefined
			? { kind: 'none', reason: 'Nobody died by execution today' }
			: { kind: 'character', value: id },
		executed ? [executed.seatId] : [],
		{
			relevant: executed ? [executed.seatId] : [],
			facts: executed ? [fact(game, executed.seatId, characters)] : []
		}
	);
}

/**
 * What happened today that the game alone does not hold, from the log (`diedToday` in the
 * engine): who died since the most recent New day.
 */
export interface NightToday {
	died: readonly SeatId[];
}

/**
 * Godfather: whether an Outsider died today, so the Godfather wakes tonight to kill
 * (https://wiki.bloodontheclocktower.com/Godfather). An Outsider is a player whose true
 * character is an Outsider (a Drunk counts, as does a Recluse). Deaths come from today's
 * deaths in the log (`today`), today's executions and exiles, and the Godfather's "Died
 * Today" reminder on a dead Outsider, which is how the Storyteller marks it on the board.
 */
export function godfatherAnswer(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup,
	today?: NightToday
): NightAnswer {
	const marked = game.seating.filter((s) =>
		game.seats[s].reminders.some((r) => r.characterId === 'godfather' && r.label === 'Died Today')
	);
	const died = new Set([
		...(today?.died ?? []),
		...[...entriesOf(game, 'execution'), ...entriesOf(game, 'exile')]
			.filter((e) => e.died)
			.map((e) => e.seatId),
		...marked
	]);
	const outsiders = game.seating.filter(
		(s) => died.has(s) && getSeat(game, s)?.dead && typeOf(game, s, characters) === 'outsider'
	);
	return answer(
		game,
		seatId,
		'godfather',
		characters,
		outsiders.length === 0
			? { kind: 'none', reason: 'No Outsider died today' }
			: { kind: 'yes-no', value: true },
		outsiders,
		{ relevant: outsiders, facts: outsiders.map((s) => fact(game, s, characters)) }
	);
}

/** The dead player carrying a character's reminder, as `{ seatId }`. */
function marked(
	game: Game,
	characterId: CharacterId,
	label: string
): { seatId: SeatId } | undefined {
	const seatId = game.seating.find(
		(s) =>
			getSeat(game, s)?.dead &&
			game.seats[s].reminders.some((r) => r.characterId === characterId && r.label === label)
	);
	return seatId ? { seatId } : undefined;
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
		correct.map(([s]) => s),
		{
			relevant: [...latest.keys()],
			facts: [...latest].map(([s, id]) => ({
				...fact(game, s, characters),
				guess: { characterId: id, correct: trueCharacter(game, s, characters) === id }
			}))
		}
	);
}

/**
 * Oracle: how many dead players are evil (https://wiki.bloodontheclocktower.com/Oracle).
 * Dead as abilities see it, and the alignment the rules use (overrides win). A dead Recluse
 * might register as evil and a dead Spy as good: both work even if dead (`possible`).
 */
export function oracleAnswer(game: Game, seatId: SeatId, characters: CharacterLookup): NightAnswer {
	const evilIn = (w: RegistrationWorld) =>
		game.seating.filter((s) => registersAsDead(game, s) && w.alignment(s) === 'evil');
	const w = byWorld(game, seatId, characters, (world) => ({
		kind: 'number',
		value: evilIn(world).length
	}));
	const [base] = w.worlds;
	const evilDead = evilIn(base);
	return answer(
		game,
		seatId,
		'oracle',
		characters,
		{ kind: 'number', value: evilDead.length },
		evilDead,
		{
			possible: w.possible,
			relevant: w.relevant,
			facts: game.seating
				.filter((s) => registersAsDead(game, s))
				.map((s) => fact(game, s, characters, base)),
			alternatives: w.alternatives
		}
	);
}

/**
 * Every ability that worked abnormally since dawn because of another character, from the
 * night info the Storyteller recorded (its `abnormal` causes), one per player and
 * character. The Mathematician's own ability does not count, nor does a cause that is the
 * ability itself (https://wiki.bloodontheclocktower.com/Mathematician). The day log runs
 * from the last "New day", which the Storyteller presses at dawn.
 */
export function abnormalSinceDawn(game: Game): AbnormalUse[] {
	const out: AbnormalUse[] = [];
	const key = (c: AbnormalCause) => `${c.reason}:${c.characterId ?? ''}:${c.seatId ?? ''}`;
	for (const e of entriesOf(game, 'info')) {
		if (e.characterId === 'mathematician') continue;
		const causes = (e.abnormal ?? []).filter(
			(c) => !(c.characterId === e.characterId && c.seatId === e.seatId)
		);
		if (causes.length === 0) continue;
		const use = out.find((u) => u.seatId === e.seatId && u.characterId === e.characterId);
		if (!use) {
			out.push({
				seatId: e.seatId,
				characterId: e.characterId,
				causes: [...causes],
				entryIds: [e.entryId]
			});
			continue;
		}
		use.entryIds.push(e.entryId);
		for (const c of causes) if (!use.causes.some((d) => key(d) === key(c))) use.causes.push(c);
	}
	return out;
}

/**
 * Mathematician: how many players' abilities worked abnormally since dawn because of
 * another character (https://wiki.bloodontheclocktower.com/Mathematician). Once the
 * Storyteller has put the Mathematician's "Abnormal" reminders on players, the answer is
 * how many players carry one (their call); until then it is counted from the info they
 * recorded as abnormal. `abnormal` lists the recorded uses either way, so they can check.
 */
export function mathematicianAnswer(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): NightAnswer {
	const abnormal = abnormalSinceDawn(game);
	const marked = game.seating.filter((s) =>
		game.seats[s].reminders.some((r) => r.characterId === 'mathematician' && r.label === 'Abnormal')
	);
	const recorded = abnormal.map((u) => u.seatId).filter((s, i, all) => all.indexOf(s) === i);
	const because = marked.length > 0 ? marked : recorded;
	return answer(
		game,
		seatId,
		'mathematician',
		characters,
		{ kind: 'number', value: marked.length > 0 ? marked.length : abnormal.length },
		because,
		// Registration only matters to the abilities it recorded as abnormal.
		{ abnormal, relevant: [], facts: because.map((s) => fact(game, s, characters)) }
	);
}

/** The characters with answers worked out here. */
export const NIGHT_ANSWERS: Readonly<
	Record<
		CharacterId,
		(game: Game, seatId: SeatId, characters: CharacterLookup, today?: NightToday) => NightAnswer
	>
> = {
	godfather: godfatherAnswer,
	towncrier: townCrierAnswer,
	flowergirl: flowergirlAnswer,
	undertaker: undertakerAnswer,
	juggler: jugglerAnswer,
	oracle: oracleAnswer,
	mathematician: mathematicianAnswer
};

/**
 * Why a recorded answer that is not the true one worked abnormally: the waking player's
 * impairments, else the Vortox, else the players who might register as something else.
 * For answers recorded as free text, where the app cannot compare the choice.
 */
export function answerCauses(a: Reliability & { because?: SeatId[] }): AbnormalCause[] {
	if (a.impairments.length > 0) return causesOf(a.impairments);
	if (a.mustBeFalse) {
		return [{ reason: 'vortox', characterId: 'vortox', ...(a.vortox ? { seatId: a.vortox } : {}) }];
	}
	return a.registrations.map((r) => ({
		reason: 'registration',
		characterId: r.source.characterId,
		seatId: r.seatId
	}));
}

// ── Info picker ─────────────────────────────────────────────────────────────

/**
 * - `pair-character`: two players and a character, one of whom is that character
 *   (Washerwoman, Librarian, Investigator);
 * - `number`: a number (Chef, Empath, Clockmaker);
 * - `players`: players to point at (Steward: 1 good player; Noble: 3, exactly 1 evil);
 * - `yes-no`: the player chose 2 players; yes or no (Fortune Teller).
 */
export type PickerKind = 'pair-character' | 'number' | 'players' | 'yes-no';

/** One option the Storyteller could show. */
export interface InfoOption {
	seats: SeatId[];
	characterId?: CharacterId;
	/**
	 * For a player who registers as the shown type without being it (a Spy shown to the
	 * Washerwoman): any of these characters may be shown.
	 */
	characterIds?: CharacterId[];
	number?: number;
	yes?: boolean;
	/** "There are none in play" (a Librarian with no Outsiders learns 0). */
	none?: boolean;
	/**
	 * Set when the option is only true if these players register as something else (a
	 * Recluse as evil): allowed, the Storyteller's call, and abnormal for the Mathematician.
	 */
	registered?: SeatId[];
}

/** For a number picker: the true number and every number registration allows. */
export interface NumberRange {
	truth: number;
	/** Ascending, including `truth`. */
	possible: number[];
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
	/** The truthful options, from the grimoire, including ones that rely on registration. */
	options: InfoOption[];
	/** For `number`: the true number and the range registration allows. */
	range?: NumberRange;
	/** Every option is allowed, because the waking player's ability does not work. */
	anyAllowed: boolean;
	why: Why;
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
	clockmaker: { kind: 'number', seatCount: 0, reminders: {}, wiki: `${W}Clockmaker` },
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

/** The options that are true when players register as `world` says. */
function optionsIn(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	spec: PickerSpec,
	characters: CharacterLookup,
	world: RegistrationWorld
): InfoOption[] {
	const evil = (s: SeatId) => world.alignment(s) === 'evil';
	// Information is about the other players: the waking player is never one of them
	// (a rules question for Trevor; see the report).
	const others = game.seating.filter((s) => s !== seatId);
	switch (characterId) {
		case 'washerwoman':
		case 'librarian':
		case 'investigator': {
			// https://wiki.bloodontheclocktower.com/Washerwoman, /Librarian, /Investigator:
			// one of the two players is the character shown; the other is anyone else. A player
			// registering as that type without being it may be shown as any such character.
			const type = spec.characterType;
			const targets = others.filter((s) => world.type(s) === type);
			const ofType = scriptCharacterIds(game.script).filter(
				(id) => characters.get(id)?.type === type
			);
			const options = targets.flatMap((target) => {
				const shown: Pick<InfoOption, 'characterId' | 'characterIds'> =
					typeOf(game, target, characters) === type
						? { characterId: trueCharacter(game, target, characters)! }
						: { characterIds: ofType };
				return others
					.filter((s) => s !== target)
					.map((other): InfoOption => ({ seats: [target, other], ...shown }));
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
				if (evil(game.seating[i]) && evil(game.seating[(i + 1) % n])) pairs++;
			}
			return [{ seats: [], number: pairs }];
		}
		case 'empath': {
			// https://wiki.bloodontheclocktower.com/Empath: evil among the alive neighbours.
			const neighbours = aliveNeighbours(game, seatId);
			return [{ seats: [], number: neighbours.filter(evil).length }];
		}
		case 'clockmaker': {
			// https://wiki.bloodontheclocktower.com/Clockmaker: steps from the Demon to its
			// nearest Minion, either way round the circle.
			const n = game.seating.length;
			const at = (type: CharacterType) =>
				game.seating.flatMap((s, i) => (world.type(s) === type ? [i] : []));
			const demons = at('demon');
			const minions = at('minion');
			if (demons.length === 0 || minions.length === 0) return [];
			const steps = Math.min(
				...demons.flatMap((d) => minions.map((m) => Math.min(Math.abs(d - m), n - Math.abs(d - m))))
			);
			return [{ seats: [], number: steps }];
		}
		case 'fortuneteller': {
			// https://wiki.bloodontheclocktower.com/Fortune_Teller: yes when either chosen player
			// is the Demon or the red herring. The player may choose themselves.
			const flagged = (s: SeatId) =>
				world.type(s) === 'demon' ||
				(getSeat(game, s)?.reminders ?? []).some(
					(r) => r.characterId === 'fortuneteller' && r.label === 'Red Herring'
				);
			return choose(game.seating, 2).map((pair) => ({ seats: pair, yes: pair.some(flagged) }));
		}
		case 'steward':
			// https://wiki.bloodontheclocktower.com/Steward: one good player.
			return others.filter((s) => !evil(s)).map((s) => ({ seats: [s] }));
		case 'noble':
			// https://wiki.bloodontheclocktower.com/Noble: three players, exactly one evil.
			return choose(others, 3)
				.filter((trio) => trio.filter(evil).length === 1)
				.map((trio) => ({ seats: trio }));
		default:
			return [];
	}
}

const optionKey = (o: InfoOption) =>
	JSON.stringify([o.seats, o.characterId, o.characterIds, o.number, o.yes, o.none]);

/**
 * The truthful options in every way players may register: the default world's options
 * first, then those that are only true when someone misregisters, marked `registered`.
 */
function truthfulOptions(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	spec: PickerSpec,
	characters: CharacterLookup,
	regs: readonly Registration[]
): InfoOption[] {
	const [base, ...rest] = registrationWorlds(game, characters, regs);
	const out = optionsIn(game, seatId, characterId, spec, characters, base);
	const seen = new Set(out.map(optionKey));
	for (const world of rest) {
		for (const option of optionsIn(game, seatId, characterId, spec, characters, world)) {
			const key = optionKey(option);
			if (seen.has(key)) continue;
			seen.add(key);
			out.push({ ...option, registered: world.misregistered });
		}
	}
	return out;
}

/** The players a picker's options are worked out from, as the default world sees them. */
function pickerFacts(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	spec: PickerSpec,
	characters: CharacterLookup,
	world: RegistrationWorld
): WhyFact[] {
	const others = game.seating.filter((s) => s !== seatId);
	const f = (s: SeatId) => fact(game, s, characters, world);
	const evil = (s: SeatId) => world.alignment(s) === 'evil';
	switch (characterId) {
		case 'washerwoman':
		case 'librarian':
		case 'investigator':
			return others.filter((s) => world.type(s) === spec.characterType).map(f);
		case 'chef':
			return game.seating.filter(evil).map(f);
		case 'empath':
			return aliveNeighbours(game, seatId).map(f);
		case 'clockmaker':
			return game.seating
				.filter((s) => world.type(s) === 'demon' || world.type(s) === 'minion')
				.map(f);
		case 'fortuneteller':
			return game.seating.flatMap((s) => {
				const redHerring = (getSeat(game, s)?.reminders ?? []).some(
					(r) => r.characterId === 'fortuneteller' && r.label === 'Red Herring'
				);
				if (world.type(s) !== 'demon' && !redHerring) return [];
				return [{ ...f(s), ...(redHerring ? { redHerring: true } : {}) }];
			});
		case 'noble':
			return others.filter(evil).map(f);
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
	const all = reliability(game, seatId, characterId, characters);
	const options = truthfulOptions(game, seatId, characterId, spec, characters, all.registrations);
	const worlds = registrationWorlds(game, characters, all.registrations);
	const optionsOf = (w: RegistrationWorld) =>
		optionsIn(game, seatId, characterId, spec, characters, w);
	const relevant = relevantSeats(game, all.registrations, worlds, (w) =>
		JSON.stringify(optionsOf(w).map(optionKey).sort())
	);
	const r = onlyRelevant(all, relevant);
	// A number is one value; other pickers have many options, so no single alternative.
	const numberIn = (w: RegistrationWorld): AnswerValue | undefined => {
		const n = optionsOf(w)[0]?.number;
		return spec.kind === 'number' && n !== undefined ? { kind: 'number', value: n } : undefined;
	};
	const truth = options.find((o) => !o.registered && o.number !== undefined)?.number;
	const range: NumberRange | undefined =
		spec.kind === 'number' && truth !== undefined
			? {
					truth,
					possible: [...new Set(options.flatMap((o) => o.number ?? []))].sort((a, b) => a - b)
				}
			: undefined;
	return {
		...r,
		kind: spec.kind,
		characterId,
		seatId,
		seatCount: spec.seatCount,
		...(spec.characterType ? { characterType: spec.characterType } : {}),
		options,
		...(range ? { range } : {}),
		anyAllowed: r.unreliable !== undefined,
		why: {
			facts: pickerFacts(game, seatId, characterId, spec, characters, worlds[0]),
			alternatives: alternatives(game, all.registrations, relevant, worlds, numberIn)
		},
		reminders: spec.reminders,
		wiki: spec.wiki
	};
}

const sameSeats = (a: readonly SeatId[], b: readonly SeatId[]) =>
	a.length === b.length && a.every((s) => b.includes(s));

function matches(picker: InfoPicker, o: InfoOption, choice: InfoChoice): boolean {
	switch (picker.kind) {
		case 'pair-character':
			if (o.none) return choice.none === true;
			return (
				!choice.none &&
				choice.characterId !== undefined &&
				(o.characterId === choice.characterId ||
					(o.characterIds?.includes(choice.characterId) ?? false)) &&
				sameSeats(o.seats, choice.seats)
			);
		case 'number':
			return o.number === choice.number;
		case 'players':
			return sameSeats(o.seats, choice.seats);
		case 'yes-no':
			return sameSeats(o.seats, choice.seats) && o.yes === choice.yes;
	}
}

/** The option a choice matches, preferring one that needs no misregistration. */
export function matchingOption(picker: InfoPicker, choice: InfoChoice): InfoOption | undefined {
	const all = picker.options.filter((o) => matches(picker, o, choice));
	return all.find((o) => !o.registered) ?? all[0];
}

/** Whether a choice is true with everyone registering as they are. */
export function isTruthful(picker: InfoPicker, choice: InfoChoice): boolean {
	const o = matchingOption(picker, choice);
	return o !== undefined && !o.registered;
}

/**
 * Whether the choice is allowed: truthful (counting what registration allows), or anything
 * when the waking player's ability does not work. With a Vortox in play a Townsfolk's info
 * must be false instead.
 */
export function isAllowed(picker: InfoPicker, choice: InfoChoice): boolean {
	if (picker.anyAllowed) return true;
	if (picker.mustBeFalse) return !isTruthful(picker, choice);
	return matchingOption(picker, choice) !== undefined;
}

/**
 * Why a choice worked abnormally, for the Mathematician
 * (https://wiki.bloodontheclocktower.com/Mathematician): nothing when it is true; the
 * players it relies on registering as something else (a Recluse shown as evil to the Chef
 * counts); else the waking player's impairments; else the Vortox. A false choice with no
 * cause is not abnormal, just not allowed.
 */
export function abnormalCauses(picker: InfoPicker, choice: InfoChoice): AbnormalCause[] {
	const o = matchingOption(picker, choice);
	if (o && !o.registered) return [];
	if (o?.registered) {
		return picker.registrations
			.filter((r) => o.registered!.includes(r.seatId))
			.map((r) => ({
				reason: 'registration',
				characterId: r.source.characterId,
				seatId: r.seatId
			}));
	}
	if (picker.impairments.length > 0) return causesOf(picker.impairments);
	if (picker.mustBeFalse) {
		return [
			{
				reason: 'vortox',
				characterId: 'vortox',
				...(picker.vortox ? { seatId: picker.vortox } : {})
			}
		];
	}
	return [];
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

/** Why a piece of information is valid to show. */
export type ValidReason =
	/** True as the grimoire stands. */
	| 'true'
	/** True if the `registered` players register as something else (Spy, Recluse). */
	| 'registers'
	/** Any information is allowed: the waking player is drunk, poisoned or has no ability. */
	| 'unreliable'
	/** The Vortox: only false information is allowed. */
	| 'vortox';

/**
 * One piece of information the Storyteller may show. Every valid one is listed; the app
 * never picks one for them (Trevor, 2026-10-18: "don't give a single suggestion, just show
 * all valid information").
 */
export interface ValidInfo {
	reason: ValidReason;
	/** For `registers`: the players who would have to register otherwise. */
	registered?: SeatId[];
	/** A number (Chef, Empath, Clockmaker; the Librarian's 0). */
	number?: number;
	yes?: boolean;
	none?: boolean;
	/** For a pair: the character, or any of these characters, that may be shown. */
	characterIds?: CharacterId[];
	/** For a pair: the player who is that character. */
	target?: SeatId;
	/**
	 * The players: for a pair, every player who may be shown beside `target`; otherwise the
	 * players the information is about (Fortune Teller's pair, Steward's or Noble's choice).
	 */
	seats: SeatId[];
	/** Any other choice is valid too, for `unreliable` or `vortox` (too many to list). */
	anyOther?: boolean;
}

/** The highest number a number picker could show, for listing every valid one. */
function highestNumber(game: Game, characterId: CharacterId): number {
	const n = game.seating.length;
	if (characterId === 'empath') return 2;
	if (characterId === 'clockmaker') return Math.max(1, Math.floor(n / 2));
	return n;
}

/**
 * Every valid piece of information for a picker, grouped for display: the true ones first,
 * then those true only by registration, then what droisoning or the Vortox allows. Pairs
 * are grouped by the shown character and its player, listing every possible second player.
 */
export function validInformation(game: Game, picker: InfoPicker): ValidInfo[] {
	const reasonOf = (o: InfoOption): Pick<ValidInfo, 'reason' | 'registered'> =>
		o.registered ? { reason: 'registers', registered: o.registered } : { reason: 'true' };
	// Under the Vortox the truthful options are exactly the ones not allowed.
	const truthful: ValidInfo[] = picker.mustBeFalse && !picker.unreliable ? [] : groupOptions();
	const extra: ValidInfo[] = [];
	const loose: ValidReason | undefined = picker.unreliable
		? 'unreliable'
		: picker.mustBeFalse
			? 'vortox'
			: undefined;
	if (loose) {
		if (picker.kind === 'number') {
			const taken = new Set(truthful.map((v) => v.number));
			const notTrue = new Set(picker.options.map((o) => o.number));
			for (
				let n = picker.characterId === 'clockmaker' ? 1 : 0;
				n <= highestNumber(game, picker.characterId);
				n++
			) {
				if (taken.has(n)) continue;
				if (loose === 'vortox' && notTrue.has(n)) continue;
				extra.push({ reason: loose, number: n, seats: [] });
			}
		} else {
			extra.push({ reason: loose, seats: [], anyOther: true });
		}
	}
	return [...truthful, ...extra];

	function groupOptions(): ValidInfo[] {
		if (picker.kind !== 'pair-character') {
			return picker.options.map((o) => ({
				...reasonOf(o),
				seats: [...o.seats],
				...(o.number !== undefined ? { number: o.number } : {}),
				...(o.yes !== undefined ? { yes: o.yes } : {}),
				...(o.none ? { none: true } : {})
			}));
		}
		const groups = new Map<string, ValidInfo>();
		for (const o of picker.options) {
			if (o.none) {
				groups.set('none', { ...reasonOf(o), none: true, number: 0, seats: [] });
				continue;
			}
			const [target, other] = o.seats;
			const ids = o.characterId ? [o.characterId] : (o.characterIds ?? []);
			const key = JSON.stringify([target, ids, o.registered ?? []]);
			const group =
				groups.get(key) ??
				groups.set(key, { ...reasonOf(o), characterIds: ids, target, seats: [] }).get(key)!;
			if (other && !group.seats.includes(other)) group.seats.push(other);
		}
		return [...groups.values()];
	}
}

/** The `RecordNightInfo` fields for a choice: text in our words, tokens to place, and causes. */
export function infoRecord(
	picker: InfoPicker,
	choice: InfoChoice,
	name: { seat: (seatId: SeatId) => string; character: (id: CharacterId) => string },
	game: Game,
	characters: CharacterLookup
): {
	text: string;
	reminders: { seatId: SeatId; reminder: Reminder }[];
	abnormal?: AbnormalCause[];
} {
	const abnormal = abnormalCauses(picker, choice);
	const out = (text: string, reminders: { seatId: SeatId; reminder: Reminder }[]) =>
		abnormal.length > 0 ? { text, reminders, abnormal } : { text, reminders };
	const token = (seatId: SeatId, label: string) => ({
		seatId,
		reminder: { characterId: picker.characterId, label }
	});
	const players = choice.seats.map(name.seat);
	switch (picker.kind) {
		case 'pair-character': {
			if (choice.none) return out(`Shown 0 (none in play)`, []);
			const id = choice.characterId ?? '';
			// The token goes on the player who really is the character, or who registers as it.
			const option = matchingOption(picker, choice);
			const target =
				choice.seats.find((s) => trueCharacter(game, s, characters) === id) ??
				option?.seats[0] ??
				choice.seats[0];
			const other = choice.seats.find((s) => s !== target);
			const reminders = [];
			if (target && picker.reminders.target) reminders.push(token(target, picker.reminders.target));
			if (other && picker.reminders.other) reminders.push(token(other, picker.reminders.other));
			return out(`Shown ${players.join(' and ')}: one is the ${name.character(id)}`, reminders);
		}
		case 'number':
			return out(`Shown ${choice.number ?? 0}`, []);
		case 'players':
			return out(
				`Shown ${players.join(', ')}`,
				picker.reminders.each ? choice.seats.map((s) => token(s, picker.reminders.each!)) : []
			);
		case 'yes-no':
			return out(`Chose ${players.join(' and ')}: shown ${choice.yes ? 'yes' : 'no'}`, []);
	}
}

// ── Night order steps ───────────────────────────────────────────────────────

/** Data a night step carries: worked-out answers, pickers or death checks, one per waking player. */
export type NightStepInfo =
	| { kind: 'answer'; answers: NightAnswer[] }
	| { kind: 'picker'; pickers: InfoPicker[] }
	| { kind: 'death'; checks: DeathCheck[] };

/**
 * The night info for one character step: one entry per player whose token is that
 * character (a Drunk who thinks they are the Washerwoman wakes as the Washerwoman, and the
 * answer is marked unreliable), or for `seats` when given (a Pixie with that ability).
 * Undefined when nothing is worked out for the character.
 */
export function nightStepInfo(
	game: Game,
	character: Pick<Character, 'id'>,
	characters: CharacterLookup,
	seats: readonly SeatId[] = game.seating.filter((s) => game.seats[s].characterId === character.id),
	today?: NightToday
): NightStepInfo | undefined {
	if (seats.length === 0) return undefined;
	const answerFor = Object.hasOwn(NIGHT_ANSWERS, character.id)
		? NIGHT_ANSWERS[character.id]
		: undefined;
	if (answerFor) {
		return { kind: 'answer', answers: seats.map((s) => answerFor(game, s, characters, today)) };
	}
	const checks = seats.flatMap((s) => deathCheck(game, s, character.id, characters) ?? []);
	if (checks.length > 0) return { kind: 'death', checks };
	const pickers = seats.flatMap((s) => infoPicker(game, s, character.id, characters) ?? []);
	return pickers.length > 0 ? { kind: 'picker', pickers } : undefined;
}

/**
 * Adds what the game says to the steps of a night order (see `nightOrder`): `info`
 * (answers, pickers, death checks), `impaired` (waking players whose ability does not
 * work, such as a Minion the Preacher chose), and, given `night`, a step for each gained
 * ability (the Pixie's, `withGainedSteps`) and a first step for Travellers without an
 * alignment (`withTravellerAlignmentStep`). Steps get a copy; the order is not otherwise
 * changed.
 */
export function withNightInfo<T extends NightStep>(
	steps: readonly T[],
	game: Game,
	characters: CharacterLookup,
	night?: Night,
	today?: NightToday
): (T | NightStep)[] {
	const all = withTravellerAlignmentStep(
		night ? withGainedSteps(steps, game, characters, night) : steps,
		game,
		characters
	);
	return all.map((step) => {
		// A wake step for a changed character shows the player; it works out nothing.
		if (!step.character || step.changed) return step;
		const gained = step.gained;
		const seats = gained
			? [gained.seatId]
			: game.seating.filter((s) => game.seats[s].characterId === step.character!.id);
		const as = gained ? (characters.get(gained.characterId) ?? step.character) : step.character;
		const found = nightStepInfo(game, as, characters, seats, today);
		// Ability deaths happen on other nights (the Grandmother wakes on the first night to learn).
		const info = found?.kind === 'death' && night === 'first' ? undefined : found;
		const impaired = seats
			.map((s): AbilityState => abilityState(game, s, characters))
			.filter((a) => a.impairments.length > 0);
		return {
			...step,
			...(info ? { info } : {}),
			...(impaired.length > 0 ? { impaired } : {})
		};
	});
}
