import { COUNT, oneOf, optObj } from '../field-spec.ts';
import { specPart, type PartValue } from './part.ts';

export const EXECUTED_INSTEAD_OF = ['same-alignment'] as const;

/**
 * The `execution` part of a character's rules block: what its ability does around an
 * execution. It names a behaviour, never a character:
 * - `insteadOf: 'same-alignment'`: the Storyteller may execute this player instead of a player
 *   of the same alignment (the Scapegoat, https://wiki.bloodontheclocktower.com/Scapegoat).
 *   The execution dialog offers it (`rules/day/executed-instead.ts`);
 * - `explodes`: executed (whether or not they die of it), all but this many players die, then the players point
 *   and the one most pointed at dies (the Boomdandy's 3,
 *   https://wiki.bloodontheclocktower.com/Boomdandy). The board asks who lives, then who was
 *   pointed at most (`rules/day/explosion.ts`).
 */
export const execution = specPart(
	'day',
	'Execution',
	'What it does around an execution.',
	optObj({ insteadOf: oneOf(EXECUTED_INSTEAD_OF), explodes: COUNT })
);

export type ExecutionRule = PartValue<typeof execution>;
