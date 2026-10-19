import { describe, expect, it } from 'vitest';
import { scriptVersions } from './script-versions.ts';

const choice = (value: string, label: string, author?: string, version?: string) => ({
	value,
	label,
	...(author ? { author } : {}),
	...(version ? { version } : {})
});

describe('a script’s versions on New game', () => {
	const a1 = choice('recent:1', 'Alpha', 'Ann', '1.0');
	const a2 = choice('profile:2', 'Alpha', 'Ann', '2.0');
	const a2again = choice('profile:3', 'Alpha', 'Ann', '2.0');
	const otherAuthor = choice('recent:4', 'Alpha', 'Bob', '3.0');
	const unversioned = choice('recent:5', 'Alpha', 'Ann');
	const beta = choice('recent:6', 'Beta', 'Ann', '1.0');
	const all = [a1, a2, a2again, otherAuthor, unversioned, beta];

	it('lists scripts of the same name and author, each version once', () => {
		expect(scriptVersions(all, a2)).toEqual([a1, a2]);
	});

	it('is empty for a script without a version, or with nothing chosen', () => {
		expect(scriptVersions(all, unversioned)).toEqual([]);
		expect(scriptVersions(all, undefined)).toEqual([]);
	});
});
