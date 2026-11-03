import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { withNightInfo } from './night-info.ts';
import { nightOrder } from './night-order.ts';

const otherNight = (s: Scenario) => {
	const data = committedGameData();
	const inPlay = s.game.seating.map((id) => data.byId.get(s.game.seats[id].characterId!)!);
	const order = nightOrder({ night: 'other', sheet: data.nightSheet, inPlay, players: 7 });
	return withNightInfo(order.steps, s.game, s.characters, 'other', { died: [] }).map((s) => s.id);
};

describe('late evil info steps (evilInfo.wakeToken)', () => {
	const cast = ['poppygrower', 'chef', 'imp', 'poisoner', 'witch', 'empath', 'monk'];

	it('adds Minion info then Demon info right after the step whose token is on', () => {
		const s = scenario(cast)
			.execute('poppygrower')
			.reminder('poppygrower', 'poppygrower', 'Evil Wakes');
		const ids = otherNight(s);
		const own = ids.indexOf('poppygrower');
		expect(ids.slice(own + 1, own + 3)).toEqual(['minioninfo', 'demoninfo']);
	});

	it('adds nothing without the token, and the token comes off at dawn', () => {
		const dead = scenario(cast).execute('poppygrower');
		expect(otherNight(dead)).not.toContain('minioninfo');
		const next = dead.reminder('poppygrower', 'poppygrower', 'Evil Wakes').newDay();
		expect(otherNight(next)).not.toContain('minioninfo');
	});
});
