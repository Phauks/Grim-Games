import { describe, expect, it } from 'vitest';
import type { TargetRule } from '#lib/core/rules/reminder-targets.ts';
import { describeTarget as describe_, reminderTargetLabel } from './reminder-target-label.ts';

/** A rule's words; the note is only for the board's sheet. */
const describeTarget = (rule: Omit<TargetRule, 'note'>, nameOf: (id: string) => string) =>
	describe_({ ...rule, note: '' }, nameOf);

const nameOf = (id: string) => ({ imp: 'Imp', recluse: 'Recluse' })[id] ?? id;

describe('reminder target labels', () => {
	// https://wiki.bloodontheclocktower.com/Fortune_Teller: the red herring is a good player.
	it('reads the board rules for a real reminder', () => {
		expect(reminderTargetLabel('fortuneteller', 'Red Herring', nameOf)).toBe('Good players');
		// https://wiki.bloodontheclocktower.com/Washerwoman: shown a Townsfolk, who may be
		// themself (Trevor, 2026-10-23).
		expect(reminderTargetLabel('washerwoman', 'Townsfolk', nameOf)).toBe('Townsfolk');
		// https://wiki.bloodontheclocktower.com/Professor: never brings themself back.
		expect(reminderTargetLabel('professor', 'Alive', nameOf)).toBe('Dead Townsfolk, not self');
	});

	it('has no words for a reminder without a rule', () => {
		expect(reminderTargetLabel('washerwoman', 'Made up', nameOf)).toBeUndefined();
		expect(reminderTargetLabel('not-a-character', 'Anything', nameOf)).toBeUndefined();
	});

	it('describes each part of a rule', () => {
		expect(describeTarget({ global: true }, nameOf)).toBe('Not on a player');
		expect(describeTarget({ seat: 'self' }, nameOf)).toBe('Self');
		expect(describeTarget({ seat: 'any' }, nameOf)).toBe('Any player');
		expect(describeTarget({ seat: 'other' }, nameOf)).toBe('Players, not self');
		expect(describeTarget({ life: 'dead', alignment: 'evil' }, nameOf)).toBe('Dead evil players');
		expect(describeTarget({ characters: ['imp', 'recluse'] }, nameOf)).toBe('Imp or Recluse');
		expect(describeTarget({ types: ['minion', 'demon'], alignment: 'opposite' }, nameOf)).toBe(
			'Minions or Demons, opposite alignment'
		);
		expect(
			describeTarget({ neighbour: { of: 'self', alive: true }, withLabel: 'Safe' }, nameOf)
		).toBe('Players, neighbours, skipping the dead, with Safe');
		// https://wiki.bloodontheclocktower.com/No_Dashii: its nearest Townsfolk each way round.
		expect(reminderTargetLabel('nodashii', 'Poisoned', nameOf)).toBe(
			'Townsfolk, nearest each side'
		);
		expect(describeTarget({ neighbour: { of: 'self', type: 'outsider' } }, nameOf)).toBe(
			'Players, nearest Outsiders each side'
		);
		expect(describeTarget({ notWithLabel: 'Poisoned' }, nameOf)).toBe('Players, not with Poisoned');
	});
});
