import { describe, expect, it } from 'vitest';
import {
	CAROUSEL_COLLECTION,
	collectionHeadingUrl,
	driveDownloadUrls,
	driveFileId,
	readCollectionDoc,
	readCollectionList,
	readScriptFile
} from './collection-api.ts';

const ID = '1AVrIxWsrBMlATsoU-2M5X03jGeBaJYJb';

describe('script collections', () => {
	it('reads Drive file ids, through Google Docs redirect links too', () => {
		expect(driveFileId(`https://drive.google.com/file/d/${ID}/view?usp=sharing`)).toBe(ID);
		expect(driveFileId(`https://drive.google.com/open?id=${ID}`)).toBe(ID);
		const wrapped = `https://www.google.com/url?q=https://drive.google.com/file/d/${ID}/view?usp%3Dsharing&amp;sa=D&amp;source=editors`;
		expect(driveFileId(wrapped)).toBe(ID);
		expect(driveFileId('https://example.com/file/d/abc/view')).toBeUndefined();
	});

	it('takes only the links to each script’s JSON, once each, in the doc’s order', () => {
		const html = `
			<h2 class="c4" id="h.gnrzqiid7k9x"><span>Contempt</span></h2>
			<p><a href="https://drive.google.com/file/d/${ID}/view"><span>Script JSON</span></a>
			<a href="https://drive.google.com/file/d/1d-ToSIRLvPfyQgwGX_rdSjfNwbigX1tH/view">Script PDF</a></p>
			<h2 id="h.second1"><span>Devout Theists</span></h2>
			<p><a href="https://drive.google.com/open?id=1_rxIlqzJnLgME8GTt3aFTrdQd9dhD41O">Script JSON</a>
			<a href="https://drive.google.com/file/d/${ID}/view">Script JSON</a></p>`;
		// Each with the heading it sits under, so it links to its own section of the doc.
		expect(readCollectionDoc(html)).toEqual([
			{ fileId: ID, heading: 'h.gnrzqiid7k9x' },
			{ fileId: '1_rxIlqzJnLgME8GTt3aFTrdQd9dhD41O', heading: 'h.second1' }
		]);
		expect(collectionHeadingUrl(CAROUSEL_COLLECTION, 'h.gnrzqiid7k9x')).toBe(
			'https://docs.google.com/document/d/1U_OQJQXyp5p0yuRaqqd44zWwQYRjvrql9D-4xIogQK4/edit#heading=h.gnrzqiid7k9x'
		);
	});

	it('checks the Worker’s answer', () => {
		const page = collectionHeadingUrl(CAROUSEL_COLLECTION, 'h.a');
		expect(
			readCollectionList({
				scripts: [{ link: 'x', page, json: [] }, { link: 1 }, { link: 'y', json: [] }]
			})
		).toEqual([
			{ link: 'x', page, json: [] },
			// Cached before pages were sent: the doc itself.
			{ link: 'y', page: collectionHeadingUrl(CAROUSEL_COLLECTION), json: [] }
		]);
		expect(readCollectionList({})).toBeUndefined();
	});

	it('downloads from Drive’s current file host first, skipping the virus-scan page', () => {
		expect(driveDownloadUrls(ID)[0]).toBe(
			`https://drive.usercontent.google.com/download?id=${ID}&export=download&confirm=t`
		);
	});

	it('reads a downloaded script, and refuses Drive’s HTML pages', () => {
		expect(readScriptFile('\uFEFF[{"id":"_meta","name":"Contempt"},"imp"]')).toEqual([
			{ id: '_meta', name: 'Contempt' },
			'imp'
		]);
		// Hand-edited files with a trailing comma still load.
		expect(readScriptFile('["imp", "washerwoman",]\n')).toEqual(['imp', 'washerwoman']);
		expect(
			readScriptFile('<!DOCTYPE html><html><title>Google Drive - Virus scan warning')
		).toBeUndefined();
		expect(readScriptFile('{"id":"imp"}')).toBeUndefined();
	});

	it('reads the links from the doc’s mobile view, where hrefs are escaped', () => {
		const html = `<p><a href="https://www.google.com/url?q=https://drive.google.com/file/d/${ID}/view?usp%3Dsharing&amp;sa=D&amp;source=editors&amp;ust=1&amp;usg=x" class="c3">Script JSON</a></p>`;
		expect(readCollectionDoc(html)).toEqual([{ fileId: ID }]);
	});
});
