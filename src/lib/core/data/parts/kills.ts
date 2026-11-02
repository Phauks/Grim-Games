import { checkKeys, describe, isObject, readBoolean, readEnum } from '../validate.ts';
import { objectPart } from './part.ts';

const KILLS_BY = ['demon', 'other'] as const;
const KILLS_TARGETS = ['any', 'self'] as const;
export interface Kills {
	by: (typeof KILLS_BY)[number];
	targets?: (typeof KILLS_TARGETS)[number];
	ignoresProtection?: boolean;
}

/**
 * The ability kills at night: the Demon's kill or another ability's (`by`), any player or
 * only its own (`targets: self`, the Gambler), and ignoring protection (the Assassin).
 */
export const kills = objectPart(
	'Kills',
	'The ability kills at night.',
	(raw, path, issues): Kills | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['by', 'targets', 'ignoresProtection'], path, issues);
		const by = readEnum(raw, 'by', KILLS_BY, path, issues, true);
		const targets = readEnum(raw, 'targets', KILLS_TARGETS, path, issues, false);
		const ignoresProtection = readBoolean(raw, 'ignoresProtection', path, issues);
		if (!by) return undefined;
		const out: Kills = { by };
		if (targets) out.targets = targets;
		if (ignoresProtection !== undefined) out.ignoresProtection = ignoresProtection;
		return out;
	}
);
