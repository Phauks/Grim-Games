import type { FontId, FontRole } from '#lib/ui/fonts/catalogue.ts';
import type { IconSetId, IconSlot } from '#lib/ui/icons/catalogue.ts';

/**
 * The semantic token layer. Components read these (or component tokens built from them),
 * never palette tokens or raw colours. Every theme must define all of them.
 */
export const SEMANTIC_TOKENS = [
	'--surface',
	'--surface-glow',
	'--surface-raised',
	'--surface-selected',
	'--on-surface',
	'--on-surface-muted',
	'--heading',
	'--border',
	'--accent',
	'--on-accent',
	'--focus',
	'--good',
	'--on-good',
	'--evil',
	'--on-evil',
	'--traveller',
	'--on-traveller',
	'--fabled',
	'--on-fabled',
	'--loric',
	'--on-loric',
	'--leaf',
	'--token-flower',
	'--token-flower-centre',
	'--token-face',
	'--token-rim',
	'--on-token',
	'--reminder-face',
	'--on-reminder',
	'--sheet',
	'--on-sheet',
	'--on-sheet-muted',
	'--button',
	'--on-button',
	'--backdrop',
	'--shadow'
] as const;

export type SemanticToken = (typeof SEMANTIC_TOKENS)[number];

/** Text/background pairs that must reach WCAG AA (4.5:1) in every theme. */
export const TEXT_PAIRS: readonly [text: SemanticToken, background: SemanticToken][] = [
	['--on-surface', '--surface'],
	['--on-surface', '--surface-glow'],
	['--on-surface', '--surface-raised'],
	['--on-surface', '--surface-selected'],
	['--on-surface-muted', '--surface'],
	['--on-surface-muted', '--surface-raised'],
	['--heading', '--surface'],
	['--heading', '--surface-glow'],
	['--on-accent', '--accent'],
	['--on-good', '--good'],
	['--on-evil', '--evil'],
	['--on-traveller', '--traveller'],
	['--on-fabled', '--fabled'],
	['--on-loric', '--loric'],
	['--on-token', '--token-face'],
	['--on-reminder', '--reminder-face'],
	['--on-sheet', '--sheet'],
	['--on-sheet-muted', '--sheet'],
	['--on-button', '--button']
];

export type CssVariable = `--${string}`;

export interface Theme {
	id: string;
	name: string;
	colorScheme: 'dark' | 'light';
	/** Raw colours, named by what they are (`--palette-parchment-200`). */
	palette: Record<CssVariable, string>;
	/** Semantic tokens: hex colours or `var(--palette-*)` references for colours. */
	tokens: Record<SemanticToken, string> & Record<CssVariable, string>;
	/** Optional overrides of component tokens (src/lib/ui/tokens/components.css). */
	components?: Record<CssVariable, string>;
	/** The theme's font for every role (see FONT_ROLE_INFO). */
	fonts: Record<FontRole, FontId>;
	/** Slot -> Iconify id; ids must be one of the slot's catalogue choices. */
	icons: Partial<Record<IconSlot, string>>;
	iconSet: IconSetId;
}
