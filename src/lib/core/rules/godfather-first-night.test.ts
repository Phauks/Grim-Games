/**
 * Godfather, first night: "You start knowing which Outsiders are in play"; the Storyteller
 * shows the character tokens of every Outsider in play
 * (https://wiki.bloodontheclocktower.com/Godfather). Each scenario paraphrases the pages it
 * encodes:
 * - https://wiki.bloodontheclocktower.com/Drunk: the Drunk is an Outsider though shown a
 *   Townsfolk token;
 * - https://wiki.bloodontheclocktower.com/Glossary: dead players' characters are in play; a
 *   drunk or poisoned player may be given false information; registering changes what
 *   detecting abilities learn;
 * - https://wiki.bloodontheclocktower.com/Recluse: may register as a Minion or Demon;
 * - https://wiki.bloodontheclocktower.com/Spy: may register as a Townsfolk or Outsider.
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { nightAnswer } from './night-info.ts';
import { nightStepInfo } from './night-info/steps.ts';

type Step = (seats: string[]) => Command;

/** The Godfather's first-night answer; the Godfather sits at `at`. */
function firstNight(cast: string[], at: number, ...steps: Step[]) {
	const { session, seats } = castGame(cast, ...steps);
	const a = nightAnswer(session.game, seats[at], 'godfather', characters, undefined, 'first');
	if (a?.kind !== 'characters') throw new Error(`no characters answer: ${a?.kind}`);
	return { a, seats, game: session.game };
}

const remind =
	(at: number, characterId: string, label: string): Step =>
	(s) => ({ type: 'AddReminder', seatId: s[at], reminder: { characterId, label } });

describe('Godfather first night: the Outsiders in play', () => {
	it('lists every Outsider character in play, once each, and who holds them', () => {
		const { a, seats } = firstNight(['chef', 'butler', 'saint', 'godfather', 'imp'], 3);
		expect(a).toMatchObject({ kind: 'characters', value: ['butler', 'saint'] });
		expect(a.because).toEqual([seats[1], seats[2]]);
		expect(a.unreliable).toBeUndefined();
		expect(a.possible).toBeUndefined();
	});

	it('shows the Drunk, whose token is a Townsfolk, as the Drunk', () => {
		const { a, seats } = firstNight(
			['washerwoman', 'saint', 'godfather', 'imp', 'chef'],
			2,
			remind(0, 'drunk', 'Is The Drunk')
		);
		expect(a.value).toEqual(['drunk', 'saint']);
		expect(a.because).toEqual([seats[0], seats[1]]);
	});

	it('keeps an Outsider whose player is poisoned, or dead', () => {
		const { a } = firstNight(
			['butler', 'saint', 'poisoner', 'godfather', 'imp'],
			3,
			remind(0, 'poisoner', 'Poisoned'),
			(s) => ({ type: 'SetDead', seatId: s[1], dead: true, cause: 'demon' })
		);
		expect(a.value).toEqual(['butler', 'saint']);
	});

	it('is no characters when no Outsider is in play', () => {
		const { a } = firstNight(['chef', 'empath', 'godfather', 'imp', 'monk'], 2);
		expect(a).toMatchObject({ kind: 'characters', value: [], because: [] });
		expect(a.more).toBeUndefined();
	});

	it('allows leaving out a Recluse, who may register as a Minion', () => {
		const { a, seats } = firstNight(['recluse', 'saint', 'godfather', 'imp', 'chef'], 2);
		expect(a.value).toEqual(['recluse', 'saint']);
		expect(a.possible).toEqual([
			{ kind: 'characters', type: 'outsider', value: ['recluse', 'saint'] },
			{ kind: 'characters', type: 'outsider', value: ['saint'] }
		]);
		expect(a.misregister).toEqual([seats[0]]);
	});

	it('allows one more Outsider for a Spy, who may register as one', () => {
		const { a, seats } = firstNight(['butler', 'spy', 'godfather', 'imp', 'chef'], 2);
		expect(a.value).toEqual(['butler']);
		expect(a.possible).toEqual([
			{ kind: 'characters', type: 'outsider', value: ['butler'] },
			{
				kind: 'characters',
				type: 'outsider',
				value: ['butler'],
				more: { count: 1, type: 'outsider' }
			}
		]);
		expect(a.misregister).toEqual([seats[1]]);
	});

	it('marks the answer not reliable when the Godfather is poisoned', () => {
		const { a } = firstNight(
			['butler', 'poisoner', 'godfather', 'imp', 'chef'],
			2,
			remind(2, 'poisoner', 'Poisoned')
		);
		expect(a.unreliable).toBe('poisoned');
		expect(a.value).toEqual(['butler']);
	});

	it('asks whether an Outsider died today on other nights', () => {
		const { session, seats } = castGame(['chef', 'butler', 'godfather', 'imp', 'monk']);
		const g = session.game;
		expect(nightAnswer(g, seats[2], 'godfather', characters, { died: [] }, 'other')).toMatchObject({
			kind: 'none'
		});
		expect(nightAnswer(g, seats[2], 'godfather', characters, { died: [] })).toMatchObject({
			kind: 'none'
		});
	});

	it("is the first night step's answer", () => {
		const { game } = firstNight(['chef', 'butler', 'godfather', 'imp', 'monk'], 2);
		const godfather = characters.get('godfather')!;
		const info = nightStepInfo(game, godfather, characters, undefined, undefined, 'first');
		expect(info).toMatchObject({
			kind: 'answer',
			answers: [{ kind: 'characters', value: ['butler'] }]
		});
	});
});
