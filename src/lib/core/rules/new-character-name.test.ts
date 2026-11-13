import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { characterIdFor } from './character-builder.ts';
import { CHARACTER_NAME_POOL, randomCharacterName } from './new-character-name.ts';

const official = (
	JSON.parse(
		readFileSync(new URL('../../../../static/data/roles.json', import.meta.url), 'utf8')
	) as { id: string; name: string }[]
).map((c) => c.name.toLowerCase());

describe('randomCharacterName', () => {
	it('never gives an official character’s name, and each makes its own id', () => {
		expect(CHARACTER_NAME_POOL.filter((n) => official.includes(n.toLowerCase()))).toEqual([]);
		const ids = CHARACTER_NAME_POOL.map(characterIdFor);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids.every((id) => /^[a-z]+$/.test(id))).toBe(true);
	});

	it('skips names already taken', () => {
		const taken = CHARACTER_NAME_POOL.slice(1);
		expect(randomCharacterName(taken, () => 0.99)).toBe(CHARACTER_NAME_POOL[0]);
	});

	it('numbers a name when every one is taken', () => {
		const taken = [...CHARACTER_NAME_POOL, `${CHARACTER_NAME_POOL[0]} 2`];
		expect(randomCharacterName(taken, () => 0)).toBe(`${CHARACTER_NAME_POOL[0]} 3`);
	});
});
