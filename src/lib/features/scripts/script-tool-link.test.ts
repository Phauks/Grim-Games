import { describe, expect, it } from 'vitest';
import {
	scriptToolLink,
	decodeScriptToolPayload,
	readCuratedPage,
	scriptToolPayload,
	ScriptToolLinkError
} from './script-tool-link.ts';

// [{"id":"_meta","name":"Tiny Town","author":"Tester"},"chef","imp"], gzipped and base64-encoded.
const PAYLOAD =
	'H4sIAAAAAAAAA4uuVspMUbJSis9NLUlU0lHKS8xNVbJSCsnMq1QIyS/PU9JRSiwtycgvAgmmFpekFinV6iglZ6SmKekoZeYWKMUCAOsM8rlCAAAA';
const ONCE = encodeURIComponent(PAYLOAD);
const TWICE = encodeURIComponent(ONCE);
const TOOL = 'https://script.bloodontheclocktower.com/?script=';

describe('scriptToolPayload', () => {
	it.each([
		['encoded once', TOOL + ONCE],
		['encoded twice, as on the official Scripts page', TOOL + TWICE],
		['with surrounding spaces', `  ${TOOL + ONCE}  `]
	])('reads a link %s', (_, link) => {
		expect(scriptToolPayload(link)).toBe(PAYLOAD);
	});

	it.each([
		'https://example.com/?script=' + ONCE,
		TOOL,
		'https://script.bloodontheclocktower.com/',
		'not a link',
		TOOL + '%3Cscript%3E'
	])('ignores %s', (text) => {
		expect(scriptToolPayload(text)).toBeUndefined();
	});
});

describe('decodeScriptToolPayload', () => {
	it('unzips the script JSON', async () => {
		const text = await decodeScriptToolPayload(PAYLOAD);
		expect(JSON.parse(text)).toEqual([
			{ id: '_meta', name: 'Tiny Town', author: 'Tester' },
			'chef',
			'imp'
		]);
	});

	it('explains a damaged link', async () => {
		await expect(decodeScriptToolPayload('AAAA')).rejects.toBeInstanceOf(ScriptToolLinkError);
	});
});

describe('readCuratedPage', () => {
	// Our own minimal page shaped like a store page: headings, then script cards with links.
	const page = `
		<h2 class="title">Custom Script of the <strong>Month</strong></h2>
		<div><h3>First</h3><a class="button" href="${TOOL + TWICE}">View</a></div>
		<h2>Recommended &amp; Tested</h2>
		<a href='${TOOL + ONCE}&amp;lang=en'>View</a>
		<a href="https://example.com/elsewhere">Other</a>
		<a href="${TOOL + TWICE}">Same link again</a>
		<h2>Teensyville Scripts</h2>
		<a href="${TOOL + ONCE}">View</a>
	`;

	it('lists each Script Tool link once, under its section', () => {
		expect(readCuratedPage(page)).toEqual([
			{ section: 'month', link: TOOL + TWICE },
			{ section: 'recommended', link: `${TOOL + ONCE}&lang=en` },
			{ section: 'teensyville', link: TOOL + ONCE }
		]);
	});

	it('finds nothing on a page without links', () => {
		expect(readCuratedPage('<h2>Scripts</h2><p>None yet</p>')).toEqual([]);
	});
});

describe('scriptToolLink', () => {
	it('round-trips through the reader', async () => {
		const json = JSON.stringify([{ id: '_meta', name: 'Ünïcode & Friends' }, 'chef', 'imp']);
		const link = await scriptToolLink(json);
		expect(link.startsWith('https://script.bloodontheclocktower.com/?script=')).toBe(true);
		const payload = scriptToolPayload(link);
		expect(payload).toBeDefined();
		expect(await decodeScriptToolPayload(payload!)).toBe(json);
	});
});
