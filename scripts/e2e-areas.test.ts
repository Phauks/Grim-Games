import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { E2E_AREAS } from '../e2e/areas.ts';
import { areaById, playwrightArgs } from './e2e-area.ts';

const testFiles = readdirSync(new URL('../e2e/', import.meta.url)).filter((f) =>
	f.endsWith('.e2e.ts')
);

describe('e2e areas', () => {
	it('puts every e2e file in exactly one area', () => {
		const listed = E2E_AREAS.flatMap((a) => a.files);
		const twice = listed.filter((f, i) => listed.indexOf(f) !== i);
		expect(twice, 'files in more than one area').toEqual([]);
		expect(
			testFiles.filter((f) => !listed.includes(f)),
			'add these to an area in e2e/areas.ts'
		).toEqual([]);
		expect(
			listed.filter((f) => !testFiles.includes(f)),
			'these are listed in e2e/areas.ts but not in e2e/'
		).toEqual([]);
	});

	it('gives each area a job in ci.yml for each of its parts', () => {
		const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
		const rows = [...ci.matchAll(/\{ area: ([a-z-]+), part: (\d+), of: (\d+), label:/g)].map(
			([, area, part, of]) => `${area} ${part}/${of}`
		);
		const expected = E2E_AREAS.flatMap((a) =>
			Array.from({ length: a.jobs }, (_, i) => `${a.id} ${i + 1}/${a.jobs}`)
		);
		expect(rows, 'the e2e matrix in ci.yml').toEqual(expected);
	});

	it('names each file from e2e/ so one name never matches a longer one', () => {
		const args = playwrightArgs(areaById('day'), undefined, []);
		const day = new RegExp(args.find((a) => a.includes('/day'))!);
		expect(day.test('/repo/e2e/day.e2e.ts')).toBe(true);
		expect(day.test('/repo/e2e/grimoire-day.e2e.ts')).toBe(false);
	});

	it('shards only an area with more than one job', () => {
		expect(playwrightArgs(areaById('board'), '2/3', [])).toContain('--shard=2/3');
		expect(playwrightArgs(areaById('day'), '1/1', []).some((a) => a.startsWith('--shard'))).toBe(
			false
		);
	});

	it('refuses an unknown area', () => {
		expect(() => areaById('nope')).toThrow(/Areas: board/);
	});
});
