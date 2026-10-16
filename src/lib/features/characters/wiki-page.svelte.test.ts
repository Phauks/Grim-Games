import { describe, expect, it } from 'vitest';
import { parseWikiPage, wikiPageTitle, withoutRepeats } from './wiki-page.ts';

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

	it("drops the wiki's Related Jinxes box above the Summary", () => {
		const html =
			'<div class="mw-parser-output"><div id="jinxes"><p><span>Sample jinx label ' +
			'<span id="jinx-toggle">(Open)</span></span></p><p>Sample jinx.</p></div>' +
			'<h2>Summary</h2><p>Sample summary.</p></div>';
		expect(parseWikiPage(html)).toEqual([
			{ heading: 'Summary', blocks: [{ kind: 'p', text: 'Sample summary.' }] }
		]);
	});

	it('keeps only the quote and artist from the details box, and each example whole', () => {
		const page = `
<div class="mw-parser-output"><div class="row"><div class="columns">
	<div id="character-details">
		<p><a class="image"><img src="i.png" /></a><span>Information</span></p>
		<table><tr><td>Type</td><td>Sample type</td></tr><tr><td>Artist</td><td>Sample Artist</td></tr></table>
		<p class="flavour">"A sample quote."</p>
		<p><span>Appears in</span> <a><img alt="logo" /></a> <span>Sample episode</span></p>
		<div class="html5audio"></div>
	</div>
</div><div class="columns">
	<h2><span class="mw-headline">Examples</span></h2>
	<div class="example"><p>First <span data-role="x">sample</span> example.</p></div>
	<div class="example"><p>Second sample example.</p></div>
	<h2><span class="mw-headline">Tips &amp; Tricks</span></h2>
	<ul><li>Sample tip one.</li></ul>
	<ul><li>Sample tip two.</li></ul>
</div></div></div>`;
		expect(parseWikiPage(page)).toEqual([
			{
				heading: '',
				blocks: [
					{ kind: 'quote', text: '"A sample quote."' },
					{ kind: 'artist', name: 'Sample Artist' }
				]
			},
			{
				heading: 'Examples',
				blocks: [
					{ kind: 'example', text: 'First sample example.' },
					{ kind: 'example', text: 'Second sample example.' }
				]
			},
			{
				heading: 'Tips & Tricks',
				blocks: [
					{ kind: 'list', items: ['Sample tip one.'] },
					{ kind: 'list', items: ['Sample tip two.'] }
				]
			}
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

// Made-up sample wording in the wiki's shapes.
describe('withoutRepeats', () => {
	const ability = 'Each night*, choose a sample player [+1 Sample].';
	it("drops the Summary's copy of the ability, ignoring quotes, brackets and spacing", () => {
		const section = {
			heading: 'Summary',
			blocks: [
				{ kind: 'p' as const, text: '“Each night*, choose a  sample player (+1 Sample).”' },
				{ kind: 'p' as const, text: 'More sample text.' }
			]
		};
		expect(withoutRepeats(section, ability).blocks).toEqual([
			{ kind: 'p', text: 'More sample text.' }
		]);
	});
	it('keeps wording that differs from the ability', () => {
		const section = {
			heading: 'Summary',
			blocks: [{ kind: 'p' as const, text: '"Each night, choose two sample players."' }]
		};
		expect(withoutRepeats(section, ability)).toBe(section);
	});
	it('drops the standard Bluffing lead-in and keeps the tips', () => {
		const tips = { kind: 'list' as const, items: ['Sample tip.'] };
		const section = {
			heading: 'Bluffing as the Sample',
			blocks: [
				{
					kind: 'p' as const,
					text: 'When bluffing as the Sample, there are a few things you should keep in mind:'
				},
				tips
			]
		};
		expect(withoutRepeats(section, ability).blocks).toEqual([tips]);
	});
});
