/**
 * The Pixie's gained ability (https://wiki.bloodontheclocktower.com/Pixie): once the Mad
 * Townsfolk dies and the Storyteller judges the Pixie was mad, the Pixie has that ability
 * and wakes when that Townsfolk would.
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { gainedAbilities } from './gained-abilities.ts';
import { withNightInfo } from './night-info.ts';
import { nightOrder } from './night-order.ts';

const add =
	(i: number, label: string) =>
	(s: string[]): Command => ({
		type: 'AddReminder',
		seatId: s[i],
		reminder: { characterId: 'pixie', label }
	});
const kill =
	(i: number) =>
	(s: string[]): Command => ({ type: 'SetDead', seatId: s[i], dead: true, cause: 'execution' });

const cast = ['pixie', 'undertaker', 'imp', 'poisoner', 'chef', 'monk'];

function otherNight(g: ReturnType<typeof game>['game']) {
	const data = committedGameData();
	const inPlay = g.seating.map((s) => data.byId.get(g.seats[s].characterId!)!);
	return withNightInfo(
		nightOrder({ night: 'other', sheet: data.nightSheet, inPlay, players: 7 }).steps,
		g,
		characters,
		'other'
	);
}

describe('Pixie', () => {
	it('gains nothing while the Mad player is alive', () => {
		const { game: g } = castGame(cast, add(1, 'Mad'));
		expect(gainedAbilities(g)).toEqual([]);
		expect(otherNight(g).some((s) => s.gained)).toBe(false);
	});

	it('once the Mad player dies, the Storyteller decides at that character’s step', () => {
		const { game: g, seats } = castGame(cast, add(1, 'Mad'), kill(1));
		expect(gainedAbilities(g)).toMatchObject([
			{ seatId: seats[0], characterId: 'undertaker', status: 'if-mad', fromSeat: seats[1] }
		]);
		const steps = otherNight(g);
		const at = steps.findIndex((s) => s.id === 'undertaker');
		const step = steps[at + 1];
		expect(step).toMatchObject({
			character: { id: 'pixie' },
			gained: { characterId: 'undertaker', status: 'if-mad' },
			reminder: characters.get('undertaker')!.otherNightReminder
		});
	});

	it('with Has Ability, the Pixie wakes as that character, with its worked-out answer', () => {
		const { game: g, seats } = castGame(cast, add(1, 'Has Ability'), kill(1), (s) => ({
			type: 'Execute',
			seatId: s[3]
		}));
		const step = otherNight(g).find((s) => s.gained)!;
		expect(step.gained).toMatchObject({ status: 'has-ability' });
		expect(step.gained?.firstNightText).toBeUndefined();
		// The Pixie, as the Undertaker, learns today's executee (the Poisoner).
		expect(step.info).toMatchObject({
			kind: 'answer',
			answers: [{ seatId: seats[0], characterId: 'undertaker', value: 'poisoner' }]
		});
	});

	it('a start-of-game ability gives its first-night info the night it is gained', () => {
		const { game: g } = castGame(cast, add(4, 'Has Ability'), kill(4));
		const step = otherNight(g).find((s) => s.gained)!;
		expect(step.reminder).toBe(characters.get('chef')!.firstNightReminder);
		expect(step.gained).toMatchObject({ characterId: 'chef', firstNightText: true });
		expect(step.info).toMatchObject({ kind: 'picker' });
	});

	it('a dead Pixie gains nothing', () => {
		const { game: g } = castGame(cast, add(1, 'Has Ability'), kill(1), kill(0));
		expect(gainedAbilities(g)).toEqual([]);
	});
});
