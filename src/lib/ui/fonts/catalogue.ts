/**
 * User-selectable fonts (06-visuals-and-ui-kit.md §5). All are SIL OFL 1.1 and self-hosted
 * through Fontsource, so they work offline. Each font's CSS is a dynamic import: Vite emits
 * it as its own chunk and only the fonts a device actually uses are fetched.
 */

import { reportError } from '#lib/features/errors/report.svelte.ts';

/**
 * Where a font may be used. `display` fonts (all capitals or small capitals) only suit short
 * names and titles; `both` fonts also work for running text.
 */
export type FontUse = 'display' | 'both';

export interface FontInfo {
	id: FontId;
	family: string;
	/** Fallbacks used while the font loads or if it fails. */
	fallback: string;
	use: FontUse;
	/** Weight used when this font sets short names and titles; only weights that ship are used. */
	displayWeight: 400 | 600;
	/** Shown under the font's name in the picker. */
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
		use: 'display',
		displayWeight: 600,
		load: () => import('@fontsource/cinzel/600.css')
	},
	'im-fell-english-sc': {
		id: 'im-fell-english-sc',
		family: 'IM Fell English SC',
		fallback: serif,
		use: 'display',
		displayWeight: 400,
		load: () => import('@fontsource/im-fell-english-sc/400.css')
	},
	'eb-garamond': {
		id: 'eb-garamond',
		family: 'EB Garamond',
		fallback: serif,
		use: 'both',
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
		use: 'both',
		displayWeight: 600,
		load: () =>
			Promise.all([import('@fontsource/inter/400.css'), import('@fontsource/inter/600.css')])
	},
	'atkinson-hyperlegible-next': {
		id: 'atkinson-hyperlegible-next',
		family: 'Atkinson Hyperlegible Next',
		fallback: sans,
		use: 'both',
		displayWeight: 600,
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
		use: 'both',
		displayWeight: 600,
		load: () =>
			Promise.all([import('@fontsource/lexend/400.css'), import('@fontsource/lexend/600.css')])
	}
};

export function isFontId(value: unknown): value is FontId {
	return (FONT_IDS as readonly unknown[]).includes(value);
}

/**
 * The font roles: every piece of text in the app is set in exactly one of them, through the
 * role's CSS variable (`--font-<role>`). Short-text roles also get `--font-<role>-weight`.
 * Components use these variables (or component tokens built from them), never a font name.
 */
export const FONT_ROLES = [
	'heading',
	'character',
	'reminder',
	'ability',
	'player',
	'control',
	'body'
] as const;
export type FontRole = (typeof FONT_ROLES)[number];

export interface FontRoleInfo {
	id: FontRole;
	/** Settings label: names the role. */
	label: string;
	/** Settings hint: exactly where the role shows. */
	description: string;
	/** Preview line in Settings. */
	sample: string;
	/** `short` roles set names and titles, so they also offer the display-only fonts. */
	length: 'short' | 'running';
}

export const FONT_ROLE_INFO: Record<FontRole, FontRoleInfo> = {
	heading: {
		id: 'heading',
		label: 'Headings',
		description: 'Page, section, dialog and sheet titles, and the app name in the header.',
		sample: 'First night',
		length: 'short'
	},
	character: {
		id: 'character',
		label: 'Character names',
		description:
			'Character badges, character names on reference cards and tables, and night order steps such as Dusk.',
		sample: 'Washerwoman · Imp',
		length: 'short'
	},
	reminder: {
		id: 'reminder',
		label: 'Reminder tokens',
		description:
			'The words on reminder tokens, such as Poisoned or Is the Drunk, wherever they show: the grimoire, reference cards and night steps.',
		sample: 'Poisoned · Is the Drunk',
		length: 'running'
	},
	ability: {
		id: 'ability',
		label: 'Ability and rules text',
		description:
			'Ability text, jinxes, Storyteller night text and pre-day reminders, on reference cards and in the game.',
		sample: 'Each night, choose a player: they are poisoned.',
		length: 'running'
	},
	player: {
		id: 'player',
		label: 'Player names',
		description:
			'Seats in the grimoire and in the nomination strip, and player names next to character badges.',
		sample: 'Alex · Sam · Jo',
		length: 'short'
	},
	control: {
		id: 'control',
		label: 'Buttons, tabs and labels',
		description:
			'Buttons, tabs, choices, switches, setting names, settings menu, field and table labels.',
		sample: 'Night order',
		length: 'short'
	},
	body: {
		id: 'body',
		label: 'Body text',
		description: 'Descriptions and hints, settings help, messages, notes, logs and night answers.',
		sample: 'Alex nominates Sam.',
		length: 'running'
	}
};

export const isFontRole = (value: unknown): value is FontRole =>
	(FONT_ROLES as readonly unknown[]).includes(value);

/** The CSS variable a role's font stack is written to. */
export const fontVariable = (role: FontRole) => `--font-${role}` as const;
/** The CSS variable a short role's weight is written to. */
export const fontWeightVariable = (role: FontRole) => `--font-${role}-weight` as const;

/** Fonts offered for a role: display-only fonts are left out of running-text roles. */
export function fontsFor(role: FontRole): FontInfo[] {
	const running = FONT_ROLE_INFO[role].length === 'running';
	return FONT_IDS.map((id) => FONTS[id]).filter((f) => !running || f.use === 'both');
}

export function isFontFor(role: FontRole, value: unknown): value is FontId {
	return isFontId(value) && fontsFor(role).some((f) => f.id === value);
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
			// The fallback font shows instead, so this is only logged.
			reportError(error, { area: 'settings', notify: false });
		});
		loading.set(id, promise);
	}
	return promise;
}
