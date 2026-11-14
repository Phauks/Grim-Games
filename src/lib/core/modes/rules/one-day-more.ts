import { SPECIAL_RULE_FORMAT, type SpecialRule } from '../types.ts';

const PAGE = 'https://beardytas.com/garden-of-djinn/one-day-more/';

/**
 * One Day More's rule, Signal Failure (Script World Cup 2025, by Robe): information from
 * abilities arrives a day late, worked out as things stood when the ability was used. The page
 * adds that only abilities that "know" or "learn" are delayed, not the evil team learning each
 * other or the Demon's bluffs, and that the Artist is immune. Deferred by Trevor on 2026-10-22
 * ("we need more work"), built on 2026-11-12. The walk-through keeps each night's information
 * and gives it the night after (`infoDelay`, `rules/night/info/held-info.ts`). Source: PAGE.
 */
export const ONE_DAY_MORE: SpecialRule = {
	kind: 'special-rule',
	format: SPECIAL_RULE_FORMAT,
	id: 'one-day-more',
	name: 'One Day More',
	// Our own wording (2026-11-12), approved by Trevor 2026-11-13.
	about:
		'Information from abilities arrives a day late, as it was when the ability was used. Evil learning each other, the Demon’s bluffs and the Artist are not delayed.',
	aliases: ['Signal Failure'],
	sources: [{ title: 'One Day More (Beardy on the Clocktower)', url: PAGE }],
	authors: [{ title: 'Robe', url: PAGE }],
	setup: {
		// The author's rule, quoted from the script's Bootlegger line.
		text: [
			'Signal Failure: There is a 24 hour delay impacting all characters with abilities that know or learn information.'
		],
		ruleChanges: [
			{
				// Our own wording (2026-11-12), approved by Trevor 2026-11-13.
				instructions:
					'Work out each player’s information when their ability is used, as things stand then, and give it to them the next night instead. Whether they are drunk or poisoned counts when they receive it. Evil learning each other, the Demon’s bluffs and the Artist are not delayed.'
			}
		]
	},
	rules: { infoDelay: { except: ['artist'] } }
};
