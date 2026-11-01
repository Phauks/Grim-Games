import { readDeathCause } from '../death-cause-rules.ts';
import { objectPart } from './part.ts';

/** Whether and how its ability can cause a death (`rules/death-causes.ts`). */
export const deathCause = objectPart(
	'Death cause',
	'Whether and how its ability can cause a death.',
	readDeathCause
);
