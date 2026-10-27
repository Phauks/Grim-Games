import type { TokenAppearanceRowKey } from '#lib/features/characters/token-appearance-rows.ts';

/**
 * The token look's rows a player sees, under the same headings as Settings > Tokens (Trevor,
 * 2026-10-27): only those that change the player screens.
 */
export const PLAYER_SIZE_GROUPS = {
	inText: [
		'inlineNameTextScale',
		'inlineNameIconScale',
		'inlineNameBadgeScale',
		'inlineReminderScale',
		'inlineReminderIconScale',
		'inlineReminderBadgeScale'
	],
	token: ['tokenScale', 'tokenIconScale', 'boardNames'],
	reminder: ['reminderScale', 'reminderIconScale', 'reminderLabelWidth', 'reminderLabelWrap']
} as const satisfies Record<string, readonly TokenAppearanceRowKey[]>;

export const PLAYER_SIZE_KEYS: readonly TokenAppearanceRowKey[] =
	Object.values(PLAYER_SIZE_GROUPS).flat();
