import type { PublicLook } from '#lib/core/sync/public-projection.ts';
import { DEFAULT_BOARD_LOOKS, type BoardLooks } from './board-looks.svelte.ts';
import { PRESETS, type BackgroundChoice, type PresetId } from './backgrounds.ts';

/**
 * The look the Storyteller's board shares with every other grim of the game (Trevor,
 * 2026-10-26: the shared grim keeps the same background whatever a player's own theme): its
 * background, vignette and logo. A picture of the Storyteller's own stays on their device
 * (backgrounds.ts), so it is shared as no background.
 */
export function lookOf(choice: BackgroundChoice, looks: BoardLooks): PublicLook {
	return {
		...(choice.kind === 'script' ? { background: 'script' } : {}),
		...(choice.kind === 'preset' ? { background: choice.id } : {}),
		...(looks.vignette ? { vignette: looks.vignetteStrength } : {}),
		...(looks.logo ? { logo: looks.logoOpacity } : {})
	};
}

/** What another device draws for a shared look; before one arrives, the usual vignette and logo. */
export interface DrawnLook {
	preset?: PresetId;
	/** The script's own image, when it has one. */
	script: boolean;
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
		...(background && background in PRESETS ? { preset: background as PresetId } : {}),
		...(look.vignette !== undefined ? { vignette: look.vignette } : {}),
		...(look.logo !== undefined ? { logo: look.logo } : {})
	};
}
