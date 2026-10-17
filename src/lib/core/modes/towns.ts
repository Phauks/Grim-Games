/**
 * More than one town in one game (part `towns`): Two Towns and a Boomdandy splits the players
 * between two towns and moves some across each day
 * (https://ekins.blog/2026/04/29/two-towns-and-a-boomdandy-rules/); Two games at once seats
 * every player in both, never the Demon in both (Trevor, 2026-10-17). Each town is an
 * ordinary saved game; these helpers only plan and check across them.
 */
import type { CharacterId, CharacterType } from '#lib/core/data/types.ts';
import type { SeatedType } from '#lib/core/rules/distribution.ts';
import type { Command } from '#lib/core/engine/commands.ts';
import type { Seat, SeatId } from '#lib/core/model/types.ts';
import type { GameMode } from './types.ts';

/** Players per town, as even as possible, earlier towns taking the extra players. */
export function townSizes(players: number, towns: number): number[] {
	const n = Math.max(1, Math.floor(towns));
	const base = Math.floor(players / n);
	return Array.from({ length: n }, (_, i) => base + (i < players % n ? 1 : 0));
}

/** Players the representative moves at the end of `day` (1-based); 0 when the rule has none. */
export function movesOnDay(mode: GameMode, day: number): number {
	const step = mode.parts.daySteps?.find((s) => s.kind === 'town-representative');
	if (!step || step.kind !== 'town-representative') return 0;
	return step.movesPerDay[day - 1] ?? 0;
}

/** One player's characters, town by town (undefined where they have none yet). */
export interface PlayerAcrossTowns {
	playerName: string;
	characters: ({ id: CharacterId; type: CharacterType } | undefined)[];
}

/**
 * Players with a character of a type the mode keeps to one town (`notInEveryTown`) in every
 * town, e.g. the Demon in both games. A warning only; the Storyteller decides.
 */
export function inEveryTown(
	mode: GameMode,
	players: readonly PlayerAcrossTowns[]
): { playerName: string; type: SeatedType }[] {
	const types = mode.parts.towns?.notInEveryTown ?? [];
	const towns = mode.parts.towns?.count ?? 1;
	const out: { playerName: string; type: SeatedType }[] = [];
	for (const p of players) {
		if (p.characters.length < towns) continue;
		for (const type of types) {
			if (p.characters.every((c) => c?.type === type)) out.push({ playerName: p.playerName, type });
		}
	}
	return out;
}

/**
 * A living player with a character can move to the other town (dead players can't, per the
 * rules above).
 */
export function canMoveTown(seat: Seat): boolean {
	return !seat.dead && seat.characterId !== undefined;
}

/**
 * What puts a moved player into their new town, on the seat just added there: they keep
 * their character, alignment and the reminders on their own seat; reminders they put on
 * other players stay behind with those players (Two Towns rules, linked above). The
 * caller adds the seat first (`AddSeat` with the player's name) and removes the old one
 * after.
 */
export function moveIntoTown(seat: Seat, newSeatId: SeatId): Command[] {
	if (seat.characterId === undefined) return [];
	const assign: Command = {
		type: 'AssignCharacter',
		seatId: newSeatId,
		characterId: seat.characterId
	};
	if (seat.alignment !== undefined) assign.alignment = seat.alignment;
	return [
		assign,
		...seat.reminders.map((r): Command => ({
			type: 'AddReminder',
			seatId: newSeatId,
			reminder: { characterId: r.characterId, label: r.label }
		}))
	];
}
