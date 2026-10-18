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
	GUIDE_PARTS,
	guideFingerprint,
	MINIMAL_EXAMPLE
} from './format-guide.ts';
import { GAME_MODES } from './registry.ts';
import { MODE_PARTS } from './types.ts';
import { KINDS, parseGameMode } from './validate.ts';

/**
 * The format's source at each revision. Changing types.ts, validate.ts or the guide fails
 * this test: raise GAME_MODE_REVISION, update the guide, then record the new hash here.
 */
const FORMAT_HASH: Record<number, string> = {
	5: 'f69e2a77045f7378'
};

function formatHash(): string {
	const hash = createHash('sha256');
	for (const file of ['types.ts', 'validate.ts'])
		hash.update(readFileSync(new URL(`./${file}`, import.meta.url), 'utf8'));
	hash.update(guideFingerprint());
	return hash.digest('hex').slice(0, 16);
}

function keys(value: unknown, out: Set<string>) {
	if (Array.isArray(value)) for (const v of value) keys(v, out);
	else if (typeof value === 'object' && value !== null)
		for (const [k, v] of Object.entries(value)) {
			out.add(k);
			keys(v, out);
		}
}

describe('the mode file guide', () => {
	it('describes every part, in Inspect’s order', () => {
		expect(GUIDE_PARTS.map((p) => p.part)).toEqual([...MODE_PARTS]);
	});

	it('describes every kind the validator accepts, and no others', () => {
		for (const p of GUIDE_PARTS)
			expect(
				p.kinds.map((k) => k.kind),
				p.part
			).toEqual([...(KINDS[p.part] ?? [])]);
	});

	it('describes every field the built-in modes use', () => {
		const used = new Set<string>();
		for (const m of GAME_MODES) keys(m, used);
		const documented = documentedFields();
		const missing = [...used].filter((k) => !documented.has(k));
		expect(missing).toEqual([]);
	});

	it('has a minimal example that is a valid mode', () => {
		expect(parseGameMode(MINIMAL_EXAMPLE).ok).toBe(true);
	});

	it('goes up a revision whenever the format changes', () => {
		expect(FORMAT_HASH[GAME_MODE_REVISION], `revision ${GAME_MODE_REVISION}`).toBe(formatHash());
	});
});
