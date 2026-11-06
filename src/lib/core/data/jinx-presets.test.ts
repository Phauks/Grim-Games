import { describe, expect, it } from 'vitest';
import { jinxPatches } from './jinx-presets.ts';

describe('jinxPatches (M61b)', () => {
	it('reads `impairs` about the subject as a patch of the part `impairs`', () => {
		expect(jinxPatches({ impairs: { kind: 'poisoned', when: ['partner-in-play'] } })).toEqual([
			{
				when: ['partner-in-play'],
				parts: { impairs: { self: { reason: 'poisoned' } } },
				preset: 'impairs'
			}
		]);
	});

	it('keeps `impairs` about two players, or the partner’s ability, as a verb', () => {
		expect(jinxPatches({ impairs: { kind: 'drunk', who: 'both', unlessImpaired: true } })).toEqual(
			[]
		);
		expect(jinxPatches({ impairs: { kind: 'no-ability', when: ['has-partner-ability'] } })).toEqual(
			[]
		);
	});

	it('lists the entry’s own patch first', () => {
		const own = { parts: { voteWeight: { self: true as const, weight: 2 } } };
		const both = jinxPatches({ patch: own, impairs: { kind: 'drunk' } });
		expect(both.map((p) => p.preset)).toEqual([undefined, 'impairs']);
	});

	it('reads `madAsPartner` as the subject’s own `madAs` with the partner among its characters', () => {
		const own = {
			madAs: { token: 'Mad', mad: 'carrier' as const, choose: ['townsfolk' as const] }
		};
		expect(jinxPatches({ madAsPartner: {} }, { partner: 'goblin', own })).toEqual([
			{
				parts: { madAs: { ...own.madAs, characters: ['goblin'] } },
				preset: 'madAsPartner'
			}
		]);
		// Without its own madness about a chosen character, the verb patches nothing.
		expect(jinxPatches({ madAsPartner: {} }, { partner: 'goblin', own: {} })).toEqual([]);
	});
});
