/**
 * User-selectable fonts (06-visuals-and-ui-kit.md §5). All are SIL OFL 1.1 and self-hosted
 * through Fontsource, so they work offline. Each font's CSS is a dynamic import: Vite emits
 * it as its own chunk and only the fonts a device actually uses are fetched.
 */

export type FontRole = 'display' | 'text' | 'both';

export interface FontInfo {
	id: FontId;
	family: string;
	/** Fallbacks used while the font loads or if it fails. */
	fallback: string;
	role: FontRole;
	/** Weight used when this font sets titles; only weights that ship are used. */
	displayWeight: 400 | 600;
	note?: string;
	load: () => Promise<unknown>;
}

export const FONT_IDS = [
	'cinzel',
	'im-fell-english-sc',
	'eb-garamond',
	'inter',
	'atkinson-hyperlegible-next',
	'lexend'
] as const;
export type FontId = (typeof FONT_IDS)[number];

const serif = "'Times New Roman', serif";
const sans = 'system-ui, sans-serif';

export const FONTS: Record<FontId, FontInfo> = {
	cinzel: {
		id: 'cinzel',
		family: 'Cinzel',
		fallback: serif,
		role: 'display',
		displayWeight: 600,
		load: () => import('@fontsource/cinzel/600.css')
	},
	'im-fell-english-sc': {
		id: 'im-fell-english-sc',
		family: 'IM Fell English SC',
		fallback: serif,
		role: 'display',
		displayWeight: 400,
		load: () => import('@fontsource/im-fell-english-sc/400.css')
	},
	'eb-garamond': {
		id: 'eb-garamond',
		family: 'EB Garamond',
		fallback: serif,
		role: 'both',
		displayWeight: 600,
		load: () =>
			Promise.all([
				import('@fontsource/eb-garamond/400.css'),
				import('@fontsource/eb-garamond/600.css'),
				import('@fontsource/eb-garamond/400-italic.css')
			])
	},
	inter: {
		id: 'inter',
		family: 'Inter',
		fallback: sans,
		role: 'both',
		displayWeight: 600,
		load: () =>
			Promise.all([import('@fontsource/inter/400.css'), import('@fontsource/inter/600.css')])
	},
	'atkinson-hyperlegible-next': {
		id: 'atkinson-hyperlegible-next',
		family: 'Atkinson Hyperlegible Next',
		fallback: sans,
		role: 'both',
		displayWeight: 600,
		note: 'Readability',
		load: () =>
			Promise.all([
				import('@fontsource/atkinson-hyperlegible-next/400.css'),
				import('@fontsource/atkinson-hyperlegible-next/600.css')
			])
	},
	lexend: {
		id: 'lexend',
		family: 'Lexend',
		fallback: sans,
		role: 'both',
		displayWeight: 600,
		note: 'Readability',
		load: () =>
			Promise.all([import('@fontsource/lexend/400.css'), import('@fontsource/lexend/600.css')])
	}
};

export function isFontId(value: unknown): value is FontId {
	return (FONT_IDS as readonly unknown[]).includes(value);
}

export function fontsFor(role: 'display' | 'text'): FontInfo[] {
	return FONT_IDS.map((id) => FONTS[id]).filter((f) => f.role === role || f.role === 'both');
}

export function fontStack(id: FontId): string {
	const font = FONTS[id];
	return `'${font.family}', ${font.fallback}`;
}

const loading = new Map<FontId, Promise<unknown>>();

/** Loads a font's CSS once; failures are forgotten so a later call can retry. */
export function loadFont(id: FontId): Promise<unknown> {
	let promise = loading.get(id);
	if (!promise) {
		promise = FONTS[id].load().catch((error) => {
			loading.delete(id);
			console.warn(`Could not load font ${id}`, error);
		});
		loading.set(id, promise);
	}
	return promise;
}
