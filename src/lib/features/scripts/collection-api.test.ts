import { describe, expect, it } from 'vitest';
import { driveFileId, readCollectionDoc, readCollectionList } from './collection-api.ts';

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
			<h2>Contempt</h2>
			<p><a href="https://drive.google.com/file/d/${ID}/view"><span>Script JSON</span></a>
			<a href="https://drive.google.com/file/d/1d-ToSIRLvPfyQgwGX_rdSjfNwbigX1tH/view">Script PDF</a></p>
			<p><a href="https://drive.google.com/open?id=1_rxIlqzJnLgME8GTt3aFTrdQd9dhD41O">Script JSON</a>
			<a href="https://drive.google.com/file/d/${ID}/view">Script JSON</a></p>`;
		expect(readCollectionDoc(html)).toEqual([ID, '1_rxIlqzJnLgME8GTt3aFTrdQd9dhD41O']);
	});

	it('checks the Worker’s answer', () => {
		expect(readCollectionList({ scripts: [{ link: 'x', json: [] }, { link: 1 }] })).toEqual([
			{ link: 'x', json: [] }
		]);
		expect(readCollectionList({})).toBeUndefined();
	});
});
