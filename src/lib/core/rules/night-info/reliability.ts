/**
 * Night information: how reliable the waking player's information is (impairments,
 * the Vortox, players who may register as something else) and the shared answer shape.
 * Part of `night-info.ts`, which documents the whole and re-exports this file.
 */
import type { Alignment, CharacterId, CharacterType } from '#lib/core/data/types.ts';
import { wikiUrl } from '#lib/core/data/wiki.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { getSeat, registersAsDead, trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { AbnormalCause, DayEntry, DayEntryId, Game, SeatId } from '#lib/core/model/types.ts';
import {
	type Impairment,
	type ImpairmentReason,
	type Registration,
	type RegistrationWorld,
	abilityState,
	registrationWorlds,
	registrations
} from '../ability.ts';

const W = 'https://wiki.bloodontheclocktower.com/';

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
	/**
	 * Characters, possibly none (the Godfather's Outsiders in play). `more`: `count` players
	 * register as `type` without being one (a Spy as an Outsider), so that many more
	 * characters of the type, the Storyteller's pick, are shown too.
	 */
	| {
			kind: 'characters';
			value: CharacterId[];
			more?: { count: number; type: CharacterType };
	  }
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

export function fact(
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
export function relevantSeats(
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
 * that agree with the default world on everyone else. Only what the result checks is kept
 * (Trevor, 2026-10-26): the Empath counts evil players, so a Recluse is good or evil, not
 * each alignment and character type in turn.
 */
export function alternatives(
	game: Game,
	regs: readonly Registration[],
	relevant: readonly SeatId[],
	worlds: readonly RegistrationWorld[],
	value?: (w: RegistrationWorld) => AnswerValue | undefined,
	result: (w: RegistrationWorld) => string = (w) => JSON.stringify(value?.(w))
): WhyAlternative[] {
	const [base] = worlds;
	if (!base) return [];
	return regs
		.filter((r) => relevant.includes(r.seatId))
		.map((r) => {
			const baseKey = worldKey(game, base, r.seatId);
			const own = worlds.filter((w) => worldKey(game, w, r.seatId) === baseKey);
			const ways = own.map((w) => ({
				w,
				alignment: w.alignment(r.seatId),
				type: w.type(r.seatId),
				result: result(w)
			}));
			// A part matters when changing only it changes the result.
			const differs = (same: 'alignment' | 'type', other: 'alignment' | 'type') =>
				ways.some((a) =>
					ways.some((b) => a[same] === b[same] && a[other] !== b[other] && a.result !== b.result)
				);
			let alignmentMatters = differs('type', 'alignment');
			let typeMatters = differs('alignment', 'type');
			if (!alignmentMatters && !typeMatters) alignmentMatters = typeMatters = true;
			const keyOf = (way: (typeof ways)[number]) =>
				`${alignmentMatters ? way.alignment : ''}/${typeMatters ? way.type : ''}`;
			const as: WhyAlternative['as'] = [];
			const seen = new Set<string>([keyOf(ways[0])]);
			for (const way of ways.slice(1)) {
				const key = keyOf(way);
				if (seen.has(key)) continue;
				seen.add(key);
				const v = value?.(way.w);
				as.push({
					...(alignmentMatters && way.alignment ? { alignment: way.alignment } : {}),
					...(typeMatters && way.type ? { type: way.type } : {}),
					...(v ? { value: v } : {})
				});
			}
			return { seatId: r.seatId, source: r.source.characterId, as };
		});
}

/** Keeps only the registrations of `seats` (all when undefined). */
export function onlyRelevant(r: Reliability, seats: readonly SeatId[] | undefined): Reliability {
	if (!seats) return r;
	const registrations = r.registrations.filter((x) => seats.includes(x.seatId));
	return { ...r, registrations, misregister: registrations.map((x) => x.seatId) };
}

/** Answers worked out across registration worlds: relevance and alternatives from them. */
export function byWorld(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup,
	valueIn: (w: RegistrationWorld) => AnswerValue
) {
	const regs = otherRegistrations(game, seatId, characters);
	const worlds = registrationWorlds(game, characters, regs);
	const values = worlds.map(valueIn);
	const result = (w: RegistrationWorld) => JSON.stringify(valueIn(w));
	const relevant = relevantSeats(game, regs, worlds, result);
	return {
		worlds,
		possible: possibleValues(values),
		relevant,
		alternatives: alternatives(game, regs, relevant, worlds, valueIn, result)
	};
}

export function answer(
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
		wiki: wikiOf(characterId, characters)
	};
}

/** The character's wiki page, or the wiki's front page for a homebrew character. */
export function wikiOf(characterId: CharacterId, characters: CharacterLookup): string {
	const character = characters.get(characterId);
	return (character && wikiUrl(character)) ?? W;
}

/** The true value first, then every other distinct value (numbers ascending). */
function possibleValues(values: readonly AnswerValue[]): AnswerValue[] {
	const key = (v: AnswerValue) => JSON.stringify(v);
	const out = values.filter((v, i, all) => all.findIndex((w) => key(w) === key(v)) === i);
	const [truth, ...rest] = out;
	rest.sort((a, b) => (a.kind === 'number' && b.kind === 'number' ? a.value - b.value : 0));
	return truth ? [truth, ...rest] : [];
}
