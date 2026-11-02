/**
 * Acting twice (M15c, the `actsTwice` part): https://wiki.bloodontheclocktower.com/Barista,
 * Summary and How to Run. A player marked to act twice wakes again for each of their night
 * steps, may use a day ability one more time (twice if not yet used, once more if already
 * spent) until dusk, and last night's token does nothing before tonight's is placed.
 */
import { describe, expect, it } from 'vitest';
import { Issues } from '#lib/core/data/validate.ts';
import { actsTwice as actsTwicePart } from '#lib/core/data/parts/acts-twice.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { EngineWarning } from '#lib/core/engine/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { actsTwice, actsTwiceSource, dayUsesAllowed, withActsTwiceSteps } from './acts-twice.ts';
import { nightStepAlerts } from './night-alerts.ts';
import { withNightInfo } from './night-info.ts';
import { nightOrder, type Night } from './night-order.ts';
import { wakeConditionMet } from './wakes-when.ts';

const data = committedGameData();

/** Tonight's steps for a scenario, as the board builds them, with the second wakes added. */
function steps(s: Scenario, night: Night = 'other') {
	const inPlay = s.game.seating.map((seat) => data.byId.get(s.game.seats[seat].characterId!)!);
	const order = nightOrder({ night, sheet: data.nightSheet, inPlay, players: inPlay.length });
	return withActsTwiceSteps(withNightInfo(order.steps, s.game, s.characters), s.game, s.characters);
}

const ids = (s: Scenario, night?: Night) => steps(s, night).map((step) => step.id);
const warnings = (s: Scenario): string[] =>
	((s.session as { warnings?: EngineWarning[] }).warnings ?? []).map((w) => w.code);

describe('actsTwice part', () => {
	it('is read from the rules block, naming one of the character’s own reminders', () => {
		expect(rulesOf('barista')?.actsTwice).toEqual({ token: 'Acts Twice' });
		const issues = new Issues();
		const block = { actsTwice: { token: 'Nope' } };
		expect(actsTwicePart.read(block, 'actsTwice', 'rules', issues, ['Acts Twice'])).toBeUndefined();
		expect(issues.list).toEqual(['rules.actsTwice.token: not one of this character’s reminders']);
	});

	it('needs a token', () => {
		const issues = new Issues();
		expect(actsTwicePart.read({ actsTwice: {} }, 'actsTwice', 'rules', issues, [])).toBeUndefined();
		expect(issues.list).toEqual(['rules.actsTwice.token: missing']);
	});
});

describe('actsTwiceSource', () => {
	it('names the token and its character, working while that ability works', () => {
		const s = scenario(['barista', 'witch', 'imp', 'chef', 'poisoner']).reminder(
			'witch',
			'barista',
			'Acts Twice'
		);
		expect(actsTwiceSource(s.game, s.seat('witch'), s.characters)).toMatchObject({
			characterId: 'barista',
			seatId: s.seat('barista'),
			works: true
		});
		expect(actsTwice(s.game, s.seat('chef'), s.characters)).toBe(false);
		const poisoned = s.poisoned('barista');
		expect(actsTwiceSource(poisoned.game, poisoned.seat('witch'), s.characters)?.works).toBe(false);
		expect(actsTwice(poisoned.game, poisoned.seat('witch'), s.characters)).toBe(false);
	});

	it('ignores the Barista’s other tokens', () => {
		const s = scenario(['barista', 'witch', 'imp']).reminder('witch', 'barista', 'Sober & Healthy');
		expect(actsTwiceSource(s.game, s.seat('witch'), s.characters)).toBeUndefined();
	});
});

describe('withActsTwiceSteps', () => {
	it('wakes the player again straight after their step, for that seat alone', () => {
		const s = scenario(['barista', 'witch', 'imp', 'chef', 'empath']).reminder(
			'witch',
			'barista',
			'Acts Twice'
		);
		const all = steps(s);
		const at = all.findIndex((step) => step.id === 'witch');
		expect(all[at + 1]).toMatchObject({
			id: `witch:again:${s.seat('witch')}`,
			character: { id: 'witch' },
			again: { seatId: s.seat('witch'), characterId: 'barista' }
		});
		expect(all.filter((step) => step.character?.id === 'witch')).toHaveLength(2);
		// Nobody else wakes twice.
		expect(all.filter((step) => step.again)).toHaveLength(1);
	});

	it('gives information again on the second wake', () => {
		const s = scenario(['barista', 'empath', 'imp', 'chef', 'witch']).reminder(
			'empath',
			'barista',
			'Acts Twice'
		);
		const all = steps(s);
		const first = all.find((step) => step.id === 'empath')!;
		const again = all.find((step) => step.again?.seatId === s.seat('empath'))!;
		expect(again.info).toEqual(first.info);
	});

	it('changes nothing without the token, or while the Barista is poisoned', () => {
		const s = scenario(['barista', 'witch', 'imp', 'chef', 'poisoner']);
		expect(ids(s)).not.toContain(`witch:again:${s.seat('witch')}`);
		const poisoned = s.reminder('witch', 'barista', 'Acts Twice').poisoned('barista');
		expect(steps(poisoned).some((step) => step.again)).toBe(false);
	});

	it('does not double a step before the Barista’s tonight: that is last night’s token', () => {
		// The Wraith wakes before the Barista on other nights (TPI's night sheet).
		const s = scenario(['barista', 'wraith', 'imp', 'chef']).reminder(
			'wraith',
			'barista',
			'Acts Twice'
		);
		expect(steps(s).some((step) => step.again)).toBe(false);
	});

	it('doubles a step when the token’s character has no step tonight', () => {
		// The Barista exiled and gone from the night: the Storyteller judges the token left on.
		const s = scenario(['witch', 'imp', 'chef']).reminder('witch', 'barista', 'Acts Twice');
		expect(ids(s)).toContain(`witch:again:${s.seat('witch')}`);
	});

	it('works on the first night too', () => {
		const s = scenario(['barista', 'poisoner', 'imp', 'chef']).reminder(
			'poisoner',
			'barista',
			'Acts Twice'
		);
		expect(ids(s, 'first')).toContain(`poisoner:again:${s.seat('poisoner')}`);
	});
});

describe('night alerts', () => {
	it('says at the step that the player acts twice, and whether the token works', () => {
		const s = scenario(['barista', 'witch', 'imp', 'poisoner']).reminder(
			'witch',
			'barista',
			'Acts Twice'
		);
		expect(nightStepAlerts(s.game, 'witch', s.characters)).toContainEqual(
			expect.objectContaining({
				kind: 'acts-twice',
				seatId: s.seat('witch'),
				source: expect.objectContaining({ characterId: 'barista', seatId: s.seat('barista') }),
				works: true
			})
		);
		const poisoned = s.poisoned('barista');
		expect(nightStepAlerts(poisoned.game, 'witch', s.characters)).toContainEqual(
			expect.objectContaining({ kind: 'acts-twice', works: false })
		);
	});
});

describe('once per game abilities', () => {
	it('wakes a spent Seamstress while she acts twice', () => {
		const spent = scenario(['seamstress', 'barista', 'imp']).reminder(
			'seamstress',
			'seamstress',
			'No Ability'
		);
		const wakes = (s: Scenario) =>
			wakeConditionMet(s.game, 'seamstress', s.seat('seamstress'), s.characters, new Set());
		expect(wakes(spent)).toBe(false);
		expect(wakes(spent.reminder('seamstress', 'barista', 'Acts Twice'))).toBe(true);
	});

	it('allows two day uses, or one more when spent before today', () => {
		const s = scenario(['slayer', 'barista', 'imp']);
		const slayer = s.seat('slayer');
		expect(dayUsesAllowed(s.game, slayer, s.characters, false)).toBe(1);
		expect(dayUsesAllowed(s.game, slayer, s.characters, true)).toBe(0);
		const twice = s.reminder('slayer', 'barista', 'Acts Twice');
		expect(dayUsesAllowed(twice.game, slayer, s.characters, false)).toBe(2);
		expect(dayUsesAllowed(twice.game, slayer, s.characters, true)).toBe(1);
	});

	const use = (s: Scenario, ref: string) =>
		s.do({ type: 'UseAbility', seatId: s.seat(ref), characterId: ref });

	it('lets a Slayer acting twice shoot twice in a day, with one No Ability token', () => {
		const s = scenario(['slayer', 'barista', 'imp', 'chef']).reminder(
			'slayer',
			'barista',
			'Acts Twice'
		);
		const once = use(s, 'slayer');
		const again = use(once, 'slayer');
		expect(warnings(again)).toEqual([]);
		expect(
			again.game.seats[s.seat('slayer')].reminders.filter((r) => r.label === 'No Ability')
		).toHaveLength(1);
		expect(warnings(use(again, 'slayer'))).toEqual(['already-used']);
	});

	it('lets a Slayer spent on an earlier day shoot once more while acting twice', () => {
		const spent = use(scenario(['slayer', 'barista', 'imp', 'chef']), 'slayer').newDay();
		expect(warnings(use(spent, 'slayer'))).toEqual(['already-used']);
		const twice = spent.reminder('slayer', 'barista', 'Acts Twice');
		const more = use(twice, 'slayer');
		expect(warnings(more)).toEqual([]);
		expect(warnings(use(more, 'slayer'))).toEqual(['already-used']);
	});

	it('warns on a second use without the token', () => {
		const once = use(scenario(['slayer', 'barista', 'imp']), 'slayer');
		expect(warnings(use(once, 'slayer'))).toEqual(['already-used']);
	});
});
