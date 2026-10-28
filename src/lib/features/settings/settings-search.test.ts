import { describe, expect, it } from 'vitest';
import { searchSettings, type SettingEntry } from './settings-search.ts';

const entry = (
	section: string,
	label: string,
	index: number,
	description?: string
): SettingEntry => ({ section, sectionLabel: section, label, description, index });

const entries = [
	entry('Theme', 'Accent colour', 0),
	entry('Text', 'Text size', 0, 'Scales every word in the app'),
	entry('Board', 'Background', 0),
	entry('Board', 'Background', 1),
	entry('Tokens', 'Reminder size', 0),
	entry('Board', 'Token size on the board', 2)
];

const labels = (query: string) => searchSettings(entries, query).map((e) => e.label);

describe('searchSettings', () => {
	it('matches nothing for an empty query', () => {
		expect(labels('  ')).toEqual([]);
	});

	it('ignores case and accents', () => {
		expect(labels('ÁCCENT')).toEqual(['Accent colour']);
	});

	it('needs every word, across name, description and section', () => {
		expect(labels('board background')).toEqual(['Background']);
		expect(labels('every word')).toEqual(['Text size']);
		expect(labels('accent size')).toEqual([]);
	});

	it('puts name matches before description and section matches', () => {
		expect(labels('size')).toEqual(['Text size', 'Reminder size', 'Token size on the board']);
		expect(labels('board')).toEqual(['Token size on the board', 'Background']);
	});

	it('lists the same name once per section', () => {
		expect(searchSettings(entries, 'background')).toHaveLength(1);
	});
});
