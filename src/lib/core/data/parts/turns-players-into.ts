import { obj, oneOf } from '../field-spec.ts';
import { SEATED_TYPES } from '../types.ts';
import { specPart, type PartValue } from './part.ts';

/**
 * Which players:
 * - `chosen`: as many as the setup counts give that type, picked by the character (the Kazali's
 *   Minions, https://wiki.bloodontheclocktower.com/Kazali);
 * - `neighbours`: its two neighbours, so the evil players sit in a line with it in the middle
 *   (the Lord of Typhon's Minions, https://wiki.bloodontheclocktower.com/Lord_of_Typhon);
 * - `drafter`: the player who drafts it, as the character itself is not dealt (Lil' Monsta's
 *   Minions, https://wiki.bloodontheclocktower.com/Lil%27_Monsta).
 * A jinx's `alsoBecomes` uses the same words (`jinx-read.ts`).
 */
export const TURNS_PLAYERS = ['chosen', 'neighbours', 'drafter'] as const;
export type TurnsPlayers = (typeof TURNS_PLAYERS)[number];

/**
 * Players it turns into characters of another type at setup, worked out in `modes/draft.ts`
 * (Sushi Buffet). It names a behaviour and its type, never a character (the Kazali).
 */
export const turnsPlayersInto = specPart(
	'night',
	'Turns players into',
	'Players it turns into another type at setup.',
	obj({ type: oneOf(SEATED_TYPES), players: oneOf(TURNS_PLAYERS) })
);

export type TurnsPlayersInto = PartValue<typeof turnsPlayersInto>;
