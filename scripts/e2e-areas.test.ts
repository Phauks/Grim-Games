import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { E2E_AREAS } from '../e2e/areas.ts';
import {
	areaById,
	areasForFile,
	matrix,
	plannedAreas,
	planSummary,
	playwrightArgs
} from './e2e-area.ts';

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

	it('names only feature folders that exist, each in one area', () => {
		const folders = readdirSync(new URL('../src/lib/features/', import.meta.url));
		const named = E2E_AREAS.flatMap((a) => a.features);
		expect(
			named.filter((f) => !folders.includes(f)),
			'not in src/lib/features/'
		).toEqual([]);
		expect(
			named.filter((f, i) => named.indexOf(f) !== i),
			'in more than one area'
		).toEqual([]);
	});

	it('runs every area on a push to beta or main', () => {
		expect(plannedAreas([]).areas).toEqual(E2E_AREAS);
		expect(planSummary([])).toContain('Skipped: None');
	});

	it("runs only the areas of a PR's own feature folders, message files and e2e files", () => {
		const files = [
			'src/lib/features/room/RoomView.svelte',
			'src/lib/i18n/messages/en/day.ts',
			'e2e/glossary.e2e.ts'
		];
		expect(plannedAreas(files).areas.map((a) => a.id)).toEqual(['rooms', 'day', 'scripts']);
		expect(planSummary(files)).toContain('Skipped: Grimoire board; Characters, rules and setup');
	});

	it('runs every area for a change outside the areas', () => {
		for (const file of [
			'src/lib/core/engine/x.ts',
			'src/lib/ui/primitives/Button.svelte',
			'src/routes/+layout.svelte',
			'src/lib/i18n/messages/en/common.ts',
			'src/lib/features/new-thing/X.svelte',
			'worker/room.ts',
			'e2e/new-game.ts',
			'e2e/brand-new.e2e.ts',
			'package.json',
			'.github/workflows/ci.yml'
		]) {
			expect(areasForFile(file), file).toBe('all');
		}
		const files = ['src/lib/features/room/x.ts', 'src/lib/ui/y.ts'];
		expect(plannedAreas(files).areas).toEqual(E2E_AREAS);
		expect(planSummary(files)).toContain('- `src/lib/ui/y.ts`');
	});

	it('gives each part of an area its own job', () => {
		expect(matrix([areaById('board'), areaById('day')])).toEqual([
			{ area: 'board', part: 1, of: 3, label: 'Grimoire board 1 of 3' },
			{ area: 'board', part: 2, of: 3, label: 'Grimoire board 2 of 3' },
			{ area: 'board', part: 3, of: 3, label: 'Grimoire board 3 of 3' },
			{ area: 'day', part: 1, of: 1, label: 'Day and game flow' }
		]);
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
