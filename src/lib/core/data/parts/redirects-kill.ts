import { obj, oneOf } from '../field-spec.ts';
import { specPart, partWords } from './part.ts';
import { PROTECTS_FROM } from './protects.ts';

/** A kill on its player, by `from`, may land on another player instead (the Mayor). */
export const redirectsKill = partWords(
	specPart(
		'deaths',
		'Redirects a kill',
		'A kill on its player may land on another player instead.',
		obj({ from: oneOf(PROTECTS_FROM) })
	),
	{
		from: {
			label: 'Kills',
			names: {
				demon: 'The Demon’s kill',
				any: 'Any death',
				execution: 'Only an execution',
				'not-execution': 'Any death but an execution',
				day: 'Any death by day',
				exile: 'Only an exile'
			}
		}
	}
);
