/**
 * Special rules on the board:
 * - The Phantom Detectives (https://schnauzerclub.neocities.org/scripts/thephantomdetectives):
 *   the dead keep their abilities except Demons; living Townsfolk have none.
 * - Trained Killer (https://beardytas.com/garden-of-djinn/trained-killer/): the Demon attacks
 *   the next living in-play character in script order, carrying on from the furthest reached.
 * - The Warrens (https://beardytas.com/garden-of-djinn/the-warrens/): while 5 or more live, an
 *   evil player nominating a living evil player (not Travellers) swaps characters with them.
 * - The Djinn's Bargain (https://beardytas.com/garden-of-djinn/the-djinns-bargain/): a
 *   nominator may choose to die; the page bars it while only 3 live (a switch here).
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { hasAbilityUnder, nextScriptOrderTarget, nominationPrompts } from './rule-effects.ts';
import { DJINNS_BARGAIN } from './rules/djinns-bargain.ts';
import { WARRENS } from './rules/warrens.ts';
import { PHANTOM_DETECTIVES } from './rules/phantom-detectives.ts';

const rule = PHANTOM_DETECTIVES.parts.abilities;

describe('The Phantom Detectives', () => {
	it('living Townsfolk have no ability; other living players do', () => {
		expect(hasAbilityUnder(rule, false, 'townsfolk')).toBe(false);
		expect(hasAbilityUnder(rule, false, 'minion')).toBe(true);
		expect(hasAbilityUnder(rule, false, 'outsider')).toBe(true);
	});

	it('the dead keep their abilities, except Demons', () => {
		expect(hasAbilityUnder(rule, true, 'townsfolk')).toBe(true);
		expect(hasAbilityUnder(rule, true, 'minion')).toBe(true);
		expect(hasAbilityUnder(rule, true, 'demon')).toBe(false);
	});

	it('without the rule, only the living have abilities', () => {
		expect(hasAbilityUnder(undefined, false, 'townsfolk')).toBe(true);
		expect(hasAbilityUnder(undefined, true, 'minion')).toBe(false);
	});
});

describe('Trained Killer', () => {
	const killed =
		(i: number) =>
		(s: string[]): Command => ({ type: 'SetDead', seatId: s[i], dead: true, cause: 'demon' });
	const executed =
		(i: number) =>
		(s: string[]): Command => ({ type: 'SetDead', seatId: s[i], dead: true, cause: 'execution' });
	const target = (cast: string[], ...steps: ((s: string[]) => Command)[]) => {
		const { session, seats } = castGame(cast, ...steps);
		const at = nextScriptOrderTarget(session.game, characters);
		return at === undefined ? undefined : seats.indexOf(at);
	};
	// The test script's order: washerwoman, librarian, investigator, chef, empath... (fixtures).
	const cast = ['imp', 'chef', 'empath', 'washerwoman', 'poisoner'];

	it('starts from the top of the script, passing over the Demon', () => {
		expect(target(cast)).toBe(3);
	});

	it('carries on after the last character the Demon killed', () => {
		expect(target(cast, killed(3))).toBe(1);
		expect(target(cast, killed(3), killed(1))).toBe(2);
	});

	it('an execution moves nothing on; the dead are passed over', () => {
		expect(target(cast, executed(3))).toBe(1);
	});

	it('wraps round to the top past the last character', () => {
		expect(target(cast, killed(4))).toBe(3);
	});
});

describe('nominations under The Warrens and The Djinn’s Bargain', () => {
	const dead =
		(i: number) =>
		(s: string[]): Command => ({ type: 'SetDead', seatId: s[i], dead: true });
	const prompts = (
		cast: string[],
		nominator: number,
		nominee: number,
		rules = [WARRENS, DJINNS_BARGAIN],
		...steps: ((s: string[]) => Command)[]
	) => {
		const { session, seats } = castGame(cast, ...steps);
		return nominationPrompts(
			session.game,
			{ nominator: seats[nominator], nominee: seats[nominee] },
			rules,
			characters
		).map((p) => p.kind);
	};
	const cast = ['imp', 'poisoner', 'chef', 'empath', 'washerwoman'];

	it('swaps an evil nominator and a living evil nominee while 5 live', () => {
		expect(prompts(cast, 1, 0)).toEqual(['evil-swap', 'nominator-may-die']);
	});

	it('swaps no one when either is good, or under 5 live', () => {
		expect(prompts(cast, 1, 2)).toEqual(['nominator-may-die']);
		expect(prompts(cast, 2, 0)).toEqual(['nominator-may-die']);
		expect(prompts(cast, 1, 0, [WARRENS], dead(4))).toEqual([]);
	});

	it('leaves out a Traveller', () => {
		const withTraveller = [...cast, 'scapegoat'];
		const evil = (s: string[]): Command => ({
			type: 'SetAlignment',
			seatId: s[5],
			alignment: 'evil'
		});
		expect(prompts(withTraveller, 1, 5, [WARRENS], evil)).toEqual([]);
	});

	it('lets a living nominator choose to die, unless a limit says too few live', () => {
		expect(prompts(cast, 2, 3, [DJINNS_BARGAIN], dead(4), dead(3))).toEqual(['nominator-may-die']);
		const limited = {
			...DJINNS_BARGAIN,
			parts: { nominations: [{ kind: 'nominator-may-die' as const, minAlive: 4 }] }
		};
		expect(prompts(cast, 2, 0, [limited], dead(4), dead(3))).toEqual([]);
		expect(prompts(cast, 2, 0, [limited], dead(4))).toEqual(['nominator-may-die']);
	});
});
