import { obj, oneOf } from '../field-spec.ts';
import { TURNS_PLAYERS } from '../turns-players-rules.ts';
import { SEATED_TYPES } from '../types.ts';
import { specPart, type PartValue } from './part.ts';

/**
 * Players it turns into characters of another type at setup, worked out in `modes/draft.ts`
 * (Sushi Buffet). It names a behaviour and its type, never a character (the Kazali).
 */
export const turnsPlayersInto = specPart(
	'Turns players into',
	'Players it turns into another type at setup.',
	obj({ type: oneOf(SEATED_TYPES), players: oneOf(TURNS_PLAYERS) })
);

export type TurnsPlayersInto = PartValue<typeof turnsPlayersInto>;
