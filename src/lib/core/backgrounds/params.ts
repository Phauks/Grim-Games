/**
 * What a built-in background can be set to, for the still ones (M72) and the animated ones
 * (M43) alike: its settings, its named presets, and the clean-up that keeps a saved or shared
 * choice inside its limits. One Customise dialog edits either kind.
 */

export type ParamValue = string | number | boolean;
export type Params = Record<string, ParamValue>;

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
export type BackgroundParam = ColourParam | RangeParam | ToggleParam;

/** A background's settings and presets. */
export interface ParamSet {
	label: string;
	params: readonly BackgroundParam[];
	/** Named starting points; the first is the default. Each lists only what it changes. */
	presets: Readonly<Record<string, Readonly<Params>>>;
}

export const colour = (id: string, label: string, value: string): ColourParam => ({
	id,
	label,
	type: 'colour',
	value
});
export const range = (
	id: string,
	label: string,
	value: number,
	[min, max, step]: [number, number, number],
	unit?: RangeParam['unit']
): RangeParam => ({ id, label, type: 'range', value, min, max, step, ...(unit ? { unit } : {}) });
export const toggle = (id: string, label: string, value: boolean): ToggleParam => ({
	id,
	label,
	type: 'toggle',
	value
});

/** A background's settings at their defaults. */
export function paramDefaults(set: ParamSet): Params {
	return Object.fromEntries(set.params.map((p) => [p.id, p.value]));
}

/** A preset's settings in full; an unknown preset gives the defaults. */
export function paramPreset(set: ParamSet, name: string): Params {
	return { ...paramDefaults(set), ...(set.presets[name] ?? {}) };
}

/** The preset these settings match exactly, if any. */
export function matchingPreset(set: ParamSet, params: Params): string | undefined {
	return Object.keys(set.presets).find((name) => {
		const preset = paramPreset(set, name);
		return Object.keys(preset).every((key) => preset[key] === params[key]);
	});
}

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

/** One setting kept within its limits, or the default when it can't be used. */
function cleanParam(param: BackgroundParam, raw: unknown): ParamValue {
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

/** Every setting present and inside its limits, nothing else. */
export function cleanParams(set: ParamSet, raw: unknown): Params {
	const given = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	return Object.fromEntries(set.params.map((p) => [p.id, cleanParam(p, given[p.id])]));
}

/** How a slider's value reads beside it. */
export function formatParam(param: RangeParam, value: number): string {
	if (param.unit === 'percent') return `${Math.round(value * 100)}%`;
	if (param.unit === 'count') return String(Math.round(value));
	if (param.unit === 'perMinute') return value === 0 ? 'None' : String(Math.round(value));
	return `${value.toFixed(2)}×`;
}
