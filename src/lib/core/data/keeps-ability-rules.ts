/**
 * The `keepsAbility` part of a character's rules block: its reminder token on a dead player
 * keeps that player's ability, only a `type` player when given (the Vigormortis's Has Ability
 * on a Minion it killed, https://wiki.bloodontheclocktower.com/Vigormortis). That player stays
 * in the night order and their ability still works (`rules/dead-characters.ts`). The block
 * reads like `stopsWaking`: a token and an optional character type.
 */
import { readStopsWaking, type StopsWaking } from './stops-waking-rules.ts';

export type KeepsAbility = StopsWaking;

/** Reads a `keepsAbility` block; `token` must be one of the character's `reminders`. */
export const readKeepsAbility = readStopsWaking;
