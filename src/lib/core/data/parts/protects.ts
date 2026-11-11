import { obj, oneOf, opt, T, TOKEN } from '../field-spec.ts';
import type { ReminderLabel } from '../types.ts';
import { specPart } from './part.ts';

/**
 * What a protection stops: the Demon's kill, any death, only an execution (the Devil's
 * Advocate's, https://wiki.bloodontheclocktower.com/Devil%27s_Advocate), any death but an
 * execution (the Storm Catcher's good character "can only die by execution",
 * https://wiki.bloodontheclocktower.com/Storm_Catcher), or any death by day, an execution
 * included (the Vizier "cannot die during the day",
 * https://wiki.bloodontheclocktower.com/Vizier), or only an exile (the Deviant "cannot be
 * exiled" if funny, https://wiki.bloodontheclocktower.com/Deviant).
 */
export const PROTECTS_FROM = [
	'demon',
	'any',
	'execution',
	'not-execution',
	'day',
	'exile'
] as const;
/**
 * `night`: it lasts only the night it is given ("can't die tonight"), so never stops an
 * execution. `storytellerDecides`: the player only "might not die" (the Pacifist, the
 * Psychopath's roshambo), so the grimoire never applies it; the Storyteller picks it in the
 * Execution sheet's Saved by. `whileNeighboursGood`: it holds only while both of the
 * character's alive neighbours are good (the Tea Lady,
 * https://wiki.bloodontheclocktower.com/Tea_Lady). `whileCarrierAlive`: it holds only while a
 * player carrying this character's token lives (the Lleech cannot die while its host, marked
 * with its Poisoned, is alive: https://wiki.bloodontheclocktower.com/Lleech, M15h).
 */
export type Protects = (
	| { who: 'self' | 'good'; from: (typeof PROTECTS_FROM)[number] }
	| { who: 'marked'; token: ReminderLabel; from: (typeof PROTECTS_FROM)[number] }
) & {
	night?: true;
	storytellerDecides?: true;
	whileNeighboursGood?: true;
	whileCarrierAlive?: ReminderLabel;
};

/**
 * The ability stops a death: its own player's (`self`, the Soldier), the player marked
 * with its `token` (the Monk's "Safe") or any good player's (`good`, the Pacifist), against
 * the Demon's kill only, any kill, or an execution only.
 */
export const protects = specPart(
	'Protects',
	'The ability stops a death: its own player’s, a marked player’s or any good player’s.',
	obj({
		who: oneOf(['self', 'marked', 'good']),
		token: opt(TOKEN),
		from: oneOf(PROTECTS_FROM),
		night: opt(T),
		storytellerDecides: opt(T),
		whileNeighboursGood: opt(T),
		whileCarrierAlive: opt(TOKEN)
	}),
	(value, path, issues): Protects | undefined => {
		const { who, token, ...rest } = value;
		if (who === 'marked') {
			if (token) return { who, token, ...rest };
			issues.add(`${path}.token`, 'missing');
			return undefined;
		}
		if (token === undefined) return { who, ...rest };
		issues.add(`${path}.token`, 'only a marked player has a token');
		return undefined;
	}
);
