import { specPart, type PartValue } from './part.ts';
import { TOKEN_ON_TYPE } from './stops-waking.ts';

/** Its token on a dead player keeps that player's ability (the same shape as `stopsWaking`). */
export const keepsAbility = specPart(
	'abilities',
	'Keeps ability',
	'Its token on a dead player keeps that player’s ability.',
	TOKEN_ON_TYPE
);

export type KeepsAbility = PartValue<typeof keepsAbility>;
