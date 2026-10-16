import { describe, expect, it } from 'vitest';
import { changesSince, compareUrl, parseBuildNotes, parseCompare } from './update-notes.ts';

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

describe('parseCompare', () => {
	const commit = (sha: string, message: string) => ({ sha, commit: { message } });

	it('lists GitHub compare commits newest first, with only the subject line', () => {
		expect(
			parseCompare({
				total_commits: 2,
				commits: [commit('c1', 'First\n\nBody'), commit('c2', 'Second')]
			})
		).toEqual({
			commits: [
				{ sha: 'c2', subject: 'Second' },
				{ sha: 'c1', subject: 'First' }
			],
			complete: true
		});
	});

	it('marks the list incomplete when GitHub left commits out', () => {
		expect(parseCompare({ total_commits: 300, commits: [commit('c1', 'First')] })?.complete).toBe(
			false
		);
	});

	it('rejects anything else', () => {
		expect(parseCompare({ message: 'Not Found' })).toBeNull();
		expect(parseCompare({ total_commits: 1, commits: [{ sha: 'c1' }] })).toBeNull();
	});

	it('compares the running build with the new one', () => {
		expect(compareUrl('aaa', 'bbb')).toBe(
			'https://api.github.com/repos/Phauks/Grim-Games/compare/aaa...bbb'
		);
	});
});
