/**
 * What a player's profile shows about them (Trevor, 2026-10-28): the PLAYER, never their
 * character. One labelled row each, so per-player game stats can join the list later.
 */
import { LAUREL_COLOUR_NAMES, LAUREL_COLOURS } from '#lib/core/achievements/index.ts';
import { FRAME_MOTION_NAMES, frameById, type FrameId } from '#lib/core/frames/index.ts';
import { t } from '#lib/i18n/locale.svelte.ts';

export interface ProfileRow {
	id: string;
	label: string;
	value: string;
	/** A colour to show beside the value: the colour itself, never how it is applied. */
	swatch?: string;
}

/** The rows for a player's laurel: its form, its colour and its motion, or "None". */
export function seatProfileRows(frame: FrameId | undefined): ProfileRow[] {
	const drawn = frameById(frame);
	const none = t('common.none');
	const styled = drawn?.form !== undefined;
	return [
		{ id: 'laurel', label: t('player.seatProfile.laurel'), value: styled ? drawn.name : none },
		{
			id: 'colour',
			label: t('player.seatProfile.colour'),
			value: drawn?.colour ? LAUREL_COLOUR_NAMES[drawn.colour] : none,
			...(drawn?.colour ? { swatch: LAUREL_COLOURS[drawn.colour][0] } : {})
		},
		{
			id: 'motion',
			label: t('player.seatProfile.motion'),
			value: FRAME_MOTION_NAMES[drawn?.motion ?? 'none']
		}
	];
}
