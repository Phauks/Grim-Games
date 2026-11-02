import { readEvilInfo } from '../choice-rules.ts';
import { objectPart } from './part.ts';

export const evilInfo = objectPart(
	'Evil info steps',
	'How it changes the Minion and Demon info steps.',
	readEvilInfo
);
