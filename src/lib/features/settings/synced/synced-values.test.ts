import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD_LOOKS } from '#lib/features/grimoire/board-looks.svelte.ts';
import { DEFAULT_STEP_FOCUS } from '#lib/features/grimoire/step-focus.svelte.ts';
import { DEFAULT_PREFERENCES, type Preferences } from '#lib/ui/preferences.ts';
import {
	mergeSynced,
	parseSyncedBody,
	parseSyncedValues,
	syncedBody,
	syncedValues,
	withSynced
} from './synced-values.ts';

// Trevor, 2026-11-09: settings profiles removed; sizes stay per device, the rest syncs.

function prefs(change: Partial<Preferences> = {}): Preferences {
	return { ...DEFAULT_PREFERENCES, ...change };
}

const tokens = (change: Partial<Preferences['tokenAppearance']>) => ({
	...DEFAULT_PREFERENCES.tokenAppearance,
	...change
});

describe('synced settings', () => {
	it('leaves out sizes, layout and the device’s own sound and screen', () => {
		const values = syncedValues(
			prefs({ textScale: 1.3, allowZoom: true, tokenAppearance: tokens({ tokenScale: 1.5 }) }),
			{ ...DEFAULT_BOARD_LOOKS, nameSize: 1.4 },
			DEFAULT_STEP_FOCUS,
			undefined
		);
		expect(values.preferences).not.toHaveProperty('textScale');
		expect(values.preferences).not.toHaveProperty('allowZoom');
		expect(values.preferences).not.toHaveProperty('soundVolume');
		expect(values.preferences).not.toHaveProperty('tokenAppearance');
		expect(values.tokenAppearance).not.toHaveProperty('tokenScale');
		expect(values.tokenAppearance).toHaveProperty('boardNames');
		expect(values.boardLooks).not.toHaveProperty('nameSize');
		expect(values.preferences.themeId).toBe(DEFAULT_PREFERENCES.themeId);
	});

	it('marks an uploaded picture without its bytes', () => {
		const image = new Blob(['x']);
		const values = syncedValues(prefs(), DEFAULT_BOARD_LOOKS, DEFAULT_STEP_FOCUS, {
			kind: 'image',
			image
		});
		expect(values.background).toEqual({ kind: 'image' });
	});

	it('keeps an animated background whole', () => {
		const values = parseSyncedValues({ background: { kind: 'moving', id: 'vortex', params: {} } });
		expect(values.background.kind).toBe('moving');
	});

	it('lays the account’s settings over a device that keeps its own sizes', () => {
		const phone = prefs({ textScale: 1.3, tokenAppearance: tokens({ tokenScale: 1.5 }) });
		const laptop = syncedValues(
			prefs({
				themeId: 'parchment',
				textScale: 0.9,
				tokenAppearance: tokens({ boardNames: false })
			}),
			{ ...DEFAULT_BOARD_LOOKS, usedGhostVote: 'struck', nameSize: 0.8 },
			DEFAULT_STEP_FOCUS,
			undefined
		);
		const next = withSynced(phone, { ...DEFAULT_BOARD_LOOKS, nameSize: 1.4 }, laptop);
		expect(next.preferences.themeId).toBe('parchment');
		expect(next.preferences.textScale).toBe(1.3);
		expect(next.preferences.tokenAppearance.tokenScale).toBe(1.5);
		expect(next.preferences.tokenAppearance.boardNames).toBe(false);
		expect(next.boardLooks.usedGhostVote).toBe('struck');
		expect(next.boardLooks.nameSize).toBe(1.4);
	});

	it('reads its own documents and leaves a newer build’s alone', () => {
		const values = syncedValues(prefs(), DEFAULT_BOARD_LOOKS, DEFAULT_STEP_FOCUS, undefined);
		expect(parseSyncedBody(JSON.parse(JSON.stringify(syncedBody(values))))).toEqual(values);
		expect(parseSyncedBody({ schemaVersion: 2, values })).toBeUndefined();
	});

	it('merges two devices’ changes setting by setting', () => {
		const base = parseSyncedValues(null);
		const mine = {
			...base,
			boardLooks: { ...base.boardLooks, usedGhostVote: 'struck' as const }
		};
		const theirs = { ...base, preferences: { ...base.preferences, themeId: 'parchment' } };
		const merged = mergeSynced(base, mine, theirs);
		expect(merged.boardLooks.usedGhostVote).toBe('struck');
		expect(merged.preferences.themeId).toBe('parchment');
		// No common base: this device's newest change wins.
		expect(mergeSynced(undefined, mine, theirs)).toEqual(mine);
	});
});
