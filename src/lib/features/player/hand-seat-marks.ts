/**
 * A player's grim marks its seats for the token in hand as the Storyteller's board does
 * (Trevor, 2026-11-10: Local Grim should match the Storyteller): the same rule (hand-marks.ts)
 * read from the characters its seats show (a Traveller, else the player's main guess), the
 * same ring, glow and fade (SeatDisc).
 */
import {
	toScript,
	type CharacterId,
	type GameData,
	type LoadedScript
} from '#lib/core/data/index.ts';
import type { PublicSeat } from '#lib/core/sync/public-projection.ts';
import { characterLookup, type Reminder } from '#lib/core/model/index.ts';
import { townGame } from '#lib/core/town/town-game.ts';
import { handMarks, handRole, type HandMarks } from '#lib/features/grimoire/hand-marks.ts';
import type { TrayGestures } from '#lib/features/board/tray-gestures.svelte.ts';

/** The marks for the token in hand on the seats as this grim shows them; none with none in hand. */
export function playerHandMarks(
	loaded: LoadedScript,
	data: Pick<GameData, 'characters'> | undefined,
	inHand: Reminder | undefined,
	seats: readonly PublicSeat[],
	shown: (seat: PublicSeat) => CharacterId | undefined
): HandMarks | undefined {
	if (!inHand) return undefined;
	const script = toScript(loaded);
	const characters = characterLookup(data ?? { characters: loaded.characters }, script);
	const town = seats.map((s) => ({ seatId: s.seatId, characterId: shown(s), dead: s.dead }));
	return handMarks(townGame(script, town, characters), inHand, characters);
}

/** One seat's SeatDisc marks: the hand's, and where a dragged token is let go or came from. */
export function seatMarks(marks: HandMarks | undefined, gestures: TrayGestures, seatId: string) {
	const drag = gestures.trayDrag ?? gestures.placedDrag;
	const from = gestures.placedDrag?.from;
	return {
		role: marks && handRole(marks, seatId),
		misfit: !!marks?.misfits.has(seatId),
		drop: drag?.target === seatId && from !== seatId,
		from: from !== undefined && from === seatId
	};
}
