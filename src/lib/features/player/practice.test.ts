import { describe, expect, it } from 'vitest';
import { emptyProgress, markKnown, migratePractice, nextCard } from './practice.ts';

describe('practice cards', () => {
	it('draws only characters not yet known, never the same card twice in a row', () => {
		const ids = ['chef', 'empath', 'imp'];
		const progress = markKnown(emptyProgress(), 'imp');
		for (let i = 0; i < 20; i++) {
			const next = nextCard(ids, progress, 'chef');
			expect(next).toBe('empath');
		}
		expect(nextCard(ids, progress, undefined, () => 0)).toBe('chef');
	});

	it('repeats the last card when it is the only one left, and ends when all are known', () => {
		let progress = markKnown(emptyProgress(), 'chef');
		expect(nextCard(['chef', 'imp'], progress, 'imp')).toBe('imp');
		progress = markKnown(progress, 'imp');
		expect(nextCard(['chef', 'imp'], progress, 'imp')).toBeUndefined();
	});

	it('marking a card known twice keeps one entry', () => {
		const p = markKnown(markKnown(emptyProgress(), 'chef'), 'chef');
		expect(p.known).toEqual(['chef']);
	});

	it('reads saved progress and refuses what it does not understand', () => {
		expect(migratePractice({ schemaVersion: 1, known: ['chef', 3, 'chef'] })).toEqual({
			schemaVersion: 1,
			known: ['chef']
		});
		expect(migratePractice({ schemaVersion: 2, known: [] })).toBeUndefined();
		expect(migratePractice('nope')).toBeUndefined();
	});
});
