import { enumPart } from './part.ts';

/**
 * The nights its step is the Storyteller's alone: its player does not wake for it, so it is
 * not their waking (`rules/woke-tonight.ts`: the Gossip's kill, which the Chambermaid does
 * not count, https://wiki.bloodontheclocktower.com/Chambermaid).
 */
export const staysAsleep = enumPart(
	'Stays asleep',
	'The nights its player does not wake for its step: the Storyteller acts alone.',
	['first', 'other', 'both'] as const
);
