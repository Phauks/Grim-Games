import type { Theme } from '../types.ts';

/**
 * Grimoire (06-visuals-and-ui-kit.md, decision 1): leather and parchment, cream tokens with
 * red rims, Cinzel display type. Colours follow spikes/grimoire.png.
 */
export const grimoire: Theme = {
	id: 'grimoire',
	name: 'Grimoire',
	colorScheme: 'dark',
	palette: {
		'--palette-leather-950': '#140b0b',
		'--palette-leather-900': '#1c110e',
		'--palette-leather-800': '#2a1813',
		'--palette-leather-700': '#3a2219',
		'--palette-wine-800': '#3a1d1d',
		'--palette-parchment-50': '#f8f0dc',
		'--palette-parchment-100': '#f4e9cf',
		'--palette-parchment-200': '#efe2c4',
		'--palette-parchment-400': '#cdb88e',
		'--palette-parchment-500': '#b9a782',
		'--palette-ink-900': '#2b160f',
		'--palette-ink-800': '#3a1a12',
		'--palette-ink-600': '#5e4334',
		'--palette-blood-700': '#8c2a1c',
		'--palette-blood-600': '#a3301f',
		'--palette-gold-400': '#e7c873',
		'--palette-arcane-600': '#5c3d8a',
		'--palette-lapis-700': '#1f4a7a',
		'--palette-plum-700': '#563463',
		'--palette-ochre-800': '#6b4a10',
		'--palette-moss-800': '#24513f',
		'--palette-leaf-500': '#5f9a3c',
		'--palette-amber-500': '#d07a22',
		'--palette-black': '#000000'
	},
	tokens: {
		'--surface': 'var(--palette-leather-950)',
		'--surface-glow': 'var(--palette-wine-800)',
		'--surface-raised': 'var(--palette-leather-800)',
		'--surface-selected': 'var(--palette-leather-700)',
		'--surface-texture':
			'radial-gradient(circle at 50% 25%, var(--palette-wine-800), var(--palette-leather-950) 75%)',
		'--on-surface': 'var(--palette-parchment-200)',
		'--on-surface-muted': 'var(--palette-parchment-500)',
		'--heading': 'var(--palette-gold-400)',
		'--border': 'rgb(239 226 196 / 0.2)',
		'--accent': 'var(--palette-blood-700)',
		'--on-accent': 'var(--palette-parchment-100)',
		'--focus': 'var(--palette-gold-400)',
		'--good': 'var(--palette-lapis-700)',
		'--on-good': 'var(--palette-parchment-100)',
		'--evil': 'var(--palette-blood-700)',
		'--on-evil': 'var(--palette-parchment-100)',
		'--traveller': 'var(--palette-plum-700)',
		'--on-traveller': 'var(--palette-parchment-100)',
		'--fabled': 'var(--palette-ochre-800)',
		'--on-fabled': 'var(--palette-parchment-100)',
		'--loric': 'var(--palette-moss-800)',
		'--on-loric': 'var(--palette-parchment-100)',
		'--leaf': 'var(--palette-leaf-500)',
		'--token-flower': 'var(--palette-amber-500)',
		'--token-flower-centre': 'var(--palette-gold-400)',
		'--token-face': 'var(--palette-parchment-100)',
		'--token-face-shade': 'var(--palette-parchment-400)',
		'--token-rim': 'var(--palette-blood-700)',
		'--on-token': 'var(--palette-ink-800)',
		'--reminder-face': 'var(--palette-arcane-600)',
		'--on-reminder': 'var(--palette-parchment-200)',
		'--sheet': 'var(--palette-parchment-200)',
		'--on-sheet': 'var(--palette-ink-900)',
		'--on-sheet-muted': 'var(--palette-ink-600)',
		'--button': 'var(--palette-ink-900)',
		'--on-button': 'var(--palette-parchment-200)',
		'--backdrop': 'rgb(0 0 0 / 0.55)',
		'--shadow': '0 4px 12px rgb(0 0 0 / 0.6)'
	},
	components: {
		'--seat-face':
			'radial-gradient(circle at 40% 35%, var(--palette-parchment-100), var(--palette-parchment-400))'
	},
	fonts: {
		heading: 'cinzel',
		character: 'cinzel',
		ability: 'eb-garamond',
		player: 'eb-garamond',
		control: 'cinzel',
		body: 'eb-garamond'
	},
	icons: {
		dead: 'ph:skull',
		ghostVote: 'ph:ghost',
		poisoned: 'ph:flask',
		drunk: 'ph:beer-stein',
		protected: 'ph:shield',
		night: 'ph:moon-stars',
		day: 'ph:sun',
		vote: 'ph:hand-palm',
		demon: 'ph:mask-sad',
		bag: 'ph:handbag',
		undo: 'ph:arrow-counter-clockwise',
		notes: 'ph:note-pencil'
	},
	iconSet: 'ph-regular'
};
