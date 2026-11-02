/**
 * Setup alignment changes (M22): the Bounty Hunter's "[1 Townsfolk is evil]".
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Bounty_Hunter (How to Run: one Townsfolk token
 * is turned upside down at setup; Examples: a Drunk who thinks they are the Bounty Hunter
 * adds no evil Townsfolk).
 * Wiki: https://wiki.bloodontheclocktower.com/Glossary (Alignment: players know their own).
 * Wiki: https://wiki.bloodontheclocktower.com/Kazali (Related Jinxes: a Bounty Hunter turned
 * into a Minion creates no evil Townsfolk).
 */
import { describe, expect, it } from 'vitest';
import type { Character } from '#lib/core/data/types.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { nightOrder } from './night-order.ts';
import { withNightInfo } from './night-info.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import {
	pendingSetupAlignments,
	SETUP_ALIGNMENT_STEP,
	setupAlignmentTasks
} from './setup-alignment.ts';
import { modifierFromText } from './setup-modifiers.ts';

const CAST = ['bountyhunter', 'chef', 'empath', 'imp', 'poisoner'];

function firstNightSteps(s: ReturnType<typeof scenario>) {
	const data = committedGameData();
	const inPlay = s.game.seating.flatMap((id) => {
		const c = s.characters.get(s.game.seats[id].characterId ?? '');
		return c ? [c] : [];
	});
	const { steps } = nightOrder({
		night: 'first',
		sheet: data.nightSheet,
		official: data.byId,
		inPlay,
		players: inPlay.length
	});
	return withNightInfo(steps, s.game, s.characters, 'first');
}

describe('Bounty Hunter: 1 Townsfolk is evil', () => {
	it('asks for one evil Townsfolk, any Townsfolk being a candidate', () => {
		const s = scenario(CAST);
		const [task] = setupAlignmentTasks(s.game, s.characters);
		expect(task).toMatchObject({
			characterId: 'bountyhunter',
			type: 'townsfolk',
			alignment: 'evil',
			count: 1,
			seats: [],
			done: false
		});
		expect(task.candidates).toEqual([s.seat('bountyhunter'), s.seat('chef'), s.seat('empath')]);
		expect(pendingSetupAlignments(s.game, s.characters)).toHaveLength(1);
	});

	it('is done once a Townsfolk is evil', () => {
		const s = scenario(CAST).do((at) => ({
			type: 'SetAlignment',
			seatId: at.seat('chef'),
			alignment: 'evil'
		}));
		const [task] = setupAlignmentTasks(s.game, s.characters);
		expect(task.done).toBe(true);
		expect(task.seats).toEqual([s.seat('chef')]);
		expect(pendingSetupAlignments(s.game, s.characters)).toEqual([]);
	});

	it('asks nothing when the Bounty Hunter is really the Drunk', () => {
		const s = scenario(CAST).drunk('bountyhunter');
		expect(setupAlignmentTasks(s.game, s.characters)).toEqual([]);
	});

	it('asks nothing once the Kazali has made the Bounty Hunter a Minion', () => {
		const s = scenario(CAST).becomes('bountyhunter', 'poisoner', 'evil');
		expect(setupAlignmentTasks(s.game, s.characters)).toEqual([]);
	});

	it('asks nothing without the Bounty Hunter', () => {
		const s = scenario(['chef', 'empath', 'imp', 'poisoner', 'monk']);
		expect(setupAlignmentTasks(s.game, s.characters)).toEqual([]);
	});

	it('wakes the evil Townsfolk right after Dusk on the first night', () => {
		const s = scenario(CAST).do((at) => ({
			type: 'SetAlignment',
			seatId: at.seat('empath'),
			alignment: 'evil'
		}));
		const steps = firstNightSteps(s);
		const at = steps.findIndex((step) => step.id === SETUP_ALIGNMENT_STEP);
		expect(steps[at - 1]?.id).toBe('dusk');
		expect(steps[at].setupAlignments?.[0].seats).toEqual([s.seat('empath')]);
	});

	it('opens the first night with the pick when no Townsfolk is evil yet', () => {
		const s = scenario(CAST);
		const step = firstNightSteps(s).find((x) => x.id === SETUP_ALIGNMENT_STEP);
		expect(step?.setupAlignments?.[0].done).toBe(false);
	});

	it('adds no step on other nights', () => {
		const s = scenario(CAST);
		const steps = withNightInfo([], s.game, s.characters, 'other');
		expect(steps.some((x) => x.id === SETUP_ALIGNMENT_STEP)).toBe(false);
	});
});

describe('custom characters', () => {
	it('read "[1 Townsfolk is evil]" from their bracket text', () => {
		const character: Character = {
			id: 'hb',
			name: 'Homebrew',
			type: 'townsfolk',
			ability: 'You start knowing something. [1 Townsfolk is evil]',
			setup: true,
			reminders: [],
			remindersGlobal: [],
			special: []
		};
		const modifier = modifierFromText(character)!;
		expect(modifier.alignments).toEqual([{ type: 'townsfolk', alignment: 'evil', count: 1 }]);
		expect(modifier.notes).toEqual([]);
	});
});
