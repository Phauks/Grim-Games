import type { MovingChoice } from '#lib/core/backgrounds/moving.ts';
import type { PublicLook } from '#lib/core/sync/public-projection.ts';
import { DEFAULT_BOARD_LOOKS, type BoardLooks } from './board-looks.svelte.ts';
import { isStillId, stillDefaults, type StillChoice } from '#lib/core/backgrounds/still.ts';
import type { BackgroundChoice } from './backgrounds.ts';

/**
 * The look the Storyteller's board shares with every other grim of the game (Trevor,
 * 2026-10-26: the shared grim keeps the same background whatever a player's own theme): its
 * background, vignette and logo. A picture of the Storyteller's own is uploaded to the room
 * (Trevor, 2026-10-26: "Images should be uploaded and shared"), which names it by its hash
 * (RoomHost.showLook); until then it shows as no background.
 */
export function lookOf(choice: BackgroundChoice, looks: BoardLooks): PublicLook {
	return {
		...(choice.kind === 'script' ? { background: 'script' } : {}),
		...(choice.kind === 'preset'
			? { background: choice.id, still: { id: choice.id, params: choice.params } }
			: {}),
		...(choice.kind === 'image' ? { background: 'image' } : {}),
		...(choice.kind === 'moving'
			? { background: 'moving', moving: { id: choice.id, params: choice.params } }
			: {}),
		...(looks.vignette ? { vignette: looks.vignetteStrength } : {}),
		...(looks.logo ? { logo: looks.logoOpacity } : {})
	};
}

/** What another device draws for a shared look; before one arrives, the usual vignette and logo. */
export interface DrawnLook {
	/** A still background (M72) with the Storyteller's settings. */
	preset?: StillChoice;
	/** The script's own image, when it has one. */
	script: boolean;
	/** The room's picture, by its hash (core/sync/room-images.ts). */
	image?: string;
	/** The Storyteller's moving background (M43), which each phone may hold still. */
	moving?: MovingChoice;
	vignette?: number;
	logo?: number;
}

export function drawnLook(look: PublicLook | undefined): DrawnLook {
	if (!look)
		return {
			script: false,
			vignette: DEFAULT_BOARD_LOOKS.vignetteStrength,
			logo: DEFAULT_BOARD_LOOKS.logoOpacity
		};
	const { background } = look;
	return {
		script: background === 'script',
		...(isStillId(background)
			? {
					preset:
						look.still?.id === background
							? look.still
							: { id: background, params: stillDefaults(background) }
				}
			: {}),
		...(background === 'image' && look.image ? { image: look.image } : {}),
		...(background === 'moving' && look.moving ? { moving: look.moving } : {}),
		...(look.vignette !== undefined ? { vignette: look.vignette } : {}),
		...(look.logo !== undefined ? { logo: look.logo } : {})
	};
}
