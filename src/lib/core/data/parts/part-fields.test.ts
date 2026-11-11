/**
 * The Character builder's fields cover every rule (M62): every official character's rules fit
 * each part's field, so editing one in the builder loses nothing.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as PARTS from './index.ts';
import { uncovered, type FieldSpec } from '../field-spec.ts';

const DIR = new URL('../rules/', import.meta.url);
const fieldOf = (key: string): FieldSpec | undefined => PARTS[key as keyof typeof PARTS]?.field;

describe('rule fields', () => {
	it('every official character’s rules fit the fields', () => {
		const misses: string[] = [];
		for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
			const block = JSON.parse(readFileSync(new URL(file, DIR), 'utf8')) as Record<string, unknown>;
			const blocks = [block, ...(block.optionalRule ? [block.optionalRule] : [])] as Record<
				string,
				unknown
			>[];
			for (const rules of blocks) {
				for (const [key, value] of Object.entries(rules)) {
					if (key === 'optionalRule') continue;
					const field = fieldOf(key);
					if (!field) misses.push(`${file} ${key}: no fields`);
					else misses.push(...uncovered(field, value, `${file} ${key}`));
				}
			}
		}
		expect(misses).toEqual([]);
	});
});
