import { checkKeys, describe, isObject, readBoolean, readEnum } from '../validate.ts';
import { objectPart } from './part.ts';

const KILLS_BY = ['demon', 'other'] as const;
const KILLS_TARGETS = ['any', 'self'] as const;
const KILLS_CHOOSES = ['character', 'live-or-die'] as const;
export interface Kills {
	by: (typeof KILLS_BY)[number];
	targets?: (typeof KILLS_TARGETS)[number];
	ignoresProtection?: boolean;
	/**
	 * What the ability chooses instead of a player (`rules/chosen-kills.ts`): `character`, a
	 * character whose player dies, or the Storyteller's pick when it is not in play (the Ojo);
	 * `live-or-die`, the players its reminders mark, who each choose to live or die, and all
	 * die if all live (the Al-Hadikhia).
	 */
	chooses?: (typeof KILLS_CHOOSES)[number];
}

/**
 * The ability kills at night: the Demon's kill or another ability's (`by`), any player or
 * only its own (`targets: self`, the Gambler), ignoring protection (the Assassin), and what
 * it chooses when that is not a player (`chooses`).
 */
export const kills = objectPart(
	'Kills',
	'The ability kills at night.',
	(raw, path, issues): Kills | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['by', 'targets', 'ignoresProtection', 'chooses'], path, issues);
		const by = readEnum(raw, 'by', KILLS_BY, path, issues, true);
		const targets = readEnum(raw, 'targets', KILLS_TARGETS, path, issues, false);
		const ignoresProtection = readBoolean(raw, 'ignoresProtection', path, issues);
		const chooses = readEnum(raw, 'chooses', KILLS_CHOOSES, path, issues, false);
		if (!by) return undefined;
		const out: Kills = { by };
		if (targets) out.targets = targets;
		if (ignoresProtection !== undefined) out.ignoresProtection = ignoresProtection;
		if (chooses) out.chooses = chooses;
		return out;
	}
);
