import { describe, expect, it } from 'vitest';
import type { CharacterId } from '#lib/core/data/index.ts';
import { testCharacters } from '#lib/core/model/fixtures.test-support.ts';
import { ruleStacks } from './rule-stacks.ts';

const ids = (...names: string[]) => names as CharacterId[];

// Fabled and Loric are separate character types
// (https://wiki.bloodontheclocktower.com/Fabled, https://wiki.bloodontheclocktower.com/Loric).
describe('ruleStacks', () => {
	it('puts the Fabled in one stack and the Loric in another, Fabled first', () => {
		expect(ruleStacks(ids('bootlegger', 'angel', 'djinn'), testCharacters)).toEqual([
			{ kind: 'fabled', label: 'Fabled', ids: ['angel', 'djinn'] },
			{ kind: 'loric', label: 'Loric', ids: ['bootlegger'] }
		]);
	});

	it('leaves out an empty stack', () => {
		expect(ruleStacks(ids('angel'), testCharacters).map((s) => s.kind)).toEqual(['fabled']);
		expect(ruleStacks(ids('bootlegger'), testCharacters).map((s) => s.kind)).toEqual(['loric']);
		expect(ruleStacks([], testCharacters)).toEqual([]);
	});
});
