/** Pairs of neighbours around the circle, and counts of them under per-pair registration. */
import type { Learns } from '#lib/core/data/character-rules.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import type { Registration, RegistrationWorld } from '../ability.ts';
import type { InfoOption } from './picker.ts';

/** Every two players sitting next to each other, around the whole circle. */
export function neighbourPairs(game: Game): [SeatId, SeatId][] {
	const n = game.seating.length;
	if (n < 2) return [];
	const pairs = game.seating.map((s, i): [SeatId, SeatId] => [s, game.seating[(i + 1) % n]]);
	// Two players are one pair, not two.
	return n === 2 ? pairs.slice(0, 1) : pairs;
}

/**
 * For a measure that counts pairs of neighbours (`evil-pairs`), the counts that are only
 * true when a misregistering player registers differently in each pair they are part of:
 * https://wiki.bloodontheclocktower.com/Chef (Example 4: a Recluse between the Imp and the
 * Poisoner registers evil for one pair and good for the other, so the Chef may learn 1).
 * The Recluse and Spy pages let the Storyteller choose again each time an alignment is
 * detected, and each pair is detected on its own. Everyone else registers as `world` says.
 * Each count is marked with the players it relies on misregistering, fewest found first.
 */
export function perPairOptions(
	game: Game,
	measure: Learns['measure'],
	regs: readonly Registration[],
	world: RegistrationWorld
): { option: InfoOption; registered: SeatId[] }[] {
	if (measure !== 'evil-pairs') return [];
	const regOf = new Map(regs.map((r) => [r.seatId, r]));
	const allowed = (s: SeatId) => regOf.get(s)?.alignments ?? [world.alignment(s)];
	const usual = (s: SeatId) => (regOf.has(s) ? regOf.get(s)!.alignments[0] : world.alignment(s));
	// Count of evil pairs so far, to the fewest players misregistering to reach it.
	let reach = new Map<number, Set<SeatId>>([[0, new Set()]]);
	for (const [a, b] of neighbourPairs(game)) {
		const next = new Map<number, Set<SeatId>>();
		for (const [count, mis] of reach) {
			for (const ca of allowed(a)) {
				for (const cb of allowed(b)) {
					const total = count + (ca === 'evil' && cb === 'evil' ? 1 : 0);
					const now = new Set(mis);
					if (ca !== usual(a)) now.add(a);
					if (cb !== usual(b)) now.add(b);
					const best = next.get(total);
					if (!best || now.size < best.size) next.set(total, now);
				}
			}
		}
		reach = next;
	}
	return [...reach]
		.sort(([a], [b]) => a - b)
		.map(([number, mis]) => ({ option: { seats: [], number }, registered: [...mis] }));
}
