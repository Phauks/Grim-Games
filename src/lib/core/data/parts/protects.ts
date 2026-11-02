import type { ReminderLabel } from '../types.ts';
import { ownReminder } from '../reminder-fields.ts';
import { checkKeys, describe, isObject, readBoolean, readEnum, readString } from '../validate.ts';
import { objectPart } from './part.ts';

const PROTECTS_WHO = ['self', 'marked', 'good'] as const;
/**
 * What a protection stops: the Demon's kill, any death, only an execution (the Devil's
 * Advocate's, https://wiki.bloodontheclocktower.com/Devil%27s_Advocate), any death but an
 * execution (the Storm Catcher's good character "can only die by execution",
 * https://wiki.bloodontheclocktower.com/Storm_Catcher), or any death by day, an execution
 * included (the Vizier "cannot die during the day",
 * https://wiki.bloodontheclocktower.com/Vizier).
 */
export const PROTECTS_FROM = ['demon', 'any', 'execution', 'not-execution', 'day'] as const;
/**
 * `night`: it lasts only the night it is given ("can't die tonight"), so never stops an
 * execution. `storytellerDecides`: the player only "might not die" (the Pacifist, the
 * Psychopath's roshambo), so the grimoire never applies it; the Storyteller picks it in the
 * Execution sheet's Saved by. `whileNeighboursGood`: it holds only while both of the
 * character's alive neighbours are good (the Tea Lady,
 * https://wiki.bloodontheclocktower.com/Tea_Lady).
 */
export type Protects = (
	| { who: 'self' | 'good'; from: (typeof PROTECTS_FROM)[number] }
	| { who: 'marked'; token: ReminderLabel; from: (typeof PROTECTS_FROM)[number] }
) & { night?: true; storytellerDecides?: true; whileNeighboursGood?: true };

/**
 * The ability stops a death: its own player's (`self`, the Soldier), the player marked
 * with its `token` (the Monk's "Safe") or any good player's (`good`, the Pacifist), against
 * the Demon's kill only, any kill, or an execution only.
 */
export const protects = objectPart(
	'Protects',
	'The ability stops a death: its own player’s, a marked player’s or any good player’s.',
	(raw, path, issues, reminders): Protects | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(
			raw,
			['who', 'token', 'from', 'night', 'storytellerDecides', 'whileNeighboursGood'],
			path,
			issues
		);
		const who = readEnum(raw, 'who', PROTECTS_WHO, path, issues, true);
		const from = readEnum(raw, 'from', PROTECTS_FROM, path, issues, true);
		const flags = {
			...(readBoolean(raw, 'night', path, issues) ? { night: true as const } : {}),
			...(readBoolean(raw, 'storytellerDecides', path, issues)
				? { storytellerDecides: true as const }
				: {}),
			...(readBoolean(raw, 'whileNeighboursGood', path, issues)
				? { whileNeighboursGood: true as const }
				: {})
		};
		if (!who || !from) return undefined;
		if (who !== 'marked') {
			if (raw.token !== undefined) issues.add(`${path}.token`, 'only a marked player has a token');
			return { who, from, ...flags };
		}
		const token = readString(raw, 'token', path, issues, true);
		if (token === undefined) return undefined;
		if (!ownReminder(token, reminders)) {
			issues.add(`${path}.token`, 'not one of this character’s reminders');
			return undefined;
		}
		return { who, token, from, ...flags };
	}
);
