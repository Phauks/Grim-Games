/**
 * Executed instead (`execution.insteadOf`): the Scapegoat may be executed in place of a player
 * of its alignment, only while it lives and its ability works
 * (https://wiki.bloodontheclocktower.com/Scapegoat).
 */
import { describe, expect, it } from 'vitest';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { executedInstead, insteadCandidates } from './executed-instead.ts';

describe('executedInstead', () => {
	const base = scenario(['chef', 'empath', 'poisoner', 'imp', 'scapegoat']).becomes(
		'scapegoat',
		'scapegoat',
		'good'
	);

	it('lists a living Scapegoat, and none once it is dead', () => {
		expect(insteadCandidates(base.game, base.characters)).toEqual([
			{ seatId: base.seat('scapegoat'), characterId: 'scapegoat' }
		]);
		const dead = base.dies('scapegoat');
		expect(insteadCandidates(dead.game, dead.characters)).toEqual([]);
		expect(executedInstead(dead.game, dead.seat('chef'), dead.characters)).toEqual([]);
	});

	it('offers nothing for the Scapegoat itself, or while it is poisoned', () => {
		expect(executedInstead(base.game, base.seat('scapegoat'), base.characters)).toEqual([]);
		const poisoned = base.poisoned('scapegoat');
		expect(executedInstead(poisoned.game, poisoned.seat('chef'), poisoned.characters)).toEqual([]);
	});

	it('reads insteadOf', () => {
		const issues = new Issues();
		expect(
			parseCharacterRules({ execution: { insteadOf: 'same-alignment' } }, 'x', issues)?.execution
		).toEqual({ insteadOf: 'same-alignment' });
		parseCharacterRules({ execution: { insteadOf: 'anyone' } }, 'y', issues);
		expect(issues.list).toEqual(['y.execution.insteadOf: unknown value "anyone"']);
	});
});
