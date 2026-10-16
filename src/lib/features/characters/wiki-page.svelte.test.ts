import { describe, expect, it } from 'vitest';
import { parseWikiPage, wikiPageTitle } from './wiki-page.ts';

// A made-up page in the wiki's shapes (old and new heading markup); no wiki text is copied.
const PAGE = `
<div class="mw-parser-output">
	<table class="infobox"><tr><td>Infobox text</td></tr></table>
	<p>Opening sample line.</p>
	<div id="toc" class="toc">Contents</div>
	<h2><span class="mw-headline" id="Summary">Summary</span><span class="mw-editsection">[edit]</span></h2>
	<p>First   sample
		paragraph.<sup class="reference">[1]</sup></p>
	<ul><li>One</li><li>Two</li></ul>
	<div class="mw-heading mw-heading2"><h2 id="How_to_Run">How to Run</h2></div>
	<p>Second sample paragraph.</p>
	<figure><img src="x.png" /><figcaption>Caption</figcaption></figure>
	<div class="mw-heading mw-heading2"><h2 id="Empty">Empty</h2></div>
</div>`;

describe('parseWikiPage', () => {
	it('keeps headings, paragraphs and lists as text, and drops boxes, images and edit links', () => {
		expect(parseWikiPage(PAGE)).toEqual([
			{ heading: '', blocks: [{ kind: 'p', text: 'Opening sample line.' }] },
			{
				heading: 'Summary',
				blocks: [
					{ kind: 'p', text: 'First sample paragraph.' },
					{ kind: 'list', items: ['One', 'Two'] }
				]
			},
			{ heading: 'How to Run', blocks: [{ kind: 'p', text: 'Second sample paragraph.' }] }
		]);
	});

	it('reads the page title from a wiki URL', () => {
		expect(wikiPageTitle('https://wiki.bloodontheclocktower.com/Fortune_Teller')).toBe(
			'Fortune_Teller'
		);
		expect(wikiPageTitle("https://wiki.bloodontheclocktower.com/Hell's_Librarian")).toBe(
			"Hell's_Librarian"
		);
	});
});
