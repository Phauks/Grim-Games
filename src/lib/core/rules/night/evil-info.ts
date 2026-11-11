/**
 * What the Demon learns at Demon info, and the fake world a player who believes they are the
 * Demon is shown instead (Trevor, 2026-10-29). Read from rules, never by character id:
 * `believesType: "demon"` (the Lunatic, https://wiki.bloodontheclocktower.com/Lunatic),
 * `choosesLikeDemon`, and `evilInfo.hidesMinions` / `shownAsOtherEvil` (the Poppy Grower,
 * https://wiki.bloodontheclocktower.com/Poppy_Grower, and the Magician,
 * https://wiki.bloodontheclocktower.com/Magician).
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';
import { abilityState } from '#lib/core/rules/abilities/ability.ts';
import { ownJinxEffects } from '#lib/core/rules/jinxes/jinxes.ts';
import { hiddenPartnersOf } from '#lib/core/rules/jinxes/jinx-effects.ts';
import {
	alignmentOf,
	trueCharacter,
	type CharacterLookup,
	type FakeEvilInfo,
	type Game,
	type SeatId
} from '#lib/core/model/index.ts';

const rulesAt = (game: Game, seatId: SeatId, characters: CharacterLookup) => {
	const id = trueCharacter(game, seatId, characters);
	return id === undefined ? undefined : rulesFor(game, id, characters);
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
	/**
	 * A jinx has the Demon's players wake in separate groups and learn which players are good
	 * (`learns` `good-players`: Legion with the Magician): those players, never `hiddenBy`'s.
	 */
	goodShown?: { seats: SeatId[]; hiddenBy: CharacterId };
	/**
	 * A jinx keeps the Demon from learning which neighbour is a Minion (`notShown` `partner-seat`:
	 * while the Magician is alive, the Marionette): those players, left out of the Minions
	 * shown, the character they are, and the living character that hides them.
	 */
	neighbourHidden?: { seats: SeatId[]; partner: CharacterId; hiddenBy: CharacterId };
}

/** How the evil team's first-night info differs from the plain truth in this game. */
export function demonInfo(game: Game, characters: CharacterLookup): DemonInfo {
	const out: DemonInfo = { shownAsMinions: [], shownAsDemon: [] };
	for (const seatId of game.seating) {
		const id = trueCharacter(game, seatId, characters);
		const evilInfo = id === undefined ? undefined : rulesFor(game, id, characters)?.evilInfo;
		// With its optional rule (`whileWorking`), a drunk or poisoned Poppy Grower hides nothing.
		const hides =
			evilInfo?.hidesMinions &&
			!game.seats[seatId].dead &&
			(!evilInfo.whileWorking || abilityState(game, seatId, characters).works);
		if (hides && out.hiddenBy === undefined) out.hiddenBy = id;
		// A player with no ability shows nothing false (the Magician while the Vizier is in play,
		// https://wiki.bloodontheclocktower.com/Magician#Related_Jinxes).
		if (
			evilInfo?.shownAsOtherEvil &&
			!abilityState(game, seatId, characters).impairments.some((i) => i.reason === 'no-ability')
		) {
			out.shownAsMinions.push(seatId);
			out.shownAsDemon.push(seatId);
		}
	}
	// While the Magician is alive, the Demon doesn't know which neighbour is the Marionette
	// (https://wiki.bloodontheclocktower.com/Magician#Related_Jinxes).
	for (const seatId of game.seating) {
		const id = trueCharacter(game, seatId, characters);
		if (id === undefined || game.seats[seatId].dead || out.neighbourHidden) continue;
		for (const partner of hiddenPartnersOf(game, id, characters)) {
			const seats = game.seating.filter((s) => trueCharacter(game, s, characters) === partner);
			if (seats.length > 0) {
				out.neighbourHidden = { seats, partner, hiddenBy: id };
				break;
			}
		}
	}
	const good = demonLearnsGood(game, characters);
	if (good) {
		out.goodShown = good;
		out.shownAsMinions = out.shownAsMinions.filter(
			(s) => trueCharacter(game, s, characters) !== good.hiddenBy
		);
	}
	return out;
}

/**
 * With a jinx that says so in play (`learns` `good-players`), the good players the Demon's groups
 * learn at Demon info, and the character never shown: "If the Magician is in play, during the
 * Demon info step, Legion wake in separate groups"
 * (https://wiki.bloodontheclocktower.com/Legion#Related_Jinxes).
 */
function demonLearnsGood(
	game: Game,
	characters: CharacterLookup
): { seats: SeatId[]; hiddenBy: CharacterId } | undefined {
	for (const seatId of game.seating) {
		const id = trueCharacter(game, seatId, characters);
		if (id === undefined) continue;
		const jinx = ownJinxEffects(
			game,
			id,
			'learns',
			characters,
			(e) => e.what === 'good-players'
		)[0];
		if (!jinx) continue;
		const seats = game.seating.filter(
			(s) => alignmentOf(game, s) === 'good' && trueCharacter(game, s, characters) !== jinx.partner
		);
		return { seats, hiddenBy: jinx.partner };
	}
	return undefined;
}

/** This player's fake world, leaving out seats no longer in the game. */
export function fakeEvilInfoOf(game: Game, seatId: SeatId): FakeEvilInfo {
	const info = game.fakeEvilInfo[seatId];
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
	const label = id === undefined ? undefined : rulesFor(game, id, characters)?.choosesLikeDemon;
	if (!id || !label) return [];
	return game.seating.filter((s) =>
		game.seats[s].reminders.some((r) => r.characterId === id && r.label === label)
	);
}
