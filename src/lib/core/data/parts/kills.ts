import { B, COUNT, obj, oneOf, opt, TOKEN } from '../field-spec.ts';
import { specPart, type PartValue } from './part.ts';

/**
 * The ability kills at night: the Demon's kill or another ability's (`by`), any player or
 * only its own (`targets: self`, the Gambler), ignoring protection (the Assassin)
 * (`rules/night-kill.ts`):
 * - `count`: how many players it may choose a night, 1 when left out (the Shabaloth's 2);
 * - `charged`: with its own `token` on its player (it chose no one), it may choose `count`
 *   instead (the Po's 3 Attacks after choosing no one);
 * - `delayed`: its kill falls on the player carrying this token of its own, and needs no
 *   waking (the Pukka's Poisoned);
 * - `chooses`: what the ability chooses instead of a player (`rules/chosen-kills.ts`):
 *   `character`, a character whose player dies, or the Storyteller's pick when it is not in
 *   play (the Ojo); `live-or-die`, the players its reminders mark, who each choose to live or
 *   die, and all die if all live (the Al-Hadikhia).
 */
export const kills = specPart(
	'Kills',
	'The ability kills at night.',
	obj({
		by: oneOf(['demon', 'other']),
		targets: opt(oneOf(['any', 'self'])),
		ignoresProtection: opt(B),
		count: opt(COUNT),
		charged: opt(obj({ token: TOKEN, count: COUNT })),
		delayed: opt(TOKEN),
		chooses: opt(oneOf(['character', 'live-or-die']))
	})
);

export type Kills = PartValue<typeof kills>;
