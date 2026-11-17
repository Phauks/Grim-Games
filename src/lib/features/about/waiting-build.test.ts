import { describe, expect, it } from 'vitest';
import { notesMatchBuild, parseWaitingBuild } from './waiting-build.ts';

const notes = { commit: 'abc1234'.padEnd(40, '0'), commits: [] };

describe('parseWaitingBuild', () => {
	it("reads the waiting build's format and notes", () => {
		expect(parseWaitingBuild({ savedGame: 33, notes })).toEqual({ savedGame: 33, notes });
		expect(parseWaitingBuild({ savedGame: 33 })).toEqual({ savedGame: 33, notes: null });
	});

	it('is undefined for anything else, as from an older build', () => {
		expect(parseWaitingBuild(undefined)).toBeUndefined();
		expect(parseWaitingBuild({ notes })).toBeUndefined();
		expect(parseWaitingBuild({ savedGame: 1.5 })).toBeUndefined();
	});
});

describe('notesMatchBuild', () => {
	it("keeps only the build's own notes, by the commit its version line names", () => {
		const version = 'v0.1.0 · abc1234 · beta · beta · built 2026-11-16T22:00:00Z';
		expect(notesMatchBuild(notes, version)).toBe(true);
		expect(notesMatchBuild({ ...notes, commit: 'def5678'.padEnd(40, '0') }, version)).toBe(false);
		expect(notesMatchBuild(null, version)).toBe(false);
	});
});
