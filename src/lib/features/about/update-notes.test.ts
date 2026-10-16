import { describe, expect, it } from 'vitest';
import { changesSince, parseBuildNotes } from './update-notes.ts';

const notes = {
	commit: 'c3',
	commits: [
		{ sha: 'c3', subject: 'Third' },
		{ sha: 'c2', subject: 'Second' },
		{ sha: 'c1', subject: 'First' }
	]
};

describe('changesSince', () => {
	it('lists only the commits after the running build', () => {
		expect(changesSince(notes, 'c1')).toEqual({
			commits: notes.commits.slice(0, 2),
			complete: true
		});
	});

	it('lists nothing when the running build is the newest', () => {
		expect(changesSince(notes, 'c3')).toEqual({ commits: [], complete: true });
	});

	it('lists everything, marked incomplete, when the running build is older than the notes', () => {
		expect(changesSince(notes, 'c0')).toEqual({ commits: notes.commits, complete: false });
	});
});

describe('parseBuildNotes', () => {
	it('keeps well-formed commits and drops the rest', () => {
		expect(
			parseBuildNotes({
				commit: 'c1',
				commits: [{ sha: 'c1', subject: 'First' }, { sha: 2 }, null]
			})
		).toEqual({ commit: 'c1', commits: [{ sha: 'c1', subject: 'First' }] });
	});

	it('rejects anything else', () => {
		expect(parseBuildNotes(null)).toBeNull();
		expect(parseBuildNotes({ commit: 'c1' })).toBeNull();
		expect(parseBuildNotes('notes')).toBeNull();
	});
});
