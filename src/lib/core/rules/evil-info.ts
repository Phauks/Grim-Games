/**
 * What the Demon learns at Demon info, and the fake world a player who believes they are the
 * Demon is shown instead (Trevor, 2026-10-29). Read from rules, never by character id:
 * `believesType: "demon"` (the Lunatic, https://wiki.bloodontheclocktower.com/Lunatic),
 * `choosesLikeDemon`, and `evilInfo.hidesMinions` / `shownAsOtherEvil` (the Poppy Grower,
 * https://wiki.bloodontheclocktower.com/Poppy_Grower, and the Magician,
 * https://wiki.bloodontheclocktower.com/Magician).
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import { rulesIn, rulesOf } from '#lib/core/data/rules/index.ts';
import { abilityState } from './ability.ts';
import {
	trueCharacter,
	type CharacterLookup,
	type FakeEvilInfo,
	type Game,
	type SeatId
} from '#lib/core/model/index.ts';

const rulesAt = (game: Game, seatId: SeatId, characters: CharacterLookup) => {
	const id = trueCharacter(game, seatId, characters);
	return id === undefined ? undefined : rulesOf(id, characters);
};

/** Whether this player believes they are the Demon (the Lunatic). */
export function believesDemon(game: Game, seatId: SeatId, characters: CharacterLookup): boolean {
	return rulesAt(game, seatId, characters)?.believesType === 'demon';
}

/**
 * The Demon this player believes they are: the one their bag tile showed them, or with no
 * confirmed tile the Demon in play, as the wiki says is usual.
 */
export function believedDemon(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): CharacterId | undefined {
	const truth = game.seats[seatId]?.characterId;
	for (const tile of Object.values(game.bag?.tiles ?? {})) {
		if (tile.confirmed && tile.drawnBySeat === seatId && tile.grimoire === truth) return tile.shows;
	}
	for (const other of game.seating) {
		const id = trueCharacter(game, other, characters);
		if (id !== undefined && characters.get(id)?.type === 'demon') return id;
	}
	return undefined;
}

export interface DemonInfo {
	/**
	 * A living player whose character keeps the Demon from learning its Minions (the Poppy
	 * Grower); undefined when the Demon learns them.
	 */
	hiddenBy?: CharacterId;
	/** Players the Demon is shown as Minions though they are not (the Magician). */
	shownAsMinions: SeatId[];
	/** Players the Minions are shown as the Demon though they are not (the Magician). */
	shownAsDemon: SeatId[];
}

/** How the evil team's first-night info differs from the plain truth in this game. */
export function demonInfo(game: Game, characters: CharacterLookup): DemonInfo {
	const out: DemonInfo = { shownAsMinions: [], shownAsDemon: [] };
	for (const seatId of game.seating) {
		const id = trueCharacter(game, seatId, characters);
		const evilInfo = id === undefined ? undefined : rulesIn(game, id, characters)?.evilInfo;
		// With its optional rule (`whileWorking`), a drunk or poisoned Poppy Grower hides nothing.
		const hides =
			evilInfo?.hidesMinions &&
			!game.seats[seatId].dead &&
			(!evilInfo.whileWorking || abilityState(game, seatId, characters).works);
		if (hides && out.hiddenBy === undefined) out.hiddenBy = id;
		if (evilInfo?.shownAsOtherEvil) {
			out.shownAsMinions.push(seatId);
			out.shownAsDemon.push(seatId);
		}
	}
	return out;
}

/** This player's fake world, leaving out seats no longer in the game. */
export function fakeEvilInfoOf(game: Game, seatId: SeatId): FakeEvilInfo {
	const info = game.fakeEvilInfo?.[seatId];
	const seated = (ids: readonly SeatId[] | undefined) =>
		(ids ?? []).filter((id) => game.seating.includes(id));
	const decoy = info?.decoy && game.seating.includes(info.decoy) ? info.decoy : undefined;
	return {
		minions: seated(info?.minions),
		...(decoy ? { decoy, decoyChose: seated(info?.decoyChose) } : {})
	};
}

/** The players this player marked as if they were the Demon (the Lunatic's Chosen), in seat order. */
export function chosenLikeDemon(game: Game, seatId: SeatId, characters: CharacterLookup): SeatId[] {
	const id = trueCharacter(game, seatId, characters);
	const label = id === undefined ? undefined : rulesOf(id, characters)?.choosesLikeDemon;
	if (!id || !label) return [];
	return game.seating.filter((s) =>
		game.seats[s].reminders.some((r) => r.characterId === id && r.label === label)
	);
}
