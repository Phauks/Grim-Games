/**
 * Game end conditions. Each scenario paraphrases a wiki page:
 * - https://wiki.bloodontheclocktower.com/Glossary ("Demon", "Evil": Travellers don't count)
 * - https://wiki.bloodontheclocktower.com/Saint, /Evil_Twin, /Scarlet_Woman, /Mastermind, /Imp
 * - https://wiki.bloodontheclocktower.com/Vortox, /Mayor, /Leviathan, /Fearmonger, /Summoner
 * - https://wiki.bloodontheclocktower.com/Heretic, /Zombuul, /Lleech, /Fang_Gu, /Lil%27_Monsta, /Legion
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { gameEnds, promptable, suggestedWinner, type GameEndOptions } from './game-end.ts';

type Step = Command | ((s: string[]) => Command);

const dead =
	(i: number, cause = 'demon') =>
	(s: string[]): Command => ({ type: 'SetDead', seatId: s[i], dead: true, cause });
const execute =
	(i: number) =>
	(s: string[]): Command => ({ type: 'Execute', seatId: s[i] });
const exile =
	(i: number) =>
	(s: string[]): Command => ({ type: 'Exile', seatId: s[i] });
const nominate =
	(by: number, who: number) =>
	(s: string[]): Command => ({ type: 'Nominate', nominator: s[by], nominee: s[who] });
const remind =
	(i: number, characterId: string, label: string) =>
	(s: string[]): Command => ({
		type: 'AddReminder',
		seatId: s[i],
		reminder: { characterId, label }
	});
const align =
	(i: number, alignment: 'good' | 'evil') =>
	(s: string[]): Command => ({ type: 'SetAlignment', seatId: s[i], alignment });
const newDay: Command = { type: 'NewDay' };

function ends(cast: string[], steps: Step[] = [], options: GameEndOptions = {}) {
	const { session, seats } = castGame(cast, ...steps);
	return { ends: gameEnds(session.game, characters, options), seats };
}

const TB = ['washerwoman', 'chef', 'empath', 'monk', 'saint', 'poisoner', 'imp'];

describe('core rules (Glossary)', () => {
	it('nothing ends while the Demon lives and 3 or more are alive', () => {
		expect(ends(TB).ends).toEqual([]);
	});

	it('nothing is checked before a seat has a character', () => {
		const { session } = castGame([]);
		expect(gameEnds(session.game, characters)).toEqual([]);
	});

	it('the Demon dying wins it for good', () => {
		const { ends: e, seats } = ends(TB, [execute(6)]);
		expect(e).toMatchObject([{ rule: 'demon-dead', winner: 'good', seats: [seats[6]], holds: [] }]);
		expect(suggestedWinner(e)).toBe('good');
	});

	it('just 2 alive wins it for evil, unless the Demon died', () => {
		const deaths = [0, 1, 2, 3, 4].map((i) => dead(i));
		expect(ends(TB, deaths).ends).toMatchObject([{ rule: 'two-alive', winner: 'evil' }]);
		const both = ends(TB, [...deaths, execute(6)]).ends;
		expect(both.map((e) => e.rule)).toEqual(['demon-dead']);
	});

	it('Travellers do not count towards the 2 alive', () => {
		const cast = ['chef', 'empath', 'monk', 'poisoner', 'imp', 'gunslinger'];
		const steps = [dead(0), dead(1), dead(2), align(5, 'good')];
		expect(ends(cast, steps).ends).toMatchObject([{ rule: 'two-alive', winner: 'evil' }]);
	});

	it('exiling a Traveller who is the Demon is still the Demon dying', () => {
		const cast = ['chef', 'empath', 'monk', 'poisoner', 'beggar'];
		const steps = [
			align(4, 'evil'),
			(s: string[]): Command => ({
				type: 'SetOverride',
				seatId: s[4],
				override: { field: 'character', value: 'imp' }
			}),
			exile(4)
		];
		expect(ends(cast, steps).ends).toMatchObject([{ rule: 'demon-dead', winner: 'good' }]);
	});

	it("the Zombuul's first death leaves it alive (Zombuul)", () => {
		const cast = ['chef', 'empath', 'monk', 'poisoner', 'zombuul'];
		expect(ends(cast, [remind(4, 'zombuul', 'Dead')]).ends).toEqual([]);
	});

	it('the Zombuul marked dead the first time still lives (Zombuul)', () => {
		const cast = ['chef', 'empath', 'monk', 'poisoner', 'zombuul'];
		expect(ends(cast, [execute(4)]).ends).toEqual([]);
		// Only 2 others alive: it still lives, so evil hasn't won either.
		expect(ends(cast, [dead(0), dead(1), execute(4)]).ends).toEqual([]);
	});

	it('the Zombuul dying after its first death, or while poisoned, ends it (Zombuul)', () => {
		const cast = ['chef', 'empath', 'monk', 'poisoner', 'zombuul'];
		const again = ends(cast, [remind(4, 'zombuul', 'Dead'), execute(4)]).ends;
		expect(again).toMatchObject([{ rule: 'demon-dead', winner: 'good', holds: [] }]);
		const poisoned = ends(cast, [remind(4, 'poisoner', 'Poisoned'), execute(4)]).ends;
		expect(poisoned).toMatchObject([{ rule: 'demon-dead', winner: 'good' }]);
	});

	it('the Lleech dies only with its host (Lleech)', () => {
		const cast = ['chef', 'empath', 'monk', 'poisoner', 'lleech'];
		const host = remind(0, 'lleech', 'Poisoned');
		expect(ends(cast, [host, execute(4)]).ends).toEqual([]);
		expect(ends(cast, [host, dead(0), dead(4)]).ends).toMatchObject([
			{ rule: 'demon-dead', winner: 'good' }
		]);
	});

	it("Lil' Monsta's babysitter dying ends it: the Demon is dead (Lil' Monsta)", () => {
		const cast = ['chef', 'empath', 'monk', 'poisoner', 'goblin'];
		const steps = [remind(4, 'lilmonsta', 'Is The Demon'), execute(4)];
		expect(ends(cast, steps).ends).toMatchObject([{ rule: 'demon-dead', winner: 'good' }]);
	});

	it('every Legion must be dead (Legion)', () => {
		const cast = ['chef', 'empath', 'monk', 'legion', 'legion', 'legion'];
		expect(ends(cast, [dead(3), dead(4)]).ends).toEqual([]);
		expect(ends(cast, [dead(3), dead(4), execute(5)]).ends).toMatchObject([
			{ rule: 'demon-dead', winner: 'good' }
		]);
	});
});

describe('Saint (https://wiki.bloodontheclocktower.com/Saint)', () => {
	it('executed: its team loses', () => {
		const { ends: e, seats } = ends(TB, [execute(4)]);
		expect(e).toMatchObject([{ rule: 'saint', winner: 'evil', seats: [seats[4]], holds: [] }]);
	});

	it('killed another way: the game goes on', () => {
		expect(ends(TB, [dead(4, 'gunslinger')]).ends).toEqual([]);
	});

	it('an evil Saint executed loses for evil', () => {
		expect(ends(TB, [align(4, 'evil'), execute(4)]).ends).toMatchObject([
			{ rule: 'saint', winner: 'good' }
		]);
	});

	it("poisoned: the Storyteller's call", () => {
		const e = ends(TB, [remind(4, 'poisoner', 'Poisoned'), execute(4)]).ends;
		expect(e).toMatchObject([
			{ rule: 'saint', holds: [{ rule: 'impaired', characterId: 'saint' }] }
		]);
		expect(suggestedWinner(e)).toBeUndefined();
	});
});

describe('Evil Twin (https://wiki.bloodontheclocktower.com/Evil_Twin)', () => {
	const cast = ['washerwoman', 'chef', 'empath', 'monk', 'eviltwin', 'imp'];
	const twin = remind(1, 'eviltwin', 'Twin');

	it('good twin executed: evil wins', () => {
		const { ends: e, seats } = ends(cast, [twin, execute(1)]);
		expect(e).toMatchObject([{ rule: 'evil-twin', winner: 'evil', seats: [seats[1], seats[4]] }]);
	});

	it('good twin killed at night: the game goes on', () => {
		expect(ends(cast, [twin, dead(1)]).ends).toEqual([]);
	});

	it('Demon dead while both twins live: good cannot win yet', () => {
		const { ends: e, seats } = ends(cast, [twin, execute(5)]);
		expect(e).toMatchObject([
			{ rule: 'demon-dead', holds: [{ rule: 'evil-twin', seats: [seats[4], seats[1]] }] }
		]);
		expect(suggestedWinner(e)).toBeUndefined();
	});

	it('the Evil Twin executed first: a later Demon death wins for good', () => {
		const e = ends(cast, [twin, execute(4), newDay, execute(5)]).ends;
		expect(e).toMatchObject([{ rule: 'demon-dead', holds: [] }]);
		// Its ability is gone, so the good twin's execution no longer wins it for evil.
		expect(ends(cast, [twin, execute(4), newDay, execute(1)]).ends).toEqual([]);
	});
});

describe('Scarlet Woman (https://wiki.bloodontheclocktower.com/Scarlet_Woman)', () => {
	it('5 or more alive when the Demon dies: she may become the Demon', () => {
		const cast = ['chef', 'empath', 'monk', 'mayor', 'scarletwoman', 'imp'];
		expect(ends(cast, [execute(5)]).ends).toMatchObject([
			{ rule: 'demon-dead', holds: [{ rule: 'scarlet-woman' }] }
		]);
	});

	it('fewer, counting no Travellers: the game ends', () => {
		const cast = ['chef', 'empath', 'monk', 'scarletwoman', 'imp', 'gunslinger'];
		const e = ends(cast, [align(5, 'good'), dead(0), execute(4)]).ends;
		expect(e).toMatchObject([{ rule: 'demon-dead', holds: [] }]);
	});

	it('once she has taken over, she is the Demon', () => {
		const cast = ['chef', 'empath', 'monk', 'mayor', 'scarletwoman', 'imp'];
		expect(ends(cast, [execute(5), remind(4, 'scarletwoman', 'Is The Demon')]).ends).toEqual([]);
	});
});

describe('Imp (https://wiki.bloodontheclocktower.com/Imp)', () => {
	it('killing itself with a Minion alive: a Minion may become the Imp', () => {
		const { ends: e, seats } = ends(TB, [dead(6, 'imp')]);
		expect(e).toMatchObject([{ rule: 'demon-dead', holds: [{ rule: 'imp', seats: [seats[5]] }] }]);
	});
});

describe('Fang Gu (https://wiki.bloodontheclocktower.com/Fang_Gu)', () => {
	const cast = ['chef', 'empath', 'monk', 'recluse', 'poisoner', 'fanggu'];

	it('dying by its own kill with an Outsider alive: the Outsider may become the Fang Gu', () => {
		const { ends: e, seats } = ends(cast, [dead(5, 'fanggu')]);
		expect(e).toMatchObject([
			{ rule: 'demon-dead', holds: [{ rule: 'fang-gu', seats: [seats[3]] }] }
		]);
	});

	it('after it has jumped once, its death ends it', () => {
		const e = ends(cast, [remind(3, 'fanggu', 'Once'), dead(5, 'fanggu')]).ends;
		expect(e).toMatchObject([{ rule: 'demon-dead', holds: [] }]);
	});
});

describe('Mastermind (https://wiki.bloodontheclocktower.com/Mastermind)', () => {
	const cast = ['washerwoman', 'chef', 'empath', 'monk', 'mastermind', 'imp'];

	it('Demon executed: play one more day', () => {
		const e = ends(cast, [newDay, execute(5)]).ends;
		expect(e).toMatchObject([{ rule: 'demon-dead', holds: [{ rule: 'mastermind' }] }]);
	});

	it('a good player executed on the extra day: evil wins', () => {
		const e = ends(cast, [newDay, execute(5), newDay, execute(0)]).ends;
		expect(e).toMatchObject([{ rule: 'mastermind', winner: 'evil', day: 2 }]);
	});

	it('an evil player executed on the extra day: good wins', () => {
		const e = ends(cast, [newDay, execute(5), newDay, execute(4)]).ends;
		expect(e).toMatchObject([{ rule: 'mastermind', winner: 'good' }]);
	});

	it('nobody executed on the extra day: good wins', () => {
		const steps = [newDay, execute(5), newDay];
		expect(ends(cast, steps).ends).toMatchObject([{ holds: [{ rule: 'mastermind' }] }]);
		expect(ends(cast, steps, { dayEnded: true }).ends).toMatchObject([
			{ rule: 'mastermind', winner: 'good', seats: [] }
		]);
	});

	it('a Demon killed at night ends it as usual', () => {
		expect(ends(cast, [dead(5, 'slayer')]).ends).toMatchObject([{ rule: 'demon-dead', holds: [] }]);
	});
});

describe('Vortox (https://wiki.bloodontheclocktower.com/Vortox)', () => {
	const cast = ['chef', 'empath', 'monk', 'mayor', 'poisoner', 'vortox'];

	it('a day with no execution: evil wins', () => {
		expect(ends(cast, [newDay, newDay]).ends).toMatchObject([
			{ rule: 'vortox', winner: 'evil', day: 1 }
		]);
		expect(ends(cast, [newDay], { dayEnded: true }).ends).toMatchObject([{ rule: 'vortox' }]);
	});

	it('an execution that day: the game goes on', () => {
		expect(ends(cast, [newDay, execute(0), newDay]).ends).toEqual([]);
		expect(ends(cast, [newDay]).ends).toEqual([]);
	});

	it('an exile is not an execution', () => {
		const traveller = [...cast, 'gunslinger'];
		const steps = [align(6, 'good'), newDay, exile(6), newDay];
		expect(ends(traveller, steps).ends).toMatchObject([{ rule: 'vortox' }]);
	});
});

describe('Mayor (https://wiki.bloodontheclocktower.com/Mayor)', () => {
	const cast = ['chef', 'empath', 'monk', 'mayor', 'poisoner', 'imp'];
	const three = [newDay, dead(0), dead(1), dead(4)];

	it('3 alive and no execution at dusk: the Mayor’s team wins', () => {
		expect(ends(cast, three).ends).toEqual([]);
		expect(ends(cast, three, { dayEnded: true }).ends).toMatchObject([
			{ rule: 'mayor', winner: 'good', day: 1 }
		]);
	});

	it('an execution today, or the Mayor dead: no win', () => {
		expect(ends(cast, [newDay, dead(0), dead(1), execute(4)], { dayEnded: true }).ends).toEqual([]);
		expect(ends(cast, [newDay, dead(0), dead(1), dead(3)], { dayEnded: true }).ends).toEqual([]);
	});

	it('Travellers count towards the 3', () => {
		const steps = [...three, align(6, 'good')];
		expect(ends([...cast, 'gunslinger'], steps, { dayEnded: true }).ends).toEqual([]);
	});
});

describe('Leviathan (https://wiki.bloodontheclocktower.com/Leviathan)', () => {
	const cast = ['washerwoman', 'chef', 'empath', 'monk', 'mayor', 'poisoner', 'leviathan'];

	it('a second good player executed: evil wins', () => {
		expect(ends(cast, [newDay, execute(0)]).ends).toEqual([]);
		const { ends: e, seats } = ends(cast, [newDay, execute(0), newDay, execute(1)]);
		expect(e).toMatchObject([
			{ rule: 'leviathan-executions', winner: 'evil', seats: [seats[0], seats[1]] }
		]);
	});

	it('evil executions do not count', () => {
		expect(ends(cast, [newDay, execute(0), newDay, execute(5)]).ends).toEqual([]);
	});

	it('alive at the end of day 5: evil wins', () => {
		const five = [newDay, newDay, newDay, newDay, newDay];
		expect(ends(cast, five).ends).toEqual([]);
		expect(ends(cast, five, { dayEnded: true }).ends).toMatchObject([
			{ rule: 'leviathan-day-5', winner: 'evil', day: 5 }
		]);
		expect(ends(cast, [...five, newDay]).ends).toMatchObject([{ rule: 'leviathan-day-5' }]);
	});
});

describe('Fearmonger (https://wiki.bloodontheclocktower.com/Fearmonger)', () => {
	const cast = ['washerwoman', 'butler', 'empath', 'monk', 'fearmonger', 'imp'];
	const fear = remind(1, 'fearmonger', 'Fear');

	it('nominates and executes the chosen player: their team loses', () => {
		const e = ends(cast, [fear, newDay, nominate(4, 1), execute(1)]).ends;
		expect(e).toMatchObject([{ rule: 'fearmonger', winner: 'evil' }]);
	});

	it("someone else's nominee executed: no win", () => {
		expect(ends(cast, [fear, newDay, nominate(0, 1), execute(1)]).ends).toEqual([]);
	});

	it('an evil chosen player executed: good wins', () => {
		const steps = [remind(5, 'fearmonger', 'Fear'), newDay, nominate(4, 5), execute(5)];
		// The Imp dying wins it for good too; both are listed.
		expect(ends(cast, steps).ends.map((e) => [e.rule, e.winner])).toEqual([
			['demon-dead', 'good'],
			['fearmonger', 'good']
		]);
	});
});

describe('Summoner (https://wiki.bloodontheclocktower.com/Summoner)', () => {
	const cast = ['washerwoman', 'chef', 'empath', 'monk', 'summoner'];

	it('no Demon yet: the game goes on while the Summoner lives', () => {
		expect(ends(cast).ends).toEqual([]);
	});

	it('the Summoner dies before summoning: good wins', () => {
		expect(ends(cast, [newDay, execute(4)]).ends).toMatchObject([
			{ rule: 'summoner', winner: 'good' }
		]);
	});
});

describe('Heretic (https://wiki.bloodontheclocktower.com/Heretic)', () => {
	const cast = ['washerwoman', 'saint', 'heretic', 'monk', 'poisoner', 'imp'];

	it('flips the result, even when dead', () => {
		const { ends: e, seats } = ends(cast, [dead(2), execute(1)]);
		expect(e).toMatchObject([
			{ rule: 'saint', winner: 'good', flippedBy: { characterId: 'heretic', seatId: seats[2] } }
		]);
		expect(suggestedWinner(e)).toBe('good');
	});

	it('poisoned: no flip', () => {
		const e = ends(cast, [remind(2, 'poisoner', 'Poisoned'), execute(5)]).ends;
		expect(e).toMatchObject([{ rule: 'demon-dead', winner: 'good' }]);
		expect(e[0].flippedBy).toBeUndefined();
	});
});

describe('suggestedWinner', () => {
	it('is undefined when the ends disagree', () => {
		const cast = ['washerwoman', 'saint', 'empath', 'monk', 'poisoner', 'imp'];
		const e = ends(cast, [execute(1), dead(5, 'slayer')]).ends;
		expect(e.map((x) => x.winner)).toEqual(['good', 'evil']);
		expect(suggestedWinner(e)).toBeUndefined();
		expect(suggestedWinner([])).toBeUndefined();
	});
});

describe('promptable', () => {
	it('leaves out ends that may not end the game', () => {
		const cast = ['washerwoman', 'saint', 'empath', 'monk', 'mastermind', 'imp'];
		const held = ends(cast, [newDay, execute(5)]).ends;
		expect(promptable(held)).toEqual([]);
		const both = ends(cast, [newDay, execute(5), dead(1, 'execution')]).ends;
		expect(promptable(both).map((e) => e.rule)).toEqual(['saint']);
	});
});
