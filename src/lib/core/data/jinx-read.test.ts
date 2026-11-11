/**
 * Reading the jinx format (`jinx-read.ts`): M44's conditions and verb shapes. The shapes are
 * the app's own, not the wiki's; what each does is tested through its reader in
 * `rules/jinxes/script-jinxes.test.ts`.
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
		expect(read({ trueInfo: { when } })).toEqual({
			rules: { trueInfo: { when } },
			issues: []
		});
		expect(read({ trueInfo: { when: [{ not: 'sleepy' }] } }).issues).toContain(
			'jinxes.chef.trueInfo.when[0].not: unknown condition "sleepy"'
		);
		expect(read({ trueInfo: { when: [{ alive: 3 }] } }).rules).toBeUndefined();
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
			rules: {
				endsGame: {
					kind: 'condition',
					preset: 'executed',
					event: 'executed',
					subject: 'partner',
					winner: 'good'
				}
			},
			issues: []
		});
		expect(read({ endsGame: { kind: 'executed', winner: 'good', token: 'Lit' } }).rules).toBe(
			undefined
		);
		const final = { kind: 'day-without-execution', winner: 'good', when: ['final-day'] };
		expect(read({ endsGame: final }).rules).toEqual({
			endsGame: {
				...final,
				kind: 'condition',
				preset: 'day-without-execution',
				event: 'day-ends',
				noExecution: true,
				bothAlive: true
			}
		});
		const noDay = { kind: 'day-without-execution', winner: 'good' };
		expect(read({ endsGame: noDay }).issues).toContain('jinxes.chef.endsGame.day: missing');
	});
});

describe('jinx condition ends (M78)', () => {
	it('reads an event about whose players, and refuses fields its event does not take', () => {
		const end = {
			kind: 'condition',
			event: 'executed',
			subject: 'marked',
			token: 'Lit',
			nominatedBySelf: true,
			winner: 'evil'
		};
		expect(read({ endsGame: end })).toEqual({ rules: { endsGame: end }, issues: [] });
		expect(
			read({ endsGame: { kind: 'condition', event: 'executed', winner: 'good' } }).issues
		).toContain('jinxes.chef.endsGame.subject: missing');
		expect(
			read({
				endsGame: { kind: 'condition', event: 'day-ends', winner: 'good', stops: true }
			}).issues
		).toContain('jinxes.chef.endsGame.stops: only with event `ability-used`');
		expect(
			read({
				endsGame: {
					kind: 'condition',
					event: 'executed',
					subject: 'self',
					token: 'Lit',
					winner: 'good'
				}
			}).issues
		).toContain('jinxes.chef.endsGame.token: only with subject `marked`');
	});
});

describe('readJinxRules (M46)', () => {
	it('reads a protection, its coverage defaulting to any', () => {
		expect(read({ protects: { who: 'partner', by: 'partner' } }).rules).toEqual({
			protects: { who: 'partner', from: 'any', by: 'partner' }
		});
		expect(read({ protects: { from: 'demon', night: true } }).rules).toEqual({
			protects: { from: 'demon', night: true }
		});
		expect(read({ protects: { from: 'everything' } }).rules).toBeUndefined();
	});

	it('reads the general shapes, and refuses their parts out of place', () => {
		const fine: Record<string, unknown>[] = [
			{ notShown: { what: 'partner-seat' } },
			{ wakes: { how: 'one-by-one' } },
			{ survives: { on: 'carrier-executed' } },
			{ keepsAbility: { afterDeath: true } },
			{ voter: { countsOnlyWith: true } },
			{ changesCharacter: { token: 'Night 2' } },
			{ alsoBecomes: { type: 'minion', players: 'neighbours' } },
			{ givenInstead: { instead: 'becomes', type: 'outsider', upTo: 2 } },
			{ storytellerChooses: { what: 'player', via: 'carrierIsDemon' } },
			{ noKill: { killer: 'demon', when: ['nominated-partner', 'partner-dead'] } },
			{ endsGame: { kind: 'night-instead', chooser: 'self' } },
			{ endsGame: { kind: 'gained-end', end: 'dead-without-demon', winner: 'evil' } }
		];
		for (const entry of fine)
			expect(read(entry), JSON.stringify(entry)).toMatchObject({ issues: [] });
		const refused: Record<string, unknown>[] = [
			{ givenInstead: { instead: 'a-minion', type: 'outsider' } },
			{ givenInstead: { instead: 'becomes', upTo: 2 } },
			{ noKill: { killer: 'demon' } },
			{ noKill: { killer: 'demon', on: 'chosen', when: ['partner-dead'] } },
			{ endsGame: { kind: 'night-instead', winner: 'good' } },
			{ endsGame: { kind: 'gained-end', winner: 'evil' } },
			{ keepsAbility: { afterDeath: false } }
		];
		for (const entry of refused)
			expect(read(entry).issues.length, JSON.stringify(entry)).toBeGreaterThan(0);
	});
});
