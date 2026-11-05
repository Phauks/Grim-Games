/**
 * Moving board backgrounds (M43, Trevor 2026-11-03: "let's implement this"): Vortex, Fire,
 * Rain, Stars and Yin-yang, tried out in the background playground first. This file holds
 * what each one can be set to, its presets, and the check that cleans up a saved or shared
 * choice; the scenes that draw them are in features/grimoire/moving/.
 *
 * A moving background is shared with the table's grims by its id and settings, a few hundred
 * bytes, and every phone draws the same scene (Trevor, 2026-11-05: the Storyteller's
 * background, with a switch on each phone to hold it still).
 */

export type MovingParamValue = string | number | boolean;
export type MovingParams = Record<string, MovingParamValue>;

interface ParamBase {
	id: string;
	label: string;
	/** A switch this setting only matters while on; it stays in place, disabled, while off. */
	when?: string;
}
export interface ColourParam extends ParamBase {
	type: 'colour';
	/** As #rrggbb. */
	value: string;
}
export interface RangeParam extends ParamBase {
	type: 'range';
	value: number;
	min: number;
	max: number;
	step: number;
	/** How the value reads beside its slider. */
	unit?: 'times' | 'percent' | 'count' | 'perMinute';
}
export interface ToggleParam extends ParamBase {
	type: 'toggle';
	value: boolean;
}
export type MovingParam = ColourParam | RangeParam | ToggleParam;

export interface MovingBackground {
	id: MovingId;
	label: string;
	params: readonly MovingParam[];
	/** Named starting points; the first is the default. Each lists only what it changes. */
	presets: Readonly<Record<string, Readonly<MovingParams>>>;
}

const colour = (id: string, label: string, value: string): ColourParam => ({
	id,
	label,
	type: 'colour',
	value
});
const range = (
	id: string,
	label: string,
	value: number,
	[min, max, step]: [number, number, number],
	unit?: RangeParam['unit']
): RangeParam => ({ id, label, type: 'range', value, min, max, step, ...(unit ? { unit } : {}) });
const toggle = (id: string, label: string, value: boolean): ToggleParam => ({
	id,
	label,
	type: 'toggle',
	value
});

export const MOVING_IDS = ['vortex', 'fire', 'rain', 'stars', 'yinyang'] as const;
export type MovingId = (typeof MOVING_IDS)[number];

export const MOVING_BACKGROUNDS: Readonly<Record<MovingId, MovingBackground>> = {
	vortex: {
		id: 'vortex',
		label: 'Vortex',
		params: [
			colour('deep', 'Space', '#07031a'),
			colour('arms', 'Arms', '#5b2fd6'),
			colour('spark', 'Sparks', '#b48cff'),
			toggle('ring', 'Eye ring', true),
			{ ...colour('core', 'Ring colour', '#ffd9a8'), when: 'ring' },
			range('count', 'Arms', 3, [1, 7, 1], 'count'),
			range('twist', 'Twist', 1, [0.2, 2.5, 0.05], 'times'),
			range('spin', 'Spin', 0.35, [0, 1.5, 0.05], 'times'),
			range('particles', 'Sparkles', 4000, [0, 10000, 100], 'count')
		],
		presets: {
			Arcane: {},
			Abyss: { deep: '#01110f', arms: '#0f7a62', spark: '#5cf2c4', core: '#c8fff0', ring: false },
			Blood: { deep: '#120103', arms: '#8a0f1c', spark: '#ff4a3d', core: '#ffc2a0', twist: 1.4 },
			Celestial: {
				deep: '#0a0716',
				arms: '#a8771c',
				spark: '#ffd36b',
				core: '#fff4d6',
				count: 2,
				twist: 0.7
			},
			Frost: {
				deep: '#020a16',
				arms: '#2a6fb8',
				spark: '#9fd8ff',
				core: '#ffffff',
				count: 5,
				spin: 0.2
			}
		}
	},
	fire: {
		id: 'fire',
		label: 'Fire',
		params: [
			colour('deep', 'Smoke', '#160403'),
			colour('ember', 'Embers', '#8c1a05'),
			colour('flame', 'Flame', '#ff6a10'),
			colour('core', 'Hottest', '#ffe2a0'),
			range('height', 'Height', 0.55, [0.25, 1.2, 0.01], 'percent'),
			range('turbulence', 'Flicker', 1, [0.3, 2, 0.05], 'times'),
			range('wind', 'Wind', 0, [-1, 1, 0.05], 'times'),
			range('embers', 'Embers', 900, [0, 4000, 50], 'count')
		],
		presets: {
			Hellfire: {},
			Hearth: {
				deep: '#0d0604',
				ember: '#5c2208',
				flame: '#e0782a',
				core: '#ffe9bf',
				height: 0.38,
				turbulence: 0.7,
				embers: 400
			},
			Wildfire: { height: 0.95, turbulence: 1.6, wind: 0.35, embers: 2500 },
			Witchfire: { deep: '#03100a', ember: '#0d5a2c', flame: '#3ee07a', core: '#e6ffd0' },
			Soulfire: {
				deep: '#030716',
				ember: '#123a8a',
				flame: '#3fa0ff',
				core: '#e0f4ff',
				turbulence: 0.8
			}
		}
	},
	rain: {
		id: 'rain',
		label: 'Rain',
		params: [
			colour('skyTop', 'Sky', '#0b0f17'),
			colour('skyBottom', 'Horizon', '#1b2230'),
			colour('rain', 'Rain', '#9fb0c8'),
			colour('flash', 'Lightning', '#cfd8ff'),
			range('density', 'Drops', 4000, [500, 12000, 100], 'count'),
			range('speed', 'Fall speed', 1, [0.4, 2, 0.05], 'times'),
			range('wind', 'Wind', 0.25, [-1, 1, 0.05], 'times'),
			range('mist', 'Mist', 0.5, [0, 1, 0.05], 'percent'),
			range('lightning', 'Lightning a minute', 3, [0, 12, 1], 'perMinute'),
			toggle('splashes', 'Splashes', true)
		],
		presets: {
			Storm: {},
			Drizzle: {
				density: 1800,
				speed: 0.7,
				wind: 0.05,
				mist: 0.7,
				lightning: 0,
				skyTop: '#151a22',
				skyBottom: '#2a313c'
			},
			Tempest: { density: 11000, speed: 1.6, wind: 0.8, lightning: 10, mist: 0.35 },
			'Blood rain': {
				skyTop: '#120405',
				skyBottom: '#2a0a0c',
				rain: '#c0423f',
				flash: '#ffb0a0',
				lightning: 3
			}
		}
	},
	stars: {
		id: 'stars',
		label: 'Stars',
		params: [
			colour('skyTop', 'Sky', '#02030a'),
			colour('skyBottom', 'Horizon', '#0d1030'),
			colour('band', 'Band', '#6a5fd8'),
			colour('bandGlow', 'Band core', '#ffcf9a'),
			colour('tint', 'Star tint', '#ffffff'),
			range('bandStrength', 'Band', 0.8, [0, 1.6, 0.05], 'percent'),
			range('count', 'Stars', 3500, [500, 9000, 100], 'count'),
			range('twinkle', 'Twinkle', 0.7, [0, 1, 0.05], 'percent'),
			range('drift', 'Turn', 0.5, [0, 3, 0.05], 'times'),
			range('meteors', 'Shooting stars a minute', 4, [0, 15, 1], 'perMinute')
		],
		presets: {
			'Night sky': {},
			Dusk: {
				skyTop: '#0a0b24',
				skyBottom: '#3a1c3e',
				band: '#6a5acd',
				bandStrength: 0.4,
				count: 1800
			},
			Nebula: { band: '#d0368a', bandGlow: '#8ae0ff', bandStrength: 1.5, count: 5000 },
			Deep: {
				skyTop: '#000000',
				skyBottom: '#04050c',
				bandStrength: 0.25,
				twinkle: 0.4,
				meteors: 12,
				count: 2500
			}
		}
	},
	yinyang: {
		id: 'yinyang',
		label: 'Yin-yang',
		params: [
			colour('light', 'Light half', '#efe6d2'),
			colour('dark', 'Dark half', '#141316'),
			colour('back', 'Water', '#1c1a22'),
			colour('glow', 'Rim', '#c9a96e'),
			range('size', 'Size', 0.62, [0.3, 0.95, 0.01], 'percent'),
			range('spin', 'Turn', 0.15, [-1, 1, 0.01], 'times'),
			range('ink', 'Ink inside', 0.4, [0, 1, 0.05], 'percent'),
			range('wisps', 'Wisps', 0.5, [0, 1, 0.05], 'percent')
		],
		presets: {
			Classic: {},
			'Ink wash': {
				light: '#f4efe4',
				dark: '#1b1b1b',
				back: '#d9d2c3',
				glow: '#3a3a3a',
				wisps: 0.7
			},
			'Fire and water': { light: '#ff7a3d', dark: '#1d4f9e', back: '#120c16', glow: '#ffd29a' },
			Jade: { light: '#d8f0dc', dark: '#0f3d2c', back: '#0a1a14', glow: '#8fd1a6' }
		}
	}
};

export const isMovingId = (id: unknown): id is MovingId =>
	typeof id === 'string' && (MOVING_IDS as readonly string[]).includes(id);

/** A background's settings at their defaults. */
export function movingDefaults(id: MovingId): MovingParams {
	return Object.fromEntries(MOVING_BACKGROUNDS[id].params.map((p) => [p.id, p.value]));
}

/** A preset's settings in full; an unknown preset gives the defaults. */
export function movingPreset(id: MovingId, name: string): MovingParams {
	return { ...movingDefaults(id), ...(MOVING_BACKGROUNDS[id].presets[name] ?? {}) };
}

/** The preset these settings match exactly, if any. */
export function presetOf(id: MovingId, params: MovingParams): string | undefined {
	return Object.keys(MOVING_BACKGROUNDS[id].presets).find((name) => {
		const preset = movingPreset(id, name);
		return Object.keys(preset).every((key) => preset[key] === params[key]);
	});
}

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

/** One setting kept within its limits, or the default when it can't be used. */
function cleanParam(param: MovingParam, raw: unknown): MovingParamValue {
	if (param.type === 'colour')
		return typeof raw === 'string' && HEX_COLOUR.test(raw) ? raw.toLowerCase() : param.value;
	if (param.type === 'toggle') return typeof raw === 'boolean' ? raw : param.value;
	const n = typeof raw === 'number' ? raw : Number.NaN;
	if (!Number.isFinite(n)) return param.value;
	const stepped = Math.round((n - param.min) / param.step) * param.step + param.min;
	// Rounded to the step's own decimals, so 0.1 + 0.2 never saves as 0.30000000000000004.
	const decimals = (String(param.step).split('.')[1] ?? '').length;
	return Number(Math.min(param.max, Math.max(param.min, stepped)).toFixed(decimals));
}

export interface MovingChoice {
	id: MovingId;
	params: MovingParams;
}

/**
 * A saved or shared moving background, cleaned up: a known id, every setting present and
 * inside its limits, nothing else. Undefined when the id isn't one of ours, so a newer
 * build's background shows as no background on an older one instead of breaking.
 */
export function parseMoving(raw: unknown): MovingChoice | undefined {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
	const { id, params } = raw as { id?: unknown; params?: unknown };
	if (!isMovingId(id)) return undefined;
	const given = (params && typeof params === 'object' ? params : {}) as Record<string, unknown>;
	return {
		id,
		params: Object.fromEntries(
			MOVING_BACKGROUNDS[id].params.map((p) => [p.id, cleanParam(p, given[p.id])])
		)
	};
}

/** How a slider's value reads beside it. */
export function formatParam(param: RangeParam, value: number): string {
	if (param.unit === 'percent') return `${Math.round(value * 100)}%`;
	if (param.unit === 'count') return String(Math.round(value));
	if (param.unit === 'perMinute') return value === 0 ? 'None' : String(Math.round(value));
	return `${value.toFixed(2)}×`;
}

/**
 * How a device moves a moving background, kept on that device (Trevor, 2026-11-03):
 * - `fps`: 'screen' draws once per screen refresh (vsync); 30 halves the work on a 60 Hz
 *   screen and saves battery;
 * - `reduceMotion`: what the phone's Reduce motion setting means here: hold the scene still,
 *   move it gently (a third of the speed, no lightning or shooting stars), or ignore it;
 * - `still`: this device holds every moving background still (Trevor, 2026-11-05: each
 *   player's switch).
 */
export interface MovingMotion {
	fps: 'screen' | '30';
	reduceMotion: 'still' | 'gentle' | 'ignore';
	still: boolean;
}
export const DEFAULT_MOVING_MOTION: MovingMotion = {
	fps: 'screen',
	reduceMotion: 'still',
	still: false
};

export function parseMovingMotion(raw: unknown): MovingMotion {
	const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	return {
		fps: value.fps === '30' ? '30' : 'screen',
		reduceMotion:
			value.reduceMotion === 'gentle' || value.reduceMotion === 'ignore'
				? value.reduceMotion
				: 'still',
		still: value.still === true
	};
}

/**
 * How a scene runs on this device right now: held still, or at what speed, with which
 * settings. Gentle motion slows it to a third and turns off what flashes or streaks.
 */
export function movingRun(
	choice: MovingChoice,
	motion: MovingMotion,
	reducedMotion: boolean
): { still: boolean; speed: number; params: MovingParams } {
	const mode = reducedMotion ? motion.reduceMotion : 'ignore';
	if (motion.still || mode === 'still') return { still: true, speed: 0, params: choice.params };
	if (mode === 'gentle') {
		const params = { ...choice.params };
		if ('lightning' in params) params.lightning = 0;
		if ('meteors' in params) params.meteors = 0;
		return { still: false, speed: 0.35, params };
	}
	return { still: false, speed: 1, params: choice.params };
}
