import {
	ICON_SCALE,
	REMINDER_LABEL_WIDTH,
	TOKEN_SCALE,
	type TokenAppearance
} from '#lib/ui/token/token-appearance.ts';

/**
 * The token look's sizes and switches as setting rows, one entry each, so Settings > Tokens
 * and the player's own settings draw the same row from one place (Trevor, 2026-10-27: players
 * get the Storyteller's text and token sizes).
 */
export const TOKEN_APPEARANCE_ROWS = {
	tokenScale: { label: 'characters.tokenSize', range: TOKEN_SCALE },
	tokenIconScale: { label: 'characters.tokenIconSize', range: ICON_SCALE },
	boardNames: { label: 'characters.boardNames' },
	nightBadgeScale: { label: 'characters.nightBadgeSize', range: TOKEN_SCALE },
	reminderScale: { label: 'characters.reminderSize', range: TOKEN_SCALE },
	reminderIconScale: { label: 'characters.reminderIconSize', range: ICON_SCALE },
	reminderLabelWidth: { label: 'characters.reminderLabelWidth', range: REMINDER_LABEL_WIDTH },
	reminderLabelWrap: { label: 'characters.reminderLabelWrap' },
	inlineNameTextScale: { label: 'characters.inlineNameTextSize', range: TOKEN_SCALE },
	inlineNameIconScale: { label: 'characters.inlineNameIconSize', range: TOKEN_SCALE },
	inlineNameBadgeScale: { label: 'characters.inlineNameBadgeSize', range: TOKEN_SCALE },
	inlineReminderScale: { label: 'characters.inlineReminderSize', range: TOKEN_SCALE },
	inlineReminderIconScale: { label: 'characters.inlineReminderIconSize', range: TOKEN_SCALE },
	inlineReminderBadgeScale: { label: 'characters.inlineReminderBadgeSize', range: TOKEN_SCALE }
} as const satisfies Partial<
	Record<
		keyof TokenAppearance,
		{ label: string; range?: { min: number; max: number; step: number } }
	>
>;

export type TokenAppearanceRowKey = keyof typeof TOKEN_APPEARANCE_ROWS;
