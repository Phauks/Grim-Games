/**
 * Travellers chose on their phones (room-traveller-pick.ts): each Traveller a phone confirms
 * goes on its seat as an ordinary command, so it shows in History and can be undone. Only a
 * new confirmation is applied, so a seat the Storyteller has changed since stays as it is. The
 * alignment is the Storyteller's to choose (https://wiki.bloodontheclocktower.com/Glossary).
 */
import type { TravellerPickHostView } from '#lib/core/sync/room.ts';
import type { OpenGame } from '#lib/features/game/session.svelte.ts';

const confirmedKey = (seat: TravellerPickHostView['seats'][number]) =>
	seat.confirmed && seat.characterId ? `${seat.seatId}|${seat.characterId}` : undefined;

export function applyTravellerPicks(
	game: OpenGame | undefined,
	before: TravellerPickHostView | undefined,
	after: TravellerPickHostView | undefined
): void {
	if (!game || !after) return;
	const done = new Set(before?.seats.map(confirmedKey));
	for (const seat of after.seats) {
		const key = confirmedKey(seat);
		if (!key || done.has(key) || !seat.characterId) continue;
		const current = game.game.seats[seat.seatId];
		if (!current || current.characterId === seat.characterId) continue;
		game.run({ type: 'AssignCharacter', seatId: seat.seatId, characterId: seat.characterId });
	}
}
