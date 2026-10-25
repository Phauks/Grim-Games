import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
	byShape,
	describeChunks,
	fileName,
	namePattern,
	namesIn,
	parseChunks,
	renamed,
	shapeOf
} from './chunk-renames.ts';

const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16);

// Two builds where only `core` changed: `page` imports it, so `page` was renamed too.
const before = {
	'/_app/immutable/chunks/Core1111.js': 'export const a=1;',
	'/_app/immutable/nodes/0.Page1111.js':
		'import{a}from"../chunks/Core1111.js";import"../assets/0.Css11111.css";a;'
};
const after = {
	'/_app/immutable/chunks/Core2222.js': 'export const a=2;',
	'/_app/immutable/nodes/0.Page2222.js':
		'import{a}from"../chunks/Core2222.js";import"../assets/0.Css11111.css";a;'
};
const assets = ['/_app/immutable/assets/0.Css11111.css'];

describe('build file names in a file', () => {
	const pattern = namePattern(['Core1111.js', '0.Css11111.css']);

	it('finds them in order, only after a slash', () => {
		const text = before['/_app/immutable/nodes/0.Page1111.js'];
		expect(namesIn(text, pattern)).toEqual(['Core1111.js', '0.Css11111.css']);
		expect(namesIn('"Core1111.js"', pattern)).toEqual([]);
	});

	it('blanks them for the shape, so renamed copies share one', () => {
		const one = shapeOf('from"./Core1111.js"', pattern);
		const two = shapeOf('from"./Core2222.js"', namePattern(['Core2222.js']));
		expect(one).toBe(two);
		expect(one).not.toContain('Core');
	});

	it('matches a longer name whole when a shorter one ends it', () => {
		const both = namePattern(['B.js', 'AB.js']);
		expect(namesIn('./AB.js ./B.js', both)).toEqual(['AB.js', 'B.js']);
	});

	it('has nothing to match with no names', () => {
		expect(namesIn('./a.js', namePattern([]))).toEqual([]);
	});
});

describe('rebuilding a renamed file', () => {
	const old = describeChunks(before, [...Object.keys(before), ...assets], hash);
	const now = describeChunks(after, [...Object.keys(after), ...assets], hash);
	const oldPattern = namePattern([...Object.keys(before), ...assets].map(fileName));

	it('describes each file by hash, shape and the names it uses', () => {
		expect(now['/_app/immutable/nodes/0.Page2222.js'].names).toEqual([
			'Core2222.js',
			'0.Css11111.css'
		]);
		expect(now['/_app/immutable/nodes/0.Page2222.js'].shape).toBe(
			old['/_app/immutable/nodes/0.Page1111.js'].shape
		);
		expect(now['/_app/immutable/chunks/Core2222.js'].shape).not.toBe(
			old['/_app/immutable/chunks/Core1111.js'].shape
		);
	});

	it('puts the new names into the stored copy, giving the new file exactly', () => {
		const info = now['/_app/immutable/nodes/0.Page2222.js'];
		const from = byShape(old).get(info.shape);
		expect(from).toBe('/_app/immutable/nodes/0.Page1111.js');
		const text = renamed(before[from as keyof typeof before], oldPattern, info.names);
		expect(text).toBe(after['/_app/immutable/nodes/0.Page2222.js']);
		expect(hash(text as string)).toBe(info.hash);
	});

	it('gives up when the stored copy names a different number of files', () => {
		expect(renamed('import"./Core1111.js"', oldPattern, [])).toBeUndefined();
	});

	it('finds no stored copy for a file whose code changed', () => {
		expect(byShape(old).get(now['/_app/immutable/chunks/Core2222.js'].shape)).toBeUndefined();
	});
});

describe('parseChunks', () => {
	it('keeps well-formed entries only', () => {
		expect(
			parseChunks({
				'/a.js': { hash: 'h', shape: 's', names: ['b.js'] },
				'/b.js': { hash: 'h', shape: 's', names: [1] },
				'/c.js': { hash: 'h' },
				'/d.js': null
			})
		).toEqual({ '/a.js': { hash: 'h', shape: 's', names: ['b.js'] } });
		expect(parseChunks('nope')).toEqual({});
		expect(parseChunks(undefined)).toEqual({});
	});
});
