/**
 * Reading the jinx format (`jinx-read.ts`): M44's conditions and verb shapes. The shapes are
 * the app's own, not the wiki's; what each does is tested through its reader in
 * `rules/script-jinxes.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { readJinxRules } from './jinx-read.ts';
import { Issues } from './validate.ts';

/** One jinx entry with `chef` read, and its issues. */
function read(entry: unknown) {
	const issues = new Issues();
	const rules = readJinxRules({ chef: entry }, 'jinxes', issues)?.chef;
	return { rules, issues: issues.list };
}

describe('readJinxRules (M44)', () => {
	it('reads not, a dead or executed player, and a third character', () => {
		const when = [
			'self-dead',
			'partner-executed',
			{ not: 'partner-alive' },
			{ not: { inPlay: 'saint' } },
			{ alive: 'mayor' }
		];
		expect(read({ impairs: { kind: 'drunk', when } })).toEqual({
			rules: { impairs: { kind: 'drunk', when } },
			issues: []
		});
		expect(read({ impairs: { kind: 'drunk', when: [{ not: 'sleepy' }] } }).issues).toContain(
			'jinxes.chef.impairs.when[0].not: unknown condition "sleepy"'
		);
		expect(read({ impairs: { kind: 'drunk', when: [{ alive: 3 }] } }).rules).toBeUndefined();
	});

	it('reads cannotChoose, a redirect, and a learned character', () => {
		expect(read({ cannotChoose: true }).rules).toEqual({ cannotChoose: {} });
		expect(read({ cannotChoose: { who: 'partner' } }).rules).toEqual({
			cannotChoose: { who: 'partner' }
		});
		expect(read({ storytellerChooses: 'another-player' }).rules).toEqual({
			storytellerChooses: { what: 'another-player' }
		});
		expect(
			read({ storytellerChooses: { what: 'another-player', creating: 'partner' } }).rules
		).toBeUndefined();
		expect(read({ learns: { what: 'character', when: ['partner-executed'] } }).rules).toEqual({
			learns: { what: 'character', when: ['partner-executed'] }
		});
	});

	it('takes a token on noKill only when the kill stops on a choice', () => {
		expect(read({ noKill: { on: 'chosen' } }).rules).toEqual({ noKill: { on: 'chosen' } });
		expect(read({ noKill: { on: 'chosen', token: 'Lit' } }).rules).toEqual({
			noKill: { on: 'chosen', token: 'Lit' }
		});
		expect(read({ noKill: { on: 'token', token: 'Lit' } }).issues).toContain(
			'jinxes.chef.noKill.token: only with `on: "chosen"`'
		);
	});

	it('reads an executed end, and a day left out only on the final day', () => {
		expect(read({ endsGame: { kind: 'executed', winner: 'good', player: 'partner' } })).toEqual({
			rules: { endsGame: { kind: 'executed', winner: 'good', player: 'partner' } },
			issues: []
		});
		expect(read({ endsGame: { kind: 'executed', winner: 'good', token: 'Lit' } }).rules).toBe(
			undefined
		);
		const final = { kind: 'day-without-execution', winner: 'good', when: ['final-day'] };
		expect(read({ endsGame: final }).rules).toEqual({ endsGame: final });
		const noDay = { kind: 'day-without-execution', winner: 'good' };
		expect(read({ endsGame: noDay }).issues).toContain('jinxes.chef.endsGame.day: missing');
	});
});
