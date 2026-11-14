import type { SemanticToken } from './types.ts';

/** The surfaces buttons and chips sit on: pages, dialogs, sheets and chosen rows. */
const CONTROL_SURFACES = [
	'--surface',
	'--surface-glow',
	'--surface-raised',
	'--surface-selected',
	'--sheet'
] as const;

/**
 * A control's edge against what it sits on reaches WCAG 1.4.11's 3:1 for non-text contrast
 * in every theme, so no button blends into its surface (Trevor, 2026-10-22).
 */
export const EDGE_PAIRS: readonly [edge: SemanticToken, background: SemanticToken][] = (
	['--button-edge', '--accent-edge', '--danger-edge'] as const
).flatMap((edge) => CONTROL_SURFACES.map((bg) => [edge, bg] as [SemanticToken, SemanticToken]));
