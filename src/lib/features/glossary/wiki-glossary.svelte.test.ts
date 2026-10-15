import { describe, expect, it } from 'vitest';
import { glossaryKey, parseGlossaryHtml } from './wiki-glossary.ts';

// A made-up page in the wiki's shapes; no wiki text is copied here.
const PAGE = `
<div class="mw-parser-output">
	<h2>A</h2>
	<p><b>Alpha:</b> First sample meaning.</p>
	<ul><li><b>Beta Term:</b> Second   sample
		meaning, with a <a href="/X">link</a>.</li></ul>
	<dl><dt>Gamma</dt><dd>Third sample meaning.</dd></dl>
	<p>A paragraph with no entry in it.</p>
</div>`;

describe('parseGlossaryHtml', () => {
	it('reads "Term: meaning" blocks and dt/dd pairs, keeping the text as written', () => {
		const entries = parseGlossaryHtml(PAGE);
		expect(entries.get('alpha')).toBe('First sample meaning.');
		expect(entries.get('beta term')).toBe('Second sample meaning, with a link.');
		expect(entries.get('gamma')).toBe('Third sample meaning.');
		expect(entries.size).toBe(3);
	});

	it('looks entries up ignoring case and spacing', () => {
		expect(glossaryKey('  Each  Night* ')).toBe('each night*');
	});
});
