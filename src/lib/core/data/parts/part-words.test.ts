/**
 * Every setting of a rule the Character builder offers has a name in plain words (M81, Trevor
 * 2026-11-12: "do it all"), so a new setting can't go in without one.
 */
import { describe, expect, it } from 'vitest';
import * as PARTS from './index.ts';
import type { FieldSpec } from '../field-spec.ts';

/** Parts set outside the Rules section, never shown with these fields. */
const ELSEWHERE = ['nightOrder', 'nightText'];

/**
 * Each setting under `spec` the builder shows with no plain name, by its path; a spec already
 * open above it (a jinx condition's `not`) is not walked again.
 */
function unnamed(spec: FieldSpec, path: string, open = new Set<FieldSpec>()): string[] {
	if (open.has(spec)) return [];
	const inner = new Set(open).add(spec);
	switch (spec.kind) {
		case 'object':
			// Our own words for official characters are never shown in the builder (M84).
			return spec.fields
				.filter((f) => !f.spec.official)
				.flatMap((f) => [
					...(f.spec.label ? [] : [`${path}.${f.key}`]),
					...unnamed(f.spec, `${path}.${f.key}`, inner)
				]);
		case 'variants':
			return spec.variants.flatMap((v) => unnamed(v.spec, `${path}<${v.label}>`, inner));
		case 'list':
		case 'byToken':
		case 'byKey':
		case 'byCharacter':
			return unnamed(spec.of, `${path}.*`, inner);
		default:
			return [];
	}
}

/** Every bit of plain wording under `spec`, with the choices each names; a spec seen is skipped. */
function words(
	spec: FieldSpec,
	seen = new Set<FieldSpec>()
): { text: string[]; badNames: string[] } {
	if (seen.has(spec)) return { text: [], badNames: [] };
	seen.add(spec);
	const text = [spec.label, spec.about, ...Object.values(spec.names ?? {})].filter(
		(t): t is string => !!t
	);
	const values = spec.kind === 'enum' || spec.kind === 'enums' ? spec.values : [];
	const badNames = Object.keys(spec.names ?? {}).filter((k) => !values.includes(k));
	const inner: FieldSpec[] =
		spec.kind === 'object'
			? spec.fields.map((f) => f.spec)
			: spec.kind === 'variants'
				? spec.variants.map((v) => v.spec)
				: 'of' in spec
					? [spec.of]
					: [];
	for (const s of inner) {
		const w = words(s, seen);
		text.push(...w.text);
		badNames.push(...w.badNames);
	}
	return { text, badNames };
}

describe('setting names in plain words', () => {
	const offered = (Object.keys(PARTS) as (keyof typeof PARTS)[]).filter(
		(key) => !ELSEWHERE.includes(key)
	);
	it.each(offered)('%s names every setting', (key) => {
		expect(unnamed(PARTS[key].field, key)).toEqual([]);
	});

	it('names only choices a setting has, with no dash or pipe', () => {
		for (const part of Object.values(PARTS)) {
			const { text, badNames } = words(part.field);
			expect(badNames).toEqual([]);
			for (const line of text) expect(line).not.toMatch(/[—|]/);
		}
	});
});
