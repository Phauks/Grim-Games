import { describe, expect, it } from 'vitest';
import { markBoardShown } from './board-cover.ts';

describe('markBoardShown', () => {
	it('keeps the page marked until every board and Grim tab has gone', () => {
		const root = document.createElement('div');
		const board = markBoardShown(root);
		// The board's Script dialog opens a Grim tab over the board, then closes it.
		const grim = markBoardShown(root);
		grim();
		expect(root.hasAttribute('data-board-shown')).toBe(true);
		// A cleanup run twice takes off only its own mark.
		grim();
		expect(root.hasAttribute('data-board-shown')).toBe(true);
		board();
		expect(root.hasAttribute('data-board-shown')).toBe(false);
	});
});
