/**
 * Special rules changed on Character selection before the game begins (Trevor, 2026-10-29):
 * the game's script follows them as it would have had they been chosen on New game.
 */
import { describe, expect, it } from 'vitest';
import type { Script } from '#lib/core/data/types.ts';
import { scriptForRules } from './rule-script.ts';
import { SPECIAL_RULE_FORMAT, type SpecialRule } from './types.ts';

const rule = (id: string, parts: SpecialRule['parts']): SpecialRule => ({
	kind: 'special-rule',
	format: SPECIAL_RULE_FORMAT,
	id,
	name: id,
	sources: [],
	parts
});

const script: Script = {
	meta: { name: 'Test', bootlegger: ['The script’s own rule.'] },
	entries: [
		{ kind: 'official', id: 'chef' },
		{ kind: 'official', id: 'imp' }
	]
};

describe('scriptForRules', () => {
	it('swaps the old rules’ lines for the new ones’, keeping the script’s own', () => {
		const a = rule('a', { text: ['Rule A.'] });
		const b = rule('b', { text: ['Rule B.'] });
		const withA = scriptForRules(script, [], [a]);
		expect(withA.meta?.bootlegger).toEqual(['The script’s own rule.', 'Rule A.']);
		const withB = scriptForRules(withA, [a], [b]);
		expect(withB.meta?.bootlegger).toEqual(['The script’s own rule.', 'Rule B.']);
		expect(scriptForRules(withB, [b], []).meta?.bootlegger).toEqual(['The script’s own rule.']);
	});

	it('leaves no Bootlegger lines on a script that had none once every rule is off', () => {
		const plain: Script = { meta: { name: 'Plain' }, entries: script.entries };
		const a = rule('a', { text: ['Rule A.'] });
		const off = scriptForRules(scriptForRules(plain, [], [a]), [a], []);
		expect(off.meta).toEqual({ name: 'Plain' });
	});

	it('takes out what a new rule bans and adds what it always puts on the script', () => {
		const ban = rule('ban', { restricted: { banned: ['chef'] } });
		const force = rule('force', { forced: { onScript: ['baron'], inPlay: ['drunk'] } });
		const out = scriptForRules(script, [], [ban, force]);
		expect(out.entries).toEqual([
			{ kind: 'official', id: 'imp' },
			{ kind: 'official', id: 'baron' },
			{ kind: 'official', id: 'drunk' }
		]);
	});
});
