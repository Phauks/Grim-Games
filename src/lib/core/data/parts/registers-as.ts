import { readRegistersAs } from '../registers-as-rules.ts';
import { objectPart } from './part.ts';

/** Players who may register as another alignment or character type (`rules/ability.ts`). */
export const registersAs = objectPart(
	'Registers as',
	'Players who may register as another alignment or character type.',
	readRegistersAs
);
