import type { CharacterId } from '#lib/core/data/types.ts';
import { OFFICIAL_RULES } from '#lib/core/data/rules/index.ts';
import type { CharacterTargets } from './reminder-targets.ts';

/** The official characters' token rules, by character id. */
export const REMINDER_TARGETS: Readonly<Record<CharacterId, CharacterTargets>> = Object.fromEntries(
	[...OFFICIAL_RULES].flatMap(([id, rules]) =>
		rules.reminderTargets ? [[id, { labels: rules.reminderTargets }]] : []
	)
);
