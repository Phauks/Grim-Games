/**
 * The Character builder's fields cover every rule (M62): each part has fields, and every
 * official character's rules fit them, so editing one in the builder loses nothing.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as PARTS from './parts/index.ts';
import { RULE_FIELDS } from './rule-fields.ts';
import { uncovered, type FieldSpec } from './field-spec.ts';

const DIR = new URL('./rules/', import.meta.url);
/** Edited in the builder's Night section, not as a rule. */
const ELSEWHERE = new Set(['nightOrder', 'nightText']);

const fieldOf = (key: string): FieldSpec | undefined =>
	PARTS[key as keyof typeof PARTS]?.field ?? RULE_FIELDS[key as keyof typeof PARTS];

describe('rule fields', () => {
	it('every part but those set elsewhere has fields', () => {
		const missing = Object.keys(PARTS).filter((key) => !ELSEWHERE.has(key) && !fieldOf(key));
		expect(missing).toEqual([]);
	});

	it('no field is given twice', () => {
		const both = Object.keys(RULE_FIELDS).filter((k) => PARTS[k as keyof typeof PARTS].field);
		expect(both).toEqual([]);
	});

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
					if (ELSEWHERE.has(key) || key === 'optionalRule') continue;
					const field = fieldOf(key);
					if (!field) misses.push(`${file} ${key}: no fields`);
					else misses.push(...uncovered(field, value, `${file} ${key}`));
				}
			}
		}
		expect(misses).toEqual([]);
	});
});
