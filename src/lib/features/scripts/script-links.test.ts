import { describe, expect, it } from 'vitest';
import { resolveLink } from './script-links.ts';

describe('resolveLink', () => {
	it.each([
		['https://example.com/my.json', 'https://example.com/my.json'],
		['example.com/my.json', 'https://example.com/my.json'],
		['http://example.com/my.json', 'https://example.com/my.json'],
		// Pocket Grimoire issue 124: a Pastebin page link.
		['https://pastebin.com/AbC123', 'https://pastebin.com/raw/AbC123'],
		['https://pastebin.com/raw/AbC123', 'https://pastebin.com/raw/AbC123'],
		[
			'https://github.com/someone/scripts/blob/main/folder/my%20script.json',
			'https://raw.githubusercontent.com/someone/scripts/main/folder/my%20script.json'
		],
		[
			'https://gist.github.com/someone/0123abcd',
			'https://gist.githubusercontent.com/someone/0123abcd/raw'
		]
	])('%s → %s', (input, url) => {
		expect(resolveLink(input)).toEqual({ kind: 'fetch', url });
	});

	it('sends BotC Scripts links to the BotC Scripts lookup', () => {
		expect(resolveLink('https://botcscripts.com/script/42/1.0.0')).toEqual({
			kind: 'botcscripts',
			ref: { kind: 'script', scriptId: 42, version: '1.0.0' }
		});
	});

	it.each(['', '   ', 'ftp://example.com/a.json', 'https://user:pw@example.com/a.json'])(
		'refuses %j with a message',
		(input) => {
			const target = resolveLink(input);
			expect(target.kind).toBe('invalid');
		}
	);
});

describe('resolveLink with Script Tool links', () => {
	it('reads the script from the link itself', () => {
		const link = 'https://script.bloodontheclocktower.com/?script=H4sIAAAA%2Bab';
		expect(resolveLink(link)).toEqual({ kind: 'scripttool', payload: 'H4sIAAAA+ab', url: link });
	});
});
