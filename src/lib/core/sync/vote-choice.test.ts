import { describe, expect, it } from 'vitest';
import { choiceId, choiceLabel, isEmptyChoice, isRulesOnly } from './vote-choice.ts';

// Trevor, 2026-11-03 (plan M33): "you may ask if they want tb +1 vs a custom vs sushi buffet".
describe('room vote choices', () => {
	it('names each of the three examples from its parts', () => {
		expect(choiceLabel({ script: 'Trouble Brewing', rules: ['+1'] })).toBe('Trouble Brewing · +1');
		expect(choiceLabel({ script: 'Catfishing', rules: [] })).toBe('Catfishing');
		expect(choiceLabel({ mode: 'Sushi Buffet', rules: [] })).toBe('Sushi Buffet');
	});

	it('puts the game mode first, then the script, then the rules', () => {
		expect(
			choiceLabel({ mode: 'Whale Buffet', script: 'Bad Moon Rising', rules: ['Seat 7', 'Warrens'] })
		).toBe('Whale Buffet · Bad Moon Rising · Seat 7 · Warrens');
	});

	it('gives the same id whatever order the rules came in', () => {
		expect(choiceId({ script: 'tb', rules: ['seat-7', 'plus-one'] })).toBe(
			choiceId({ script: 'tb', rules: ['plus-one', 'seat-7', 'plus-one'] })
		);
		expect(choiceId({ script: 'tb', rules: [] })).not.toBe(choiceId({ mode: 'tb', rules: [] }));
	});

	it('tells empty and rules-only choices apart', () => {
		expect(isEmptyChoice({ rules: [] })).toBe(true);
		expect(isRulesOnly({ rules: ['plus-one'] })).toBe(true);
		expect(isRulesOnly({ script: 'tb', rules: ['plus-one'] })).toBe(false);
	});
});
