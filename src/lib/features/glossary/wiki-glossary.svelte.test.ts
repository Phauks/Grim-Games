import { describe, expect, it } from 'vitest';
import { entryText, glossaryKey, linkTarget, parseGlossaryHtml } from './wiki-glossary.ts';

// A made-up page in the wiki's shapes; no wiki text is copied here.
const PAGE = `
<div class="mw-parser-output">
	<h2>A</h2>
	<p><b>Alpha:</b> First sample meaning.</p>
	<ul><li><b>Beta Term:</b> Second   sample
		meaning, with a <a href="/X">link</a>.</li></ul>
	<dl><dt>Gamma</dt><dd>Third sample meaning. See <a href="/Glossary#Alpha">Alpha</a>
		or the <a href="/Sample_Role">Sample Role</a>.</dd></dl>
	<p>A paragraph with no entry in it.</p>
</div>`;

describe('parseGlossaryHtml', () => {
	it('reads "Term: meaning" blocks and dt/dd pairs, keeping the text as written', () => {
		const entries = parseGlossaryHtml(PAGE);
		expect(entryText(entries.get('alpha')!)).toBe('First sample meaning.');
		expect(entries.get('alpha')!.name).toBe('Alpha');
		expect(entryText(entries.get('beta term')!)).toBe('Second sample meaning, with a link.');
		expect(entryText(entries.get('gamma')!)).toBe(
			'Third sample meaning. See Alpha or the Sample Role.'
		);
		expect(entries.size).toBe(3);
	});

	it('keeps where links point', () => {
		const gamma = parseGlossaryHtml(PAGE).get('gamma')!;
		expect(gamma.parts.filter((p) => p.href)).toEqual([
			{ text: 'Alpha', href: 'https://wiki.bloodontheclocktower.com/Glossary#Alpha' },
			{ text: 'Sample Role', href: 'https://wiki.bloodontheclocktower.com/Sample_Role' }
		]);
	});

	it('looks entries up ignoring case and spacing', () => {
		expect(glossaryKey('  Each  Night* ')).toBe('each night*');
	});
});

describe('linkTarget', () => {
	const entries = parseGlossaryHtml(PAGE);
	const wiki = 'https://wiki.bloodontheclocktower.com';
	it('opens another Glossary entry in the popover', () => {
		expect(linkTarget(`${wiki}/Glossary#Alpha`, entries, [])).toEqual({
			kind: 'term',
			key: 'alpha'
		});
		expect(linkTarget(`${wiki}/Beta_Term`, entries, [])).toEqual({
			kind: 'term',
			key: 'beta term'
		});
	});
	it('shows a character as its badge', () => {
		expect(linkTarget(`${wiki}/Sample_Role`, entries, ['Sample Role'])).toEqual({
			kind: 'character',
			name: 'Sample Role'
		});
	});
	it('opens any other page on the wiki', () => {
		expect(linkTarget(`${wiki}/Rules_Page`, entries, [])).toEqual({
			kind: 'page',
			url: `${wiki}/Rules_Page`
		});
		expect(linkTarget('https://example.com/x', entries, [])).toEqual({
			kind: 'page',
			url: 'https://example.com/x'
		});
	});
});
