/**
 * Why a player a killer chose lives, for tests: the killing step's "If chosen" alerts
 * (`nightStepAlerts`, `rules/night/kill-alerts.ts`) that work tonight, a protection, a kill
 * the player may move elsewhere or a first death they survive. A killer with no working
 * ability is `abilityState`'s to say.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import type { SeatId } from '#lib/core/model/types.ts';
import { nightStepAlerts } from '#lib/core/rules/night/night-alerts.ts';
import type { Scenario } from './scenario.ts';

const SAVES = new Set(['protected', 'may-bounce', 'survives-first-death']);

export function savedBy(s: Scenario, killer: CharacterId, seatId: SeatId) {
	return nightStepAlerts(s.game, killer, s.characters)
		.filter((a) => a.seatId === seatId && a.works && SAVES.has(a.kind))
		.map(({ kind, source }) => ({ kind, source }));
}
