import { describe, expect, it } from 'vitest';
import { ALL_RECAP_PARTS, escapeHtml, recapHtml, type GameRecap } from './recap-html.ts';

const recap: GameRecap = {
	title: 'Trouble <Brewing>',
	author: 'TPI',
	storyteller: 'Sam <ST>',
	played: '19 Oct 2026',
	result: 'Evil won',
	howEnded: 'Saint',
	days: 2,
	seats: [
		{
			seatId: 'a',
			number: 1,
			name: 'Ana',
			end: { name: 'Saint', alignment: 'good' },
			dead: true,
			death: 'Executed'
		},
		{
			seatId: 'b',
			number: 2,
			name: 'Ben "B"',
			start: { name: 'Scarlet Woman', alignment: 'evil' },
			end: { name: 'Imp', alignment: 'evil' },
			dead: false
		}
	],
	log: [{ time: '8:42 PM', text: 'Ana (Saint) was executed' }],
	notes: [{ about: 'Ben "B"', text: 'Bluffed <Chef>' }]
};

describe('recapHtml', () => {
	it('escapes every text it is given', () => {
		const html = recapHtml(recap, ALL_RECAP_PARTS);
		expect(html).toContain('<title>Trouble &lt;Brewing&gt;</title>');
		expect(html).toContain('Ben &quot;B&quot;');
		expect(html).toContain('Bluffed &lt;Chef&gt;');
		expect(html).not.toContain('<Chef>');
		expect(escapeHtml(`'&`)).toBe('&#39;&amp;');
	});

	it('lists the result, the players, history and notes', () => {
		const html = recapHtml(recap, ALL_RECAP_PARTS);
		expect(html).toContain('Evil won · How it ended: Saint');
		expect(html).toContain('<p>Storyteller: Sam &lt;ST&gt;</p>');
		expect(recapHtml({ ...recap, storyteller: undefined }, ALL_RECAP_PARTS)).toContain(
			'<p>Storyteller: None</p>'
		);
		expect(html).toContain('<span class="character" data-team="evil">Imp</span>');
		expect(html).toContain(
			'(started as <span class="character" data-team="evil">Scarlet Woman</span>)'
		);
		expect(html).toContain('<tr class="dead">');
		expect(html).toContain('Ana (Saint) was executed');
		expect(html).toContain('<h2>Storyteller notes</h2>');
	});

	it('leaves out the parts that are off', () => {
		const html = recapHtml(
			recap,
			{ log: false, image: true, notes: false },
			'data:image/png;base64,AAAA'
		);
		expect(html).not.toContain('<h2>History</h2>');
		expect(html).not.toContain('Storyteller notes');
		expect(html).toContain('<img src="data:image/png;base64,AAAA"');
		expect(
			recapHtml(recap, { ...ALL_RECAP_PARTS, image: false }, 'data:image/png;base64,AAAA')
		).not.toContain('<img');
	});

	it('embeds only image data, never another address', () => {
		const html = recapHtml(recap, ALL_RECAP_PARTS, 'javascript:alert(1)');
		expect(html).not.toContain('<img');
		expect(recapHtml(recap, ALL_RECAP_PARTS, 'https://example.com/a.png')).not.toContain('<img');
	});

	it('says None when a part is empty', () => {
		const html = recapHtml({ ...recap, log: [], notes: [] }, ALL_RECAP_PARTS);
		expect(html.match(/<li>None<\/li>/g)).toHaveLength(2);
	});
});
