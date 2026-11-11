/**
 * Settings that follow a signed-in account (Trevor, 2026-11-09: settings profiles removed;
 * "sizes per device"). Sizes and layout stay with the device, because a phone and a laptop
 * want different ones; everything else is one set that every device signed in to the account
 * shares. An uploaded background picture also stays on the device that added it (an account
 * document is at most 1 MB); other devices only learn that a picture was chosen.
 */
import { parseMoving, type MovingChoice } from '#lib/core/backgrounds/moving.ts';
import { parseStill, type StillChoice } from '#lib/core/backgrounds/still.ts';
import type { BackgroundChoice } from '#lib/features/board/backgrounds.ts';
import { parseBoardLooks, type BoardLooks } from '#lib/features/board/board-looks.svelte.ts';
import { parseStepFocus, type StepFocus } from '#lib/features/board/step-focus.svelte.ts';
import { parsePreferences, type Preferences } from '#lib/ui/preferences.ts';
import type { TokenAppearance } from '#lib/ui/token/token-appearance.ts';

/** Preferences each device keeps for itself: sizes, layout and the device's own sound and screen. */
export const DEVICE_PREFERENCES = [
	'textScale',
	'textAlign',
	'iconScale',
	'characterIconScale',
	'allowZoom',
	'soundVolume',
	'speaker',
	'soundOutput',
	'timerKeepAwake'
] as const satisfies readonly (keyof Preferences)[];

/** Token sizes, kept per device like the other sizes. */
export const DEVICE_TOKEN_APPEARANCE = [
	'tokenScale',
	'reminderScale',
	'tokenIconScale',
	'reminderIconScale',
	'nightBadgeScale',
	'reminderLabelWidth',
	'reminderLabelWrap',
	'inlineReminderScale',
	'inlineReminderIconScale',
	'inlineReminderBadgeScale',
	'inlineNameTextScale',
	'inlineNameIconScale',
	'inlineNameBadgeScale'
] as const satisfies readonly (keyof TokenAppearance)[];

/** The player name badge's size and place, and what the big token shows. */
export const DEVICE_BOARD_LOOKS = [
	'nameSize',
	'nameOffset',
	'bigToken'
] as const satisfies readonly (keyof BoardLooks)[];

type DevicePreference = (typeof DEVICE_PREFERENCES)[number];
type DeviceToken = (typeof DEVICE_TOKEN_APPEARANCE)[number];
type DeviceBoard = (typeof DEVICE_BOARD_LOOKS)[number];

/** The background for all games, as the account keeps it: a picture is only marked. */
export type BackgroundRef =
	| { kind: 'none' }
	| { kind: 'script' }
	| { kind: 'image' }
	| ({ kind: 'preset' } & StillChoice)
	| ({ kind: 'moving' } & MovingChoice);

export interface SyncedValues {
	preferences: Omit<Preferences, DevicePreference | 'tokenAppearance'>;
	tokenAppearance: Omit<TokenAppearance, DeviceToken>;
	boardLooks: Omit<BoardLooks, DeviceBoard>;
	stepFocus: StepFocus;
	background: BackgroundRef;
}

/** The account document's body. */
export interface SyncedBody {
	schemaVersion: 1;
	values: SyncedValues;
}

const record = (raw: unknown): Record<string, unknown> =>
	(raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;

function without<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Omit<T, K> {
	const out = { ...value };
	for (const key of keys) delete out[key];
	return out;
}

export function backgroundRef(choice: BackgroundChoice | undefined): BackgroundRef {
	if (!choice || choice.kind === 'none') return { kind: 'none' };
	if (choice.kind === 'preset') return { kind: 'preset', id: choice.id, params: choice.params };
	if (choice.kind === 'moving') return { kind: 'moving', id: choice.id, params: choice.params };
	return { kind: choice.kind };
}

function parseBackgroundRef(raw: unknown): BackgroundRef {
	const value = record(raw);
	if (value.kind === 'script' || value.kind === 'image') return { kind: value.kind };
	const still = value.kind === 'preset' ? parseStill(value) : undefined;
	if (still) return { kind: 'preset', ...still };
	const moving = value.kind === 'moving' ? parseMoving(value) : undefined;
	return moving ? { kind: 'moving', ...moving } : { kind: 'none' };
}

/** The shared part of this device's settings. */
export function syncedValues(
	preferences: Preferences,
	boardLooks: BoardLooks,
	stepFocus: StepFocus,
	background: BackgroundChoice | undefined
): SyncedValues {
	const { tokenAppearance, ...rest } = preferences;
	return {
		preferences: without(rest, DEVICE_PREFERENCES),
		tokenAppearance: without(tokenAppearance, DEVICE_TOKEN_APPEARANCE),
		boardLooks: without(boardLooks, DEVICE_BOARD_LOOKS),
		stepFocus,
		background: backgroundRef(background)
	};
}

/** Valid values from anything; whatever is missing or damaged takes its default. */
export function parseSyncedValues(raw: unknown): SyncedValues {
	const value = record(raw);
	const preferences = parsePreferences({
		...record(value.preferences),
		tokenAppearance: record(value.tokenAppearance)
	});
	return {
		...syncedValues(
			preferences,
			parseBoardLooks(value.boardLooks),
			parseStepFocus(value.stepFocus),
			undefined
		),
		background: parseBackgroundRef(value.background)
	};
}

/** The account's body, or undefined when a newer build wrote it. */
export function parseSyncedBody(raw: unknown): SyncedValues | undefined {
	const value = record(raw);
	return value.schemaVersion === 1 ? parseSyncedValues(value.values) : undefined;
}

export function syncedBody(values: SyncedValues): SyncedBody {
	return { schemaVersion: 1, values };
}

/** The account's values laid over this device's, which keep their own sizes. */
export function withSynced(
	preferences: Preferences,
	boardLooks: BoardLooks,
	values: SyncedValues
): { preferences: Preferences; boardLooks: BoardLooks; stepFocus: StepFocus } {
	const device = <T extends object, K extends keyof T>(from: T, keys: readonly K[]) =>
		Object.fromEntries(keys.map((key) => [key, from[key]])) as Pick<T, K>;
	return {
		preferences: {
			...preferences,
			...values.preferences,
			...device(preferences, DEVICE_PREFERENCES),
			tokenAppearance: {
				...preferences.tokenAppearance,
				...values.tokenAppearance,
				...device(preferences.tokenAppearance, DEVICE_TOKEN_APPEARANCE)
			}
		},
		boardLooks: { ...boardLooks, ...values.boardLooks, ...device(boardLooks, DEVICE_BOARD_LOOKS) },
		stepFocus: values.stepFocus
	};
}

export function sameValues(a: SyncedValues, b: SyncedValues): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Two devices changed the settings at once: each setting this device changed since `base`
 * keeps this device's value, every other one takes the account's. With no common base this
 * device's copy wins, as the newest change made here.
 */
export function mergeSynced(
	base: SyncedValues | undefined,
	mine: SyncedValues,
	theirs: SyncedValues
): SyncedValues {
	if (!base) return mine;
	const group = <G extends 'preferences' | 'tokenAppearance' | 'boardLooks' | 'stepFocus'>(
		name: G
	): SyncedValues[G] => {
		const out: Record<string, unknown> = { ...theirs[name] };
		const was = base[name] as Record<string, unknown>;
		for (const [key, value] of Object.entries(mine[name])) {
			if (!same(value, was[key])) out[key] = value;
		}
		return out as SyncedValues[G];
	};
	return {
		preferences: group('preferences'),
		tokenAppearance: group('tokenAppearance'),
		boardLooks: group('boardLooks'),
		stepFocus: group('stepFocus'),
		background: same(mine.background, base.background) ? theirs.background : mine.background
	};
}
