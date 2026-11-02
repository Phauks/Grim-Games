import { checkKeys, describe, isObject, readEnum } from '../validate.ts';
import { objectPart } from './part.ts';
import { PROTECTS_FROM } from './protects.ts';

/** A kill on its player, by `from`, may land on another player instead (the Mayor). */
export const redirectsKill = objectPart(
	'Redirects a kill',
	'A kill on its player may land on another player instead.',
	(raw, path, issues): { from: (typeof PROTECTS_FROM)[number] } | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['from'], path, issues);
		const from = readEnum(raw, 'from', PROTECTS_FROM, path, issues, true);
		return from ? { from } : undefined;
	}
);
