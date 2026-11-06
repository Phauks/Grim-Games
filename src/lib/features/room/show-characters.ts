import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { Game, SeatId } from '#lib/core/model/index.ts';
import { noPhoneSeats } from '#lib/core/sync/seat-roles.ts';
import { seatName } from '#lib/features/game/seat-label.ts';
import { roomHost } from './host.svelte.ts';
import { noPhoneDraw } from './no-phone-draw.svelte.ts';

/**
 * Lets players see their characters: on their phones for the minute, and, for each player
 * with no phone, a tile with their name held on the draw for the usual reveal on this device
 * (Trevor, 2026-11-01: "it should use the normal draw area"). The one way to show them, used
 * by Show characters beside Players' ✕ and by Deal on the draw (Trevor, 2026-11-06: Send
 * characters from the draw must showcase the tokens to players with no phone, as the player
 * screen does), so the two can't drift apart.
 *
 * Their tiles stand in name order.
 *
 * `phones` adds seats a phone is taking right now, before the room has told this device.
 */
export function showCharacters(
	game: Game,
	characters: CharacterLookup,
	phones: Iterable<SeatId> = []
): void {
	const host = roomHost();
	const seated = new Set([...host.members.flatMap((m) => (m.seatId ? [m.seatId] : [])), ...phones]);
	// By name, so each player finds theirs quickly (Trevor, 2026-11-06: "it should sort names
	// alphabetically, not random").
	const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
	const noPhone = noPhoneSeats(game, characters, seated).sort((a, b) =>
		byName.compare(seatName(game, a), seatName(game, b))
	);
	host.showRoles(game.gameId, true);
	noPhoneDraw.start(game.gameId, noPhone);
	if (!noPhone.length) return;
	const draw = resolve('/grimoire/[gameId]/draw', { gameId: game.gameId });
	if (page.url.pathname !== draw) void goto(draw);
}
