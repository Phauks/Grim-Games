/**
 * A whole Bad Moon Rising game, night by night, through the engine (M42): who wakes each night
 * (only when their ability applies), the Pukka's poison carried from one night to its kill the
 * next, the Exorcist stopping the Demon waking, the Innkeeper's tokens coming off on time, the
 * Fool's first death, and how the game ends. Each character has its own tests; this finds what
 * goes wrong between them over a game (Trevor, 2026-11-03: "Whole-game run-throughs").
 *
 * Rules: https://wiki.bloodontheclocktower.com/Bad_Moon_Rising and each character's page.
 */
import { describe, expect, it } from 'vitest';
import { editionScript, toScript } from '#lib/core/data/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import { gameEnds, nightKill, survivesFirstDeath, type NightStep } from '#lib/core/rules/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { boardNightSteps, stepWakes, tonight } from '../night-steps.ts';

const data = committedGameData();
const script = toScript(editionScript('bmr', data)!);

const cast = [
	'grandmother',
	'innkeeper',
	'pukka',
	'exorcist',
	'fool',
	'gossip',
	'godfather',
	'moonchild',
	'chambermaid'
];

function wakes(s: Scenario, diedTonight: SeatId[] = []): string[] {
	return boardNightSteps(s.game, s.characters, tonight(s.game), data)
		.filter((step: NightStep) =>
			stepWakes(s.game, step, s.characters, { diedTonight: new Set(diedTonight) })
		)
		.map((step) => step.id);
}

const labels = (s: Scenario, ref: string) =>
	s.game.seats[s.seat(ref)].reminders.map((r) => `${r.characterId}:${r.label}`);

describe('a Bad Moon Rising game (M42)', () => {
	const setup = scenario(cast, { script }).reminder('fool', 'grandmother', 'Grandchild');

	it('night 1 wakes the first-night characters only', () => {
		const ids = wakes(setup);
		expect(ids).toEqual(
			expect.arrayContaining(['minioninfo', 'demoninfo', 'godfather', 'grandmother', 'pukka'])
		);
		for (const later of ['innkeeper', 'exorcist', 'gossip']) expect(ids).not.toContain(later);
	});

	// Night 1: the Pukka poisons the Fool.
	const night1 = setup.reminder('fool', 'pukka', 'Poisoned');

	// Day 1: the Moonchild is executed, which marks them Died Today by itself (M70).
	const day1 = night1.newDay();
	const executed = day1.execute('moonchild');
	const dusk1 = executed.dusk();

	it('day 1: the Pukka’s poison stays on the Fool past dusk', () => {
		expect(labels(dusk1, 'fool')).toContain('pukka:Poisoned');
	});

	it('night 2: the Godfather wakes because an Outsider died today', () => {
		// Wiki (Godfather): "If an Outsider dies during the day, mark them with the '''DIED TODAY''' reminder. That night, wake the Godfather."
		const ids = wakes(dusk1);
		expect(ids).toEqual(expect.arrayContaining(['godfather', 'innkeeper', 'exorcist', 'gossip']));
		expect(labels(dusk1, 'moonchild')).toContain('godfather:Died Today');
		// With the token taken off, the Outsider's death today still wakes the Godfather (warn,
		// never lock).
		const token = dusk1.game.seats[dusk1.seat('moonchild')].reminders.find(
			(r) => r.label === 'Died Today'
		)!;
		const unmarked = dusk1.do({ type: 'RemoveReminder', reminderId: token.reminderId });
		expect(wakes(unmarked, [unmarked.seat('moonchild')])).toContain('godfather');
		expect(wakes(unmarked)).not.toContain('godfather');
	});

	// Night 2: the Innkeeper protects the Gossip and the Chambermaid, making the Chambermaid
	// drunk; the Exorcist chooses the Pukka.
	const night2 = dusk1
		.reminder('gossip', 'innkeeper', 'Safe')
		.reminder('chambermaid', 'innkeeper', 'Safe')
		.reminder('chambermaid', 'innkeeper', 'Drunk')
		.reminder('pukka', 'exorcist', 'Chosen');

	it('night 2: the Exorcist stops the Pukka choosing, but last night’s poisoned Fool still dies', () => {
		expect(nightKill(night2.game, night2.seat('pukka'), 'pukka', night2.characters)).toEqual({
			max: 0,
			delayed: [night2.seat('fool')]
		});
		// The Fool is poisoned, so their first death is not saved.
		expect(
			survivesFirstDeath(night2.game, night2.seat('fool'), 'demon', night2.characters)
		).toBeUndefined();
	});

	const killed = night2.dies('fool', 'pukka');
	const day2 = killed.newDay();
	const dusk2 = day2.dusk();

	it('day 2: the Innkeeper’s Safe comes off at dawn, its Drunk at dusk', () => {
		expect(labels(day2, 'gossip')).not.toContain('innkeeper:Safe');
		expect(labels(day2, 'chambermaid')).not.toContain('innkeeper:Safe');
		expect(labels(day2, 'chambermaid')).toContain('innkeeper:Drunk');
		expect(labels(dusk2, 'chambermaid')).not.toContain('innkeeper:Drunk');
	});

	it('night 3: the Godfather does not wake, as no Outsider died today', () => {
		// Wiki (Godfather): "If an Outsider dies during the day, mark them with the '''DIED TODAY''' reminder. That night, wake the Godfather."
		// The Fool died last night, not today, and Died Today came off at dawn.
		expect(labels(day2, 'moonchild')).not.toContain('godfather:Died Today');
		expect(wakes(dusk2)).not.toContain('godfather');
	});

	it('day 3: executing the Pukka ends the game, good wins', () => {
		const end = dusk2.newDay().execute('pukka');
		expect(gameEnds(end.game, end.characters)[0]).toMatchObject({ winner: 'good' });
	});
});
