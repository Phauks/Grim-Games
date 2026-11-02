import { truePart } from './part.ts';

/**
 * Once per game its player may make a wish, which the Storyteller grants or declines, maybe
 * with a price and a clue (the Wizard, https://wiki.bloodontheclocktower.com/Wizard). The day
 * view records it (`rules/wishes.ts`); a granted wish may carry a standard effect.
 */
export const wish = truePart(
	'Wish',
	'Once per game its player may make a wish; the Storyteller grants or declines it.'
);
