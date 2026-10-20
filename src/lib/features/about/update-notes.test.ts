import { describe, expect, it } from 'vitest';
import {
	changesSince,
	compareUrl,
	noteFor,
	parseBuildNotes,
	parseCompare
} from './update-notes.ts';

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

describe('noteFor', () => {
	it('shows a merged PR as its number and title', () => {
		expect(
			noteFor('m1', 'Merge pull request #42 from Phauks/claude/x\n\nA Traveller is marked\n')
		).toEqual({ sha: 'm1', subject: 'A Traveller is marked', pr: 42 });
	});

	it('keeps the merge subject when the PR merge has no title', () => {
		expect(noteFor('m1', 'Merge pull request #5 from a/b')).toEqual({
			sha: 'm1',
			subject: 'Merge pull request #5 from a/b',
			pr: 5
		});
	});

	it('drops merges of one branch into another', () => {
		expect(noteFor('m1', "Merge remote-tracking branch 'origin/beta' into claude/x")).toBeNull();
		expect(noteFor('m1', "Merge branch 'beta' into claude/x")).toBeNull();
	});

	it('keeps any other commit by its subject', () => {
		expect(noteFor('c1', 'Fix the bars\n\nBody')).toEqual({ sha: 'c1', subject: 'Fix the bars' });
	});
});

describe('parseBuildNotes', () => {
	it('keeps a PR number', () => {
		expect(
			parseBuildNotes({ commit: 'm1', commits: [{ sha: 'm1', subject: 'Title', pr: 7 }] })
		).toEqual({ commit: 'm1', commits: [{ sha: 'm1', subject: 'Title', pr: 7 }] });
	});

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
	const commit = (sha: string, message: string, ...parents: string[]) => ({
		sha,
		commit: { message },
		parents: parents.map((p) => ({ sha: p }))
	});

	it('lists GitHub compare commits newest first, with only the subject line', () => {
		expect(
			parseCompare({
				total_commits: 2,
				commits: [commit('c1', 'First\n\nBody', 'c0'), commit('c2', 'Second', 'c1')]
			})
		).toEqual({
			commits: [
				{ sha: 'c2', subject: 'Second' },
				{ sha: 'c1', subject: 'First' }
			],
			complete: true
		});
	});

	it("lists each merged PR once by its title, not the PR's own commits or base merges", () => {
		expect(
			parseCompare({
				total_commits: 5,
				commits: [
					commit('p1', 'Work on the bars', 'b0'),
					commit('b1', 'Merge pull request #9 from a/other\n\nOther change', 'b0', 'o1'),
					commit('p2', "Merge remote-tracking branch 'origin/beta' into a/bars", 'p1', 'b1'),
					commit('p3', 'More bars', 'p2'),
					commit('b2', 'Merge pull request #10 from a/bars\n\nThe bars match', 'b1', 'p3')
				]
			})?.commits
		).toEqual([
			{ sha: 'b2', subject: 'The bars match', pr: 10 },
			{ sha: 'b1', subject: 'Other change', pr: 9 }
		]);
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
