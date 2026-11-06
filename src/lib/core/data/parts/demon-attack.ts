import type { ReminderLabel } from '../types.ts';
import { readToken } from '../reminder-fields.ts';
import { checkKeys, describe, isObject, readBoolean, readEnum, type Issues } from '../validate.ts';
import { objectPart, type Reminders } from './part.ts';

/**
 * Whom the Demon attacks, when the rule decides it: `script-order` is the next living in-play
 * character in script order, after the last one it killed (Trained Killer,
 * https://beardytas.com/garden-of-djinn/trained-killer/; `modes/rule-effects.ts`).
 */
const DEMON_TARGETS = ['script-order'] as const;
export type DemonTarget = (typeof DEMON_TARGETS)[number];

export interface DemonAttack {
	/** The Demon may choose not to attack at night. */
	maySkip?: true;
	/**
	 * The Demon must choose not to attack at least once per game: this reminder marks the Demon
	 * until it has, and while it is still on the Demon the Demon doesn't wake on a night its
	 * attack could end the game (the Toymaker's Final Night: No Attack,
	 * https://wiki.bloodontheclocktower.com/Toymaker).
	 */
	mustSkipOnce?: ReminderLabel;
	/** Whom the Demon attacks each night after the first. */
	target?: DemonTarget;
}

function readDemonAttack(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: Reminders
): DemonAttack | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['maySkip', 'mustSkipOnce', 'target'], path, issues);
	const maySkip = readBoolean(raw, 'maySkip', path, issues);
	const target = readEnum(raw, 'target', DEMON_TARGETS, path, issues, false);
	if (raw.maySkip !== undefined && maySkip !== true) {
		issues.add(`${path}.maySkip`, 'expected true');
		return undefined;
	}
	if (!maySkip && !target) {
		issues.add(path, 'expected maySkip or target');
		return undefined;
	}
	const token = readToken(raw, 'mustSkipOnce', path, issues, reminders);
	if (token && !maySkip) issues.add(`${path}.mustSkipOnce`, 'needs maySkip');
	return {
		...(maySkip ? { maySkip } : {}),
		...(token ? { mustSkipOnce: token } : {}),
		...(target ? { target } : {})
	};
}

/**
 * While the character is in play, the Demon may choose not to attack at night, and with
 * `mustSkipOnce` must do so once per game (`rules/demon-attack.ts`; offered at the Demon's
 * step by `features/grimoire/NoAttackStep.svelte`). With `target`, the rule decides whom the
 * Demon attacks (named on the Demon's step by `features/grimoire/night-walk.svelte.ts`).
 */
export const demonAttack = objectPart(
	'Demon attack',
	'While in play, the Demon may choose not to attack at night, may have to once per game, or attacks whom the rule says.',
	readDemonAttack
);
