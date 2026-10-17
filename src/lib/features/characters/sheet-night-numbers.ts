import type { CharacterId, NightSheet } from '#lib/core/data/index.ts';
import { sheetNightNumbers } from '#lib/core/rules/night-numbers.ts';

const cache = new WeakMap<NightSheet, { first: Map<string, number>; other: Map<string, number> }>();

/**
 * A character's night order numbers on TPI's whole sheet, counting characters only, for the
 * token badges where no game decides the order (Reference, the settings preview).
 */
export function sheetNumbersFor(
	sheet: NightSheet,
	id: CharacterId
): { first?: number; other?: number } {
	let numbers = cache.get(sheet);
	if (!numbers) {
		numbers = {
			first: sheetNightNumbers(sheet.firstNight),
			other: sheetNightNumbers(sheet.otherNight)
		};
		cache.set(sheet, numbers);
	}
	return { first: numbers.first.get(id), other: numbers.other.get(id) };
}
