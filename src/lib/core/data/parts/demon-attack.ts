import { oneOf, optObj, T, TOKEN } from '../field-spec.ts';
import { specPart, type PartValue } from './part.ts';

/**
 * Whom the Demon attacks, when the rule decides it: `script-order` is the next living in-play
 * character in script order, after the last one it killed (Trained Killer,
 * https://beardytas.com/garden-of-djinn/trained-killer/; `modes/rule-effects.ts`).
 */
const DEMON_TARGETS = ['script-order'] as const;
export type DemonTarget = (typeof DEMON_TARGETS)[number];

/**
 * While the character is in play, the Demon may choose not to attack at night, and with
 * `mustSkipOnce` must do so once per game (`rules/demon-attack.ts`; offered at the Demon's
 * step by `features/grimoire/NoAttackStep.svelte`). With `target`, the rule decides whom the
 * Demon attacks (named on the Demon's step by `features/grimoire/night-walk.svelte.ts`).
 */
export const demonAttack = specPart(
	'Demon attack',
	'While in play, the Demon may choose not to attack at night, may have to once per game, or attacks whom the rule says.',
	// `mustSkipOnce`: the Demon must choose not to attack at least once per game. This reminder
	// marks the Demon until it has, and while it is on the Demon, the Demon doesn't wake on a
	// night its attack could end the game (the Toymaker's Final Night: No Attack,
	// https://wiki.bloodontheclocktower.com/Toymaker). `target`: whom the Demon attacks each
	// night after the first.
	optObj({ maySkip: T, mustSkipOnce: TOKEN, target: oneOf(DEMON_TARGETS) }),
	(value, path, issues) => {
		if (!value.maySkip && !value.target) {
			issues.add(path, 'expected maySkip or target');
			return undefined;
		}
		if (value.mustSkipOnce && !value.maySkip) {
			issues.add(`${path}.mustSkipOnce`, 'needs maySkip');
			return undefined;
		}
		return value;
	}
);

export type DemonAttack = PartValue<typeof demonAttack>;
