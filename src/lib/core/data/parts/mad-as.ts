import { anyOf, obj, oneOf, opt, STRS, TOKEN } from '../field-spec.ts';
import { SEATED_TYPES } from '../types.ts';
import { specPart, type PartValue } from './part.ts';

export const MAD_AS_WHO = ['carrier', 'self'] as const;
export type MadAsWho = (typeof MAD_AS_WHO)[number];

/**
 * The `madAs` part of a character's rules block: the character a player is mad as, by this
 * character's token (https://wiki.bloodontheclocktower.com/Madness), shown by the mad
 * player's seat on the board marked ! (Trevor, 2026-11-03, M36). It names a behaviour, never a
 * character:
 * - `token`: the reminder it is found by;
 * - `mad: "carrier"`: the player carrying the token is mad as a character recorded on it,
 *   chosen from `choose` types on this character's night step (the Cerenovus,
 *   https://wiki.bloodontheclocktower.com/Cerenovus), and also any of `characters`, whatever
 *   their type (with its jinx, the Cerenovus may choose the Goblin);
 * - `mad: "self"`: this character's own player is mad as the character of the player carrying
 *   the token (the Pixie, https://wiki.bloodontheclocktower.com/Pixie).
 */
export const madAs = specPart(
	'Mad as',
	'The character a player is mad as, found by its token.',
	// With `mad: "carrier"`: `choose`, the types the character is chosen from, and
	// `characters`, characters it may also be, whatever their type.
	obj({
		token: TOKEN,
		mad: oneOf(MAD_AS_WHO),
		choose: opt(anyOf(SEATED_TYPES)),
		characters: opt(STRS)
	}),
	(value, path, issues) => {
		const before = issues.list.length;
		if (value.mad === 'carrier' && !value.choose) {
			issues.add(`${path}.choose`, 'required with mad "carrier"');
		}
		for (const key of ['choose', 'characters'] as const) {
			if (value[key] && value.mad !== 'carrier') {
				issues.add(`${path}.${key}`, 'only with mad "carrier"');
			}
		}
		return issues.list.length > before ? undefined : value;
	}
);

export type MadAs = PartValue<typeof madAs>;
