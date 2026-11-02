import { truePart } from './part.ts';

/**
 * While it is in play there are two Storytellers: one lies about ability information, and
 * they may switch once (the Knaves, https://wiki.bloodontheclocktower.com/Knaves). Each player
 * picks which one they go to; `rules/storytellers.ts` makes the liar's information false.
 */
export const twoStorytellers = truePart(
	'Two Storytellers',
	'There are two Storytellers: one gives false ability information, and they may switch once.'
);
