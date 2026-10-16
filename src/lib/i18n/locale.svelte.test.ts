import { describe, expect, it } from 'vitest';
import { intl, locale, say, t } from '#lib/i18n/locale.svelte.ts';

describe('locale store', () => {
	it('translates keys and core messages in the current language', () => {
		expect(t('common.cancel')).toBe('Cancel');
		expect(t('common.players', { count: 1 })).toBe('1 player');
		expect(say({ key: 'common.seat', params: { number: 4 } })).toBe('Seat 4');
		expect(say({ key: 'common.none' })).toBe('None');
	});

	it('type-checks keys and placeholders', () => {
		// @ts-expect-error: not a key in the English catalog.
		expect(t('common.nope')).toBe('common.nope');
		// @ts-expect-error: "Seat {number}" needs its number.
		expect(t('common.seat')).toBe('Seat {number}');
		// @ts-expect-error: plural messages need a numeric count.
		expect(t('common.players', { count: 'two' })).toBe('two players');
	});

	it('sets the page language and direction when a locale is applied', async () => {
		document.documentElement.lang = '';
		await locale.set('en');
		expect(locale.current).toBe('en');
		expect(document.documentElement.lang).toBe('en');
		expect(document.documentElement.dir).toBe('ltr');
		await locale.set('device');
		expect(locale.choice).toBe('device');
	});

	it('formats with Intl for the current language', () => {
		expect(intl.list(['Imp', 'Baron', 'Spy'])).toBe('Imp, Baron, and Spy');
		expect(intl.number(1234)).toBe('1,234');
		expect(['b', 'a'].sort(intl.compare)).toEqual(['a', 'b']);
	});
});
