import { specPart, partWords } from './part.ts';
import { TOKEN_ON_TYPE } from './stops-waking.ts';

/** Its token on a player stops them killing tonight (the same shape as `stopsWaking`). */
export const stopsKilling = partWords(
	specPart(
		'deaths',
		'Stops killing',
		'Its token on a player stops them killing tonight.',
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
