import { stringPart } from './part.ts';

/**
 * A hidden character (one with no token of its own, such as the Drunk) the Storyteller may
 * make this character's player instead, who then thinks they are this character. Sushi
 * Buffet asks when it is drafted, as Grimbits' draft tool does for the Atheist
 * (https://grimbits.com/draft-buffet/; `modes/draft.ts`).
 */
export const orHiddenAs = stringPart(
	'Or hidden as',
	'A hidden character the Storyteller may make its player instead.'
);
