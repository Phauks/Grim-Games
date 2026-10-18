import { describe, expect, it } from 'vitest';
import { OFFICIAL_EDITIONS } from './script.ts';
import {
	authorLogo,
	editionLogo,
	LOGO_EDITIONS,
	logoInScriptJson,
	scriptLogo
} from './script-logo.ts';

describe('script logos', () => {
	it('shows TPI edition logos for the base three only', () => {
		expect(editionLogo('tb')).toBe('/data/logos/tb.webp');
		expect(editionLogo('bmr')).toBe('/data/logos/bmr.webp');
		expect(editionLogo('snv')).toBe('/data/logos/snv.webp');
		expect(editionLogo('carousel')).toBeUndefined();
		expect(editionLogo(undefined)).toBeUndefined();
		expect(LOGO_EDITIONS).toEqual(OFFICIAL_EDITIONS.map((e) => e.id));
	});

	it("keeps only an author's https logo link", () => {
		expect(authorLogo(' https://example.com/logo.png ')).toBe('https://example.com/logo.png');
		expect(authorLogo('http://example.com/logo.png')).toBeUndefined();
		expect(authorLogo('data:image/png;base64,AAAA')).toBeUndefined();
		expect(authorLogo('javascript:alert(1)')).toBeUndefined();
		expect(authorLogo('https://')).toBeUndefined();
		expect(authorLogo(42)).toBeUndefined();
	});

	it('prefers the edition logo, then the author logo, else none', () => {
		const logo = 'https://example.com/logo.png';
		expect(scriptLogo({ edition: 'tb', meta: { name: 'Trouble Brewing', logo } })).toBe(
			'/data/logos/tb.webp'
		);
		expect(scriptLogo({ meta: { name: 'Mine', logo } })).toBe(logo);
		expect(scriptLogo({ meta: { name: 'Mine' } })).toBeUndefined();
	});

	it('reads _meta.logo from listed script JSON', () => {
		const logo = 'https://example.com/logo.png';
		expect(logoInScriptJson([{ id: '_meta', name: 'A', logo }, 'imp'])).toBe(logo);
		expect(logoInScriptJson(['imp'])).toBeUndefined();
		expect(logoInScriptJson({ id: '_meta', logo })).toBeUndefined();
	});
});
