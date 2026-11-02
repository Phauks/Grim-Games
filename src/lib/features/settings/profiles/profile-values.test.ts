import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD_LOOKS } from '#lib/features/grimoire/board-looks.svelte.ts';
import { DEFAULT_PREFERENCES } from '#lib/ui/preferences.ts';
import {
	backgroundRef,
	changedSettings,
	freeName,
	parseGameProfiles,
	parseProfileBody,
	parseProfilesState,
	parseProfileValues,
	profileBody,
	profileUse,
	withoutDevicePreferences,
	withoutProfile,
	type ProfilesState,
	type SettingsProfile
} from './profile-values.ts';

const values = parseProfileValues(null);
const profile = (id: string, name = id): SettingsProfile => ({ id, name, values });
const state = (...ids: string[]): ProfilesState => ({
	schemaVersion: 1,
	profiles: ids.map((id) => profile(id)),
	defaultId: ids[0],
	activeId: ids[0]
});

describe('settings profile values', () => {
	it('start from the app defaults and leave out what stays with the device', () => {
		expect(values.preferences).toEqual(withoutDevicePreferences(DEFAULT_PREFERENCES));
		expect(values.preferences).not.toHaveProperty('allowZoom');
		// Volume belongs to the device's speaker, not a profile (plan U1).
		expect(values.preferences).not.toHaveProperty('soundVolume');
		expect(values.boardLooks).toEqual(DEFAULT_BOARD_LOOKS);
		expect(values.background).toEqual({ kind: 'none' });
	});

	it('keep valid settings and repair damaged ones', () => {
		const read = parseProfileValues({
			preferences: { themeId: 'nope', textScale: 1.25, allowZoom: true },
			boardLooks: { vignette: false },
			background: { kind: 'preset', id: 'felt' }
		});
		expect(read.preferences.themeId).toBe(DEFAULT_PREFERENCES.themeId);
		expect(read.preferences.textScale).toBe(1.25);
		expect(read.preferences).not.toHaveProperty('allowZoom');
		expect(read.boardLooks.vignette).toBe(false);
		expect(read.background).toEqual({ kind: 'preset', id: 'felt' });
		expect(
			parseProfileValues({ background: { kind: 'preset', id: 'quicksand' } }).background
		).toEqual({
			kind: 'none'
		});
	});

	it('mark a picture without keeping it', () => {
		const image = new Blob(['x']);
		expect(backgroundRef({ kind: 'image', image })).toEqual({ kind: 'image' });
		expect(backgroundRef(undefined)).toEqual({ kind: 'none' });
		expect(backgroundRef({ kind: 'script' })).toEqual({ kind: 'script' });
	});

	it('travel as account documents and come back the same', () => {
		const p = {
			...profile('a', 'Streaming'),
			values: parseProfileValues({ boardLooks: { logo: false } })
		};
		expect(parseProfileBody(JSON.parse(JSON.stringify(profileBody(p))), 'a')).toEqual(p);
		// A newer build's document is left alone.
		expect(parseProfileBody({ ...profileBody(p), schemaVersion: 2 }, 'a')).toBeUndefined();
	});
});

describe('the profiles on a device', () => {
	it('always name a default and a profile in use from the list', () => {
		const read = parseProfilesState({
			schemaVersion: 1,
			profiles: [profile('a'), profile('a'), { id: 'b' }, profile('c')],
			defaultId: 'gone',
			activeId: 'c'
		});
		expect(read?.profiles.map((p) => p.id)).toEqual(['a', 'c']);
		expect(read?.defaultId).toBe('a');
		expect(read?.activeId).toBe('c');
	});

	it('read as nothing when empty, damaged or from a newer build', () => {
		expect(parseProfilesState(undefined)).toBeUndefined();
		expect(parseProfilesState({ schemaVersion: 1, profiles: [] })).toBeUndefined();
		expect(parseProfilesState({ ...state('a'), schemaVersion: 2 })).toBeUndefined();
	});

	it('never lose the last profile, and hand the default on when it goes', () => {
		const one = state('a');
		expect(withoutProfile(one, 'a')).toBe(one);
		const next = withoutProfile({ ...state('a', 'b'), activeId: 'a' }, 'a');
		expect(next.profiles.map((p) => p.id)).toEqual(['b']);
		expect(next.defaultId).toBe('b');
		expect(next.activeId).toBe('b');
	});

	it('get names no other profile uses', () => {
		const list = [profile('a', 'New profile'), profile('b', 'new profile 2')];
		expect(freeName('New profile', list)).toBe('New profile 3');
		expect(freeName('Streaming', list)).toBe('Streaming');
	});

	it('remember which profile each game uses', () => {
		expect(parseGameProfiles({ g1: 'a', g2: 3, g3: '' })).toEqual({ g1: 'a' });
		expect(parseGameProfiles(null)).toEqual({});
	});
});

describe('what a profile shows to tell it apart', () => {
	it('counts each setting changed from the defaults once', () => {
		expect(changedSettings(values)).toBe(0);
		const changed = parseProfileValues({
			preferences: { textScale: 1.25, requireName: true },
			boardLooks: { vignette: false, logo: false },
			background: { kind: 'preset', id: 'felt' }
		});
		expect(changedSettings(changed)).toBe(5);
	});

	it('counts only saved games that used the profile, with the newest save', () => {
		const games = { g1: 'a', g2: 'b', g3: 'a', gone: 'a' };
		const saved = [
			{ gameId: 'g1', savedAt: 100 },
			{ gameId: 'g2', savedAt: 300 },
			{ gameId: 'g3', savedAt: 200 }
		];
		expect(profileUse('a', games, saved)).toEqual({ games: 2, lastSaved: 200 });
		expect(profileUse('c', games, saved)).toEqual({ games: 0 });
	});
});
