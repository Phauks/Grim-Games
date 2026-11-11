import { describe, expect, it } from 'vitest';
import { presetTable } from './presets.ts';

type Block = { kind: 'condition'; token?: string; winner?: string };

const table = presetTable<'fixed' | 'worked-out', { token?: string }, Block>({
	fixed: { kind: 'condition', winner: 'good' },
	'worked-out': (entry) => ({ kind: 'condition', token: entry.token })
});

describe('presetTable', () => {
	it('lists its names and knows only its own', () => {
		expect(table.names).toEqual(['fixed', 'worked-out']);
		expect(table.has('fixed')).toBe(true);
		expect(table.has('condition')).toBe(false);
		expect(table.has('constructor')).toBe(false);
	});

	it('expands a name to its block, keeping the name as the preset', () => {
		expect(table.expand('fixed', {})).toEqual({
			kind: 'condition',
			winner: 'good',
			preset: 'fixed'
		});
		expect(table.expand('worked-out', { token: 'Fear' })).toEqual({
			kind: 'condition',
			token: 'Fear',
			preset: 'worked-out'
		});
	});
});
