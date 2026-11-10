import {
	isPresetColour,
	type SymbolColour,
	type SymbolColourPreset
} from '#lib/core/model/index.ts';

/**
 * The generic reminder's preset symbol colours (Trevor, 2026-10-20), each one of the theme's
 * own colours, so they follow the theme.
 */
export const SYMBOL_COLOUR_LOOKS: Record<SymbolColourPreset, { label: string; colour: string }> = {
	blue: { label: 'Blue', colour: 'var(--good)' },
	red: { label: 'Red', colour: 'var(--evil)' },
	purple: { label: 'Purple', colour: 'var(--traveller)' },
	gold: { label: 'Gold', colour: 'var(--fabled)' },
	green: { label: 'Green', colour: 'var(--loric)' }
};

/**
 * A symbol colour as CSS: a preset's theme colour, or the picked colour itself (Trevor,
 * 2026-11-10: full custom). None is the reminder's own ink.
 */
export function symbolColourCss(colour: SymbolColour | undefined): string | undefined {
	if (colour === undefined) return undefined;
	return isPresetColour(colour) ? SYMBOL_COLOUR_LOOKS[colour].colour : colour;
}
