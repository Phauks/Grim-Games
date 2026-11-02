/**
 * Exploding when executed (`execution.explodes`): executing the Boomdandy, while its ability
 * works, leaves only 3 players alive, then the pointing
 * (https://wiki.bloodontheclocktower.com/Boomdandy).
 */
import { describe, expect, it } from 'vitest';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { explosionOf, survivorsLackDemon } from './explosion.ts';

describe('explosionOf', () => {
	const base = scenario(['boomdandy', 'imp', 'chef', 'empath', 'monk']);

	it('explodes for a living Boomdandy, not a dead one, and not for others', () => {
		const boom = { characterId: 'boomdandy', survivors: 3 };
		expect(explosionOf(base.game, base.seat('boomdandy'), base.characters)).toEqual(boom);
		const dead = base.dies('boomdandy');
		expect(explosionOf(dead.game, dead.seat('boomdandy'), dead.characters)).toBeUndefined();
		expect(explosionOf(base.game, base.seat('chef'), base.characters)).toBeUndefined();
	});

	it('does not explode while poisoned or for a Drunk who thinks they are the Boomdandy', () => {
		// A Poisoned token needs a Poisoner in play (https://wiki.bloodontheclocktower.com/Poisoner).
		const poisoned = base.becomes('monk', 'poisoner').poisoned('boomdandy');
		expect(explosionOf(poisoned.game, poisoned.seat('boomdandy'), poisoned.characters)).toBe(
			undefined
		);
		const drunk = base.drunk('boomdandy');
		expect(explosionOf(drunk.game, drunk.seat('boomdandy'), drunk.characters)).toBe(undefined);
	});

	it('says when the players left alive leave out the Demon', () => {
		const lives = (ids: string[]) => ids.map((id) => base.seat(id));
		expect(survivorsLackDemon(base.game, lives(['chef', 'empath', 'monk']), base.characters)).toBe(
			true
		);
		expect(survivorsLackDemon(base.game, lives(['imp', 'chef', 'monk']), base.characters)).toBe(
			false
		);
	});

	it('reads explodes as a whole number of survivors', () => {
		const issues = new Issues();
		expect(parseCharacterRules({ execution: { explodes: 3 } }, 'x', issues)?.execution).toEqual({
			explodes: 3
		});
		parseCharacterRules({ execution: { explodes: 0 } }, 'y', issues);
		parseCharacterRules({ execution: { explodes: 1.5 } }, 'z', issues);
		expect(issues.list).toEqual([
			'y.execution.explodes: expected a whole number of survivors, 1 or more',
			'z.execution.explodes: expected a whole number of survivors, 1 or more'
		]);
	});
});
