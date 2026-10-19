import { describe, expect, it } from 'vitest';
import { GUIDE_PARTS } from '#lib/core/modes/index.ts';
import { guideText } from './guide-export.ts';

describe('guideText', () => {
	// Trevor, 2026-10-18: the guide downloads as a .md or .txt file.
	it('writes every part as Markdown, with its fields as a table and the examples as JSON', () => {
		const md = guideText('md');
		expect(md).toMatch(/^# Writing a mode file\n/);
		for (const p of GUIDE_PARTS) expect(md).toContain(`(\`${p.part}\`)`);
		expect(md).toContain('| Field | Type | Required | About |');
		expect(md).toContain('```json\n{\n  "format": 1');
	});

	it('writes the same guide as plain text, with no Markdown marks', () => {
		const txt = guideText('txt');
		expect(txt).toMatch(/^Writing a mode file\n=+\n/);
		for (const p of GUIDE_PARTS) expect(txt).toContain(`(${p.part})`);
		expect(txt).not.toContain('```');
		expect(txt).not.toContain('| --- |');
	});
});
