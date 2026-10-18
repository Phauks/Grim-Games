import { describe, expect, it } from 'vitest';
import type { Character } from '#lib/core/data/index.ts';
import { convertPlan, keptCharacter, otherKinds, type ConvertSource } from './library-convert.ts';

const chef = { id: 'chef', name: 'Chef' } as Character;
const lamp = { id: 'lamplighter', name: 'Lamp Lighter' } as Character;

describe('changing an item’s kind', () => {
	it('offers the other two kinds', () => {
		expect(otherKinds('collection')).toEqual(['script', 'character']);
	});

	it('keeps everything from a collection or character into a script', () => {
		const set: ConvertSource = {
			kind: 'collection',
			name: 'Set',
			characters: [chef, lamp],
			homebrew: [lamp]
		};
		expect(convertPlan(set, 'script')).toEqual({ possible: true, losses: [] });
		const one: ConvertSource = {
			kind: 'character',
			name: 'Lamp',
			characters: [lamp],
			homebrew: [lamp]
		};
		expect(convertPlan(one, 'script')).toEqual({ possible: true, losses: [] });
		expect(convertPlan(one, 'collection')).toEqual({
			possible: true,
			losses: [{ kind: 'kept-character' }]
		});
	});

	it('says what a script loses, and needs its own character to become one', () => {
		const script: ConvertSource = {
			kind: 'script',
			name: 'Storm',
			characters: [chef, lamp],
			homebrew: [lamp],
			details: true
		};
		expect(convertPlan(script, 'collection')).toEqual({
			possible: true,
			losses: [{ kind: 'details' }]
		});
		expect(convertPlan(script, 'character')).toEqual({
			possible: true,
			losses: [{ kind: 'details' }, { kind: 'others', count: 1 }]
		});
		expect(keptCharacter(script)).toBe(lamp);
		expect(convertPlan({ ...script, homebrew: [] }, 'character')).toEqual({
			possible: false,
			reason: 'no-homebrew'
		});
	});

	it('needs a character in a collection to become one', () => {
		const empty: ConvertSource = { kind: 'collection', name: 'E', characters: [], homebrew: [] };
		expect(convertPlan(empty, 'character')).toEqual({ possible: false, reason: 'no-characters' });
	});
});
