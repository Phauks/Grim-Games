/**
 * Settings profiles (plan S18, Trevor 2026-10-23: "save backgrounds and settings as
 * profiles, and when they are starting a game, they can shift between profiles"). A profile is
 * a named set of the Theme, Text, Icons, Board, Tokens, Storyteller and Sound settings. What
 * belongs to the device (Player, Data, Account, Allow zoom, volume, language, a game's own
 * background) is never in one. Profiles sync with a signed-in account; an uploaded background
 * picture stays on the device that added it (an account document is at most 1 MB).
 */
import {
	PRESETS,
	type BackgroundChoice,
	type PresetId
} from '#lib/features/grimoire/backgrounds.ts';
import { parseBoardLooks, type BoardLooks } from '#lib/features/grimoire/board-looks.svelte.ts';
import { parseStepFocus, type StepFocus } from '#lib/features/grimoire/step-focus.svelte.ts';
import { parsePreferences, type Preferences } from '#lib/ui/preferences.ts';

/** Preferences that stay with the device whichever profile is in use. */
export const DEVICE_PREFERENCES = [
	'allowZoom',
	'soundVolume',
	'speaker'
] as const satisfies readonly (keyof Preferences)[];
type DevicePreference = (typeof DEVICE_PREFERENCES)[number];

/** The background for all games, as a profile keeps it; a picture is only marked, not kept. */
export type BackgroundRef =
	{ kind: 'none' } | { kind: 'script' } | { kind: 'preset'; id: PresetId } | { kind: 'image' };

export interface ProfileValues {
	preferences: Omit<Preferences, DevicePreference>;
	boardLooks: BoardLooks;
	stepFocus: StepFocus;
	background: BackgroundRef;
}

export interface SettingsProfile {
	id: string;
	name: string;
	values: ProfileValues;
}

/** What this device keeps: every profile, the default one and the one in use. */
export interface ProfilesState {
	schemaVersion: 1;
	profiles: SettingsProfile[];
	defaultId: string;
	activeId: string;
}

/** A profile as an account document: everything but its id, which is the document's. */
export interface ProfileBody {
	schemaVersion: 1;
	name: string;
	values: ProfileValues;
}

/** Longest profile name; longer names are cut. */
export const NAME_MAX = 40;

const record = (raw: unknown): Record<string, unknown> =>
	(raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

export function withoutDevicePreferences(prefs: Preferences): ProfileValues['preferences'] {
	const values: Partial<Preferences> = { ...prefs };
	for (const key of DEVICE_PREFERENCES) delete values[key];
	return values as ProfileValues['preferences'];
}

export function backgroundRef(choice: BackgroundChoice | undefined): BackgroundRef {
	if (!choice || choice.kind === 'none') return { kind: 'none' };
	if (choice.kind === 'preset') return { kind: 'preset', id: choice.id };
	return { kind: choice.kind };
}

function parseBackgroundRef(raw: unknown): BackgroundRef {
	const value = record(raw);
	if (value.kind === 'script' || value.kind === 'image') return { kind: value.kind };
	if (value.kind === 'preset' && typeof value.id === 'string' && value.id in PRESETS)
		return { kind: 'preset', id: value.id as PresetId };
	return { kind: 'none' };
}

/** Builds valid values from anything; whatever is missing or damaged takes its default. */
export function parseProfileValues(raw: unknown): ProfileValues {
	const value = record(raw);
	return {
		preferences: withoutDevicePreferences(parsePreferences(value.preferences)),
		boardLooks: parseBoardLooks(value.boardLooks),
		stepFocus: parseStepFocus(value.stepFocus),
		background: parseBackgroundRef(value.background)
	};
}

export function cleanName(name: unknown): string {
	return typeof name === 'string' ? name.trim().slice(0, NAME_MAX) : '';
}

/** A profile, or undefined when it can't be read (no id or name). */
export function parseProfile(raw: unknown): SettingsProfile | undefined {
	const value = record(raw);
	const name = cleanName(value.name);
	if (typeof value.id !== 'string' || !value.id || !name) return undefined;
	return { id: value.id, name, values: parseProfileValues(value.values) };
}

export function parseProfileBody(raw: unknown, id: string): SettingsProfile | undefined {
	const value = record(raw);
	if (value.schemaVersion !== 1) return undefined;
	return parseProfile({ ...value, id });
}

export function profileBody(profile: SettingsProfile): ProfileBody {
	return { schemaVersion: 1, name: profile.name, values: profile.values };
}

/**
 * What this device stored, or undefined when there is nothing usable (first run) or a newer
 * build wrote it. The default and the one in use always name a profile in the list.
 */
export function parseProfilesState(raw: unknown): ProfilesState | undefined {
	const value = record(raw);
	if (value.schemaVersion !== 1 || !Array.isArray(value.profiles)) return undefined;
	const profiles: SettingsProfile[] = [];
	for (const item of value.profiles) {
		const profile = parseProfile(item);
		if (profile && !profiles.some((p) => p.id === profile.id)) profiles.push(profile);
	}
	if (profiles.length === 0) return undefined;
	const known = (id: unknown) => typeof id === 'string' && profiles.some((p) => p.id === id);
	const defaultId = known(value.defaultId) ? (value.defaultId as string) : profiles[0].id;
	const activeId = known(value.activeId) ? (value.activeId as string) : defaultId;
	return { schemaVersion: 1, profiles, defaultId, activeId };
}

/** The first "<base>", "<base> 2", "<base> 3" ... no profile uses yet. */
export function freeName(base: string, profiles: readonly SettingsProfile[]): string {
	const taken = new Set(profiles.map((p) => p.name.toLocaleLowerCase()));
	if (!taken.has(base.toLocaleLowerCase())) return base;
	for (let n = 2; ; n++) {
		const name = `${base} ${n}`;
		if (!taken.has(name.toLocaleLowerCase())) return name;
	}
}

/**
 * The list after `id` is deleted, with the default and the one in use moved to the first
 * profile left when they were the deleted one. The last profile can't be deleted.
 */
export function withoutProfile(state: ProfilesState, id: string): ProfilesState {
	const profiles = state.profiles.filter((p) => p.id !== id);
	if (profiles.length === 0 || profiles.length === state.profiles.length) return state;
	const defaultId = state.defaultId === id ? profiles[0].id : state.defaultId;
	return {
		...state,
		profiles,
		defaultId,
		activeId: state.activeId === id ? defaultId : state.activeId
	};
}

export function sameValues(a: ProfileValues, b: ProfileValues): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

/** Which profile each game uses, by game id; entries naming no profile are dropped. */
export function parseGameProfiles(raw: unknown): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [gameId, profileId] of Object.entries(record(raw)))
		if (typeof profileId === 'string' && profileId) out[gameId] = profileId;
	return out;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
	!!value && typeof value === 'object' && !Array.isArray(value);

function countChanges(value: unknown, base: unknown): number {
	if (isObject(value) && isObject(base)) {
		let changes = 0;
		for (const key of new Set([...Object.keys(value), ...Object.keys(base)]))
			changes += countChanges(value[key], base[key]);
		return changes;
	}
	return JSON.stringify(value) === JSON.stringify(base) ? 0 : 1;
}

/**
 * How many settings a profile has changed from the app's defaults (Trevor, 2026-10-25: players
 * need more in a profile to choose one): each setting, custom colour or font counts once.
 */
export function changedSettings(values: ProfileValues): number {
	// The background is one choice, not a kind and an id.
	const { background, ...settings } = values;
	const { background: noBackground, ...defaults } = parseProfileValues(null);
	return countChanges(settings, defaults) + countChanges([background], [noBackground]);
}

/** The saved games a profile was used for, and when the newest was last saved. */
export interface ProfileUse {
	games: number;
	lastSaved?: number;
}

/** Counts only games still saved on the device, so a deleted game isn't counted. */
export function profileUse(
	profileId: string,
	gameProfiles: Readonly<Record<string, string>>,
	saved: readonly { gameId: string; savedAt: number }[]
): ProfileUse {
	const use: ProfileUse = { games: 0 };
	for (const game of saved) {
		if (gameProfiles[game.gameId] !== profileId) continue;
		use.games++;
		use.lastSaved = Math.max(use.lastSaved ?? 0, game.savedAt);
	}
	return use;
}
