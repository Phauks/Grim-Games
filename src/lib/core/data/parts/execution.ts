import { readExecution } from '../execution-rules.ts';
import { objectPart } from './part.ts';

/** What it does around an execution (`execution-rules.ts`). */
export const execution = objectPart(
	'Execution',
	'What it does around an execution.',
	readExecution
);
