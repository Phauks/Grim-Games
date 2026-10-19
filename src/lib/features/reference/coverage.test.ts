import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseRoles } from '#lib/core/data/parse.ts';
import { CHARACTER_COVERAGE, DERIVED_FIELDS, ENTRY_COVERAGE, type Shown } from './coverage.ts';
import { FIELD_IDS } from './fields.ts';

const columns = (map: Record<string, Shown>) =>
	Object.values(map).filter(
		(shown): shown is (typeof FIELD_IDS)[number] => typeof shown === 'string'
	);

// TPI's data as shipped; `team` is read into `type`.
const raw = JSON.parse(readFileSync('static/data/roles.json', 'utf8')) as Record<string, unknown>[];
const RAW_TO_CHARACTER: Record<string, string> = { team: 'type' };

describe('Character reference table coverage', () => {
	it('names only real table columns', () => {
		for (const field of [
			...columns(CHARACTER_COVERAGE),
			...columns(ENTRY_COVERAGE),
			...DERIVED_FIELDS
		]) {
			expect(FIELD_IDS).toContain(field);
		}
	});

	it('gives every table column a piece of data to show', () => {
		const used = new Set([
			...columns(CHARACTER_COVERAGE),
			...columns(ENTRY_COVERAGE),
			...DERIVED_FIELDS
		]);
		expect(FIELD_IDS.filter((id) => !used.has(id))).toEqual([]);
	});

	it("covers every key in TPI's character data", () => {
		const keys = new Set(raw.flatMap((role) => Object.keys(role)));
		const missing = [...keys]
			.map((key) => RAW_TO_CHARACTER[key] ?? key)
			.filter((key) => !(key in CHARACTER_COVERAGE));
		expect(missing).toEqual([]);
	});

	it('covers every key the parsed characters carry', () => {
		const keys = new Set(parseRoles(raw).flatMap((character) => Object.keys(character)));
		expect([...keys].filter((key) => !(key in CHARACTER_COVERAGE))).toEqual([]);
	});
});
