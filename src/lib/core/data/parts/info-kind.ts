import { readFlags } from '../choice-rules.ts';
import { objectPart } from './part.ts';

/** What its night information is like: a number (the Chef), only once per game (the Artist). */
export const infoKind = objectPart(
	'Info kind',
	'What its night information is like: a number, or only once per game.',
	(raw, path, issues) => readFlags(raw, path, issues, ['number', 'oncePerGame'] as const)
);
