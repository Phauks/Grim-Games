import type { SymbolColour } from '#lib/core/model/index.ts';

/**
 * The generic reminder's symbol colours (Trevor, 2026-10-20), each one of the theme's own
 * colours, so they follow the theme.
 */
export const SYMBOL_COLOUR_LOOKS: Record<SymbolColour, { label: string; colour: string }> = {
	blue: { label: 'Blue', colour: 'var(--good)' },
	red: { label: 'Red', colour: 'var(--evil)' },
	purple: { label: 'Purple', colour: 'var(--traveller)' },
	gold: { label: 'Gold', colour: 'var(--fabled)' },
	green: { label: 'Green', colour: 'var(--loric)' }
};
