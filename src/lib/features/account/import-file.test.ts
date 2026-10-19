import { describe, expect, it } from 'vitest';
import type { ProfileDoc } from './account-protocol.ts';
import { planImport, readAccountExport } from './import-file.ts';

const doc = (id: string, body: unknown): ProfileDoc => ({
	kind: 'script',
	id,
	rev: 1,
	updatedAt: 1,
	deleted: false,
	body
});

describe('readAccountExport', () => {
	it('reads the documents of a Download my data file, old or new', () => {
		const file = { user: {}, docs: [doc('a', { name: 'One' })] };
		const expected = {
			ok: true,
			docs: [{ kind: 'script', id: 'a', body: { name: 'One' } }],
			unknown: 0
		};
		expect(readAccountExport(file)).toEqual(expected);
		expect(readAccountExport({ format: 'grimbinder-account', version: 1, ...file })).toEqual(
			expected
		);
	});
	it('counts kinds this version does not know, and leaves out deleted items', () => {
		const file = {
			docs: [
				{ ...doc('a', {}), kind: 'game' },
				{ ...doc('b', {}), deleted: true }
			]
		};
		expect(readAccountExport(file)).toEqual({ ok: true, docs: [], unknown: 1 });
	});
	it('refuses other files and files from a newer version', () => {
		expect(readAccountExport([])).toEqual({ ok: false, reason: 'not-export' });
		expect(readAccountExport({ format: 'other', docs: [] })).toEqual({
			ok: false,
			reason: 'not-export'
		});
		expect(readAccountExport({ version: 2, docs: [] })).toEqual({ ok: false, reason: 'newer' });
	});
});

describe('planImport', () => {
	const ids = () => {
		let n = 0;
		return () => `new-${++n}`;
	};
	it('adds what is missing, skips what is already there, and never replaces', () => {
		const existing = [doc('a', { name: 'One' }), doc('b', { name: 'Two' })];
		const plan = planImport(
			[
				{ kind: 'script', id: 'a', body: { name: 'One' } },
				{ kind: 'script', id: 'b', body: { name: 'Two, changed' } },
				{ kind: 'script', id: 'c', body: { name: 'Three' } }
			],
			() => existing,
			ids()
		);
		expect(plan).toEqual({
			same: 1,
			add: [
				{ kind: 'script', id: 'new-1', body: { name: 'Two, changed' } },
				{ kind: 'script', id: 'c', body: { name: 'Three' } }
			]
		});
	});
});
