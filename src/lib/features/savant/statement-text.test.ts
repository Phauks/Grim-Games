import { describe, expect, it } from 'vitest';
import { noteText, savedStatements } from './statement-text.ts';

// The Savant's day note keeps the statements given today
// (https://wiki.bloodontheclocktower.com/Savant: one true and one false each day).
const PREFIXES = ['True: ', 'False: '];

describe('the Savant note', () => {
	it('reads back the statements saved in it, and what else was written', () => {
		const note = 'Asked about the Witch\nTrue: Seat 2 is evil\nFalse: Seat 5 is the Demon';
		expect(savedStatements(note, PREFIXES)).toEqual({
			statements: [
				{ words: 'Seat 2 is evil', truth: true },
				{ words: 'Seat 5 is the Demon', truth: false }
			],
			rest: 'Asked about the Witch'
		});
	});

	it('replaces the saved statements when saved again, keeping the rest', () => {
		const first = noteText('Asked about the Witch', ['True: A', 'False: B'], PREFIXES);
		const second = noteText(first, ['True: C', 'False: D'], PREFIXES);
		expect(second).toBe('Asked about the Witch\nTrue: C\nFalse: D');
	});
});
