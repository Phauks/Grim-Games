/**
 * The mode file guide stays current (Trevor, 2026-10-18: "keep it up to date at all times"):
 * every part, kind and field the format uses is described, and any change to the format's
 * source needs the rolling revision to go up.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	documentedFields,
	GAME_MODE_REVISION,
	GUIDE_SECTIONS,
	guideFingerprint,
	MINIMAL_EXAMPLE,
	RULE_GUIDE_SECTIONS,
	RULE_MINIMAL_EXAMPLE
} from './format-guide.ts';
import { SPECIAL_RULES } from './rules/index.ts';
import { GAME_MODES } from './registry.ts';
import { MODE_SECTIONS, RULE_ONLY_SECTIONS } from './types.ts';
import { parseGameMode, parseSpecialRule } from './validate.ts';

/**
 * The format's source at each revision. Changing types.ts, validate.ts, setup-spec.ts or the guide fails
 * this test: raise GAME_MODE_REVISION, update the guide, then record the new hash here.
 */
const FORMAT_HASH: Record<number, string> = {
	5: 'f69e2a77045f7378',
	6: '5ee123ca6fdee674',
	7: '58ca08aaf930fa03',
	8: '15aff5860abaeceb',
	9: 'a20694af6603f32b',
	10: '7451a14d0310189f',
	11: '0b85af8d8b76beac',
	12: '938c20346573ab10',
	13: 'fe15a2228e3e0b50',
	14: '42776f8f462d4766',
	15: 'bcba7e8955601c85',
	16: '69b4100e630e5d8a',
	17: '9ccdc45d8f63d9eb',
	18: '97512b9d41fe8cef',
	19: 'dd15466db036c24f',
	20: '62689fecf9c85f32',
	21: '8fbd37d06422081f'
};

function formatHash(): string {
	const hash = createHash('sha256');
	for (const file of ['types.ts', 'validate.ts', 'setup-spec.ts'])
		hash.update(readFileSync(new URL(`./${file}`, import.meta.url), 'utf8'));
	hash.update(guideFingerprint());
	return hash.digest('hex').slice(0, 16);
}

/**
 * Every field name in a file, at any depth. A rules block (`rules`) is a character's, described
 * by its parts (`data/parts/`) and read by their reader, so only its own name counts here.
 */
function keys(value: unknown, out: Set<string>) {
	if (Array.isArray(value)) for (const v of value) keys(v, out);
	else if (typeof value === 'object' && value !== null)
		for (const [k, v] of Object.entries(value)) {
			out.add(k);
			if (k !== 'rules') keys(v, out);
		}
}

describe('the mode file guide', () => {
	it('describes every part, in Inspect’s order', () => {
		expect(GUIDE_SECTIONS.map((p) => p.part)).toEqual([...MODE_SECTIONS]);
	});

	it('says what every section, kind and field means', () => {
		for (const p of [...GUIDE_SECTIONS, ...RULE_GUIDE_SECTIONS]) {
			expect(p.about, p.part).not.toBe('');
			for (const k of p.kinds) expect(k.about, `${p.part} ${k.kind}`).not.toBe('');
			for (const f of [...p.fields, ...p.kinds.flatMap((k) => k.fields)])
				expect(f.about, `${p.part}.${f.name}`).not.toBe('');
		}
	});

	it('describes every field the built-in modes use', () => {
		const used = new Set<string>();
		for (const m of GAME_MODES) keys(m, used);
		const documented = documentedFields();
		const missing = [...used].filter((k) => !documented.has(k));
		expect(missing).toEqual([]);
	});

	it('describes every special rule part, kind and field the library uses', () => {
		expect(RULE_GUIDE_SECTIONS.map((p) => p.part)).toEqual([...RULE_ONLY_SECTIONS]);
		const used = new Set<string>();
		for (const r of SPECIAL_RULES) keys(r, used);
		expect([...used].filter((k) => !documentedFields().has(k))).toEqual([]);
		expect(parseSpecialRule(RULE_MINIMAL_EXAMPLE).ok).toBe(true);
	});

	it('reads every built-in rules block with the character reader, unchanged', () => {
		for (const file of [...GAME_MODES, ...SPECIAL_RULES]) {
			const parsed = file.kind === 'special-rule' ? parseSpecialRule(file) : parseGameMode(file);
			expect(parsed.ok ? [] : parsed.issues, file.id).toEqual([]);
			const read = parsed.ok ? ('rule' in parsed ? parsed.rule : parsed.mode) : undefined;
			expect(read?.rules, file.id).toEqual(file.rules);
		}
	});

	it('has a minimal example that is a valid mode', () => {
		expect(parseGameMode(MINIMAL_EXAMPLE).ok).toBe(true);
	});

	it('goes up a revision whenever the format changes', () => {
		expect(FORMAT_HASH[GAME_MODE_REVISION], `revision ${GAME_MODE_REVISION}`).toBe(formatHash());
	});
});
