import { specPart, type PartValue, partWords } from './part.ts';
import { TOKEN_ON_TYPE } from './stops-waking.ts';

/** Its token on a dead player keeps that player's ability (the same shape as `stopsWaking`). */
export const keepsAbility = partWords(
	specPart(
		'abilities',
		'Keeps ability',
		'Its token on a dead player keeps that player’s ability.',
		TOKEN_ON_TYPE
	),
	{
		token: {
			label: 'Reminder'
		},
		type: {
			label: 'Only on this type'
		}
	}
);

export type KeepsAbility = PartValue<typeof keepsAbility>;
