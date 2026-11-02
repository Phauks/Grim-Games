/**
 * Moving backgrounds (plan L113): twelve built-in board backgrounds that move behind the
 * board. Each is an ordinary preset (BackgroundChoice `{ kind: 'preset', id }`), so choosing,
 * saving and sharing it with the table's grims work as for any other preset. Its `css` is the
 * still frame: the swatch in Settings, and what shows while moving backgrounds are off, the
 * device asks for less motion, or WebGL is unavailable. `scene` names how the moving layer is
 * drawn: in CSS (css-scenes.ts) or by a WebGL fragment shader (shaders.ts).
 */
export type SceneKind = 'css' | 'shader';

export interface ScenePreset {
	label: string;
	css: string;
	scene: { kind: SceneKind };
}

export const SCENE_PRESETS = {
	hellfire: {
		label: 'Hellfire',
		scene: { kind: 'shader' },
		css: [
			'radial-gradient(ellipse 70% 45% at 50% 100%, oklch(0.78 0.18 60) 0%, oklch(0.58 0.21 38) 35%, transparent 75%)',
			'linear-gradient(to bottom, oklch(0.1 0.02 20) 0%, oklch(0.2 0.08 25) 45%, oklch(0.42 0.17 32) 100%)'
		].join(', ')
	},
	lava: {
		label: 'Lava flow',
		scene: { kind: 'shader' },
		css: [
			'radial-gradient(ellipse 40% 30% at 30% 40%, oklch(0.62 0.2 42 / 0.6), transparent 70%)',
			'radial-gradient(ellipse 35% 25% at 72% 70%, oklch(0.56 0.2 35 / 0.5), transparent 70%)',
			'radial-gradient(ellipse 30% 20% at 60% 15%, oklch(0.5 0.18 35 / 0.4), transparent 70%)',
			'oklch(0.16 0.04 30)'
		].join(', ')
	},
	beach: {
		label: 'Tropical beach',
		scene: { kind: 'css' },
		css: [
			'radial-gradient(circle at 66% 33%, oklch(0.98 0.06 95) 0 5%, oklch(0.9 0.12 85 / 0.5) 7%, transparent 14%)',
			'linear-gradient(to bottom, oklch(0.5 0.1 235) 0%, oklch(0.72 0.09 215) 30%, oklch(0.86 0.08 80) 45%, oklch(0.62 0.11 210) 45%, oklch(0.7 0.11 185) 68%, oklch(0.95 0.03 200) 70%, oklch(0.8 0.07 85) 72%, oklch(0.66 0.08 65) 100%)'
		].join(', ')
	},
	underwater: {
		label: 'Underwater',
		scene: { kind: 'shader' },
		css: [
			'radial-gradient(ellipse 80% 40% at 50% 0%, oklch(0.6 0.1 205 / 0.6), transparent 70%)',
			'linear-gradient(to bottom, oklch(0.42 0.09 215) 0%, oklch(0.24 0.07 235) 60%, oklch(0.12 0.05 245) 100%)'
		].join(', ')
	},
	stars: {
		label: 'Starry night',
		scene: { kind: 'shader' },
		css: [
			'radial-gradient(circle at 30% 40%, oklch(0.96 0.01 260) 0 0.06rem, transparent 0.08rem) 0 0 / 1.9rem 1.9rem',
			'radial-gradient(circle at 75% 65%, oklch(0.92 0.02 240) 0 0.05rem, transparent 0.07rem) 0.7rem 1.3rem / 3.1rem 3.1rem',
			'radial-gradient(circle at 45% 80%, oklch(0.98 0 0) 0 0.08rem, transparent 0.1rem) 1.2rem 0.4rem / 4.7rem 4.7rem',
			'linear-gradient(160deg, transparent 30%, oklch(0.3 0.06 285 / 0.5) 45%, transparent 60%)',
			'linear-gradient(to bottom, oklch(0.05 0.02 270) 0%, oklch(0.13 0.04 275) 100%)'
		].join(', ')
	},
	aurora: {
		label: 'Aurora',
		scene: { kind: 'css' },
		css: [
			'radial-gradient(ellipse 70% 25% at 50% 40%, oklch(0.68 0.17 160 / 0.55), transparent 70%)',
			'radial-gradient(ellipse 50% 20% at 35% 30%, oklch(0.55 0.16 200 / 0.4), transparent 70%)',
			'linear-gradient(to bottom, oklch(0.06 0.02 250) 0%, oklch(0.13 0.04 205) 76%, oklch(0.05 0.015 210) 77%)'
		].join(', ')
	},
	storm: {
		label: 'Thunderstorm',
		scene: { kind: 'shader' },
		css: [
			'radial-gradient(ellipse 60% 30% at 30% 20%, oklch(0.36 0.02 255 / 0.7), transparent 70%)',
			'linear-gradient(to bottom, oklch(0.26 0.02 255) 0%, oklch(0.16 0.02 255) 60%, oklch(0.1 0.015 250) 82%, oklch(0.06 0.01 250) 83%)'
		].join(', ')
	},
	fog: {
		label: 'Graveyard fog',
		scene: { kind: 'css' },
		css: [
			'radial-gradient(circle at 18% 14%, oklch(0.92 0.03 105) 0 4%, oklch(0.6 0.04 190 / 0.4) 5%, transparent 25%)',
			'linear-gradient(to top, oklch(0.04 0.01 200) 0 8%, oklch(0.5 0.03 195 / 0.6) 9%, transparent 40%)',
			'linear-gradient(to bottom, oklch(0.26 0.03 205) 0%, oklch(0.12 0.02 195) 100%)'
		].join(', ')
	},
	snow: {
		label: 'Snowfall',
		scene: { kind: 'shader' },
		css: [
			'radial-gradient(circle at 25% 35%, oklch(0.95 0 0) 0 0.12rem, transparent 0.15rem) 0 0 / 2.6rem 2.6rem',
			'radial-gradient(circle at 70% 60%, oklch(0.9 0 0) 0 0.08rem, transparent 0.1rem) 0.8rem 1.1rem / 1.7rem 1.7rem',
			'radial-gradient(ellipse 120% 40% at 50% 100%, oklch(0.72 0.03 250) 0 45%, transparent 46%)',
			'linear-gradient(to bottom, oklch(0.12 0.04 265) 0%, oklch(0.27 0.05 255) 100%)'
		].join(', ')
	},
	sunset: {
		label: 'Sunset clouds',
		scene: { kind: 'css' },
		css: [
			'radial-gradient(circle at 50% 78%, oklch(0.98 0.06 95) 0 6%, oklch(0.88 0.13 75 / 0.6) 8%, transparent 40%)',
			'linear-gradient(to bottom, oklch(0.2 0.07 300) 0%, oklch(0.36 0.11 320) 30%, oklch(0.55 0.16 15) 58%, oklch(0.7 0.16 45) 78%, oklch(0.1 0.04 330) 86%)'
		].join(', ')
	},
	fireflies: {
		label: 'Firefly wood',
		scene: { kind: 'css' },
		css: [
			'radial-gradient(circle at 40% 50%, oklch(0.95 0.15 120) 0 0.1rem, oklch(0.85 0.18 125 / 0.4) 0.2rem, transparent 0.4rem) 0 0 / 3.3rem 2.9rem',
			'radial-gradient(circle at 70% 30%, oklch(0.95 0.15 120) 0 0.08rem, transparent 0.3rem) 1.1rem 0.6rem / 4.1rem 3.7rem',
			'linear-gradient(to bottom, oklch(0.16 0.035 165) 0%, oklch(0.12 0.03 160) 55%, oklch(0.05 0.015 150) 100%)'
		].join(', ')
	},
	void: {
		label: 'Arcane void',
		scene: { kind: 'css' },
		css: [
			'radial-gradient(circle at 50% 50%, oklch(0.85 0.12 300 / 0.7), oklch(0.6 0.2 300 / 0.3) 12%, transparent 35%)',
			'radial-gradient(ellipse 80% 80% at 50% 50%, oklch(0.2 0.09 300), oklch(0.1 0.05 295) 55%, oklch(0.05 0.02 290))'
		].join(', ')
	}
} as const satisfies Record<string, ScenePreset>;

type Scenes = typeof SCENE_PRESETS;
/** The scenes drawn by each kind of moving layer: their registries must hold exactly these. */
export type SceneIdOf<K extends SceneKind> = {
	[Id in keyof Scenes]: Scenes[Id]['scene']['kind'] extends K ? Id : never;
}[keyof Scenes];
