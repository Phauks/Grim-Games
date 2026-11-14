/** Test oracles for the reference and night-order views. */
import type { GameData } from '#lib/core/data/game-data.ts';
import type { CharacterId, NightMarker, NightSheet } from '#lib/core/data/types.ts';
import type { Night } from '#lib/core/model/overrides.ts';
import { nightOrder, type NightOrder } from '#lib/core/rules/night/night-order.ts';
import { MAX_DEALT_PLAYERS } from '#lib/core/rules/setup/distribution.ts';

/**
 * The night order with every official character in play and a full table (15 players),
 * exactly as the night-order engine builds it for a game.
 */
export function fullNightOrder(data: GameData, night: Night): NightOrder {
	return nightOrder({
		night,
		sheet: data.nightSheet,
		official: data.byId,
		inPlay: data.characters,
		players: MAX_DEALT_PLAYERS,
		wholeSheet: true
	});
}

/** Position of each step on TPI's sheet (Dusk = #1), for the night-order view. */
export function sheetPosition(sheet: NightSheet, night: Night, id: CharacterId | NightMarker) {
	const list = night === 'first' ? sheet.firstNight : sheet.otherNight;
	const i = list.indexOf(id);
	return i >= 0 ? i + 1 : undefined;
}
