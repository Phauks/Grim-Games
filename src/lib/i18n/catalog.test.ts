import { describe, expect, it } from 'vitest';
import {
	checkTranslation,
	createTranslator,
	formatMessage,
	placeholdersOf
} from '#lib/i18n/catalog.ts';
import { en } from '#lib/i18n/messages/en.ts';

describe('formatMessage', () => {
	it('fills placeholders and formats numbers for the locale', () => {
		expect(formatMessage('Seat {number}', { number: 3 }, 'en')).toBe('Seat 3');
		expect(formatMessage('{count} votes', { count: 1200 }, 'de')).toBe('1.200 votes');
	});

	it('picks the plural form for the locale', () => {
		const players = { one: '{count} player', other: '{count} players' };
		expect(formatMessage(players, { count: 1 }, 'en')).toBe('1 player');
		expect(formatMessage(players, { count: 5 }, 'en')).toBe('5 players');
		// Polish uses "few" for 2-4; a missing form falls back to "other".
		const pl = { one: '{count} gracz', few: '{count} graczy (few)', other: '{count} graczy' };
		expect(formatMessage(pl, { count: 3 }, 'pl')).toBe('3 graczy (few)');
		expect(formatMessage({ other: '{count} x' }, { count: 1 }, 'en')).toBe('1 x');
	});

	it('leaves a placeholder without a value visible', () => {
		expect(formatMessage('Hello {name}', {}, 'en')).toBe('Hello {name}');
	});
});

describe('createTranslator', () => {
	it('falls back to English key by key', () => {
		const t = createTranslator('fr', { 'common.cancel': 'Annuler' }, en);
		expect(t('common.cancel')).toBe('Annuler');
		expect(t('common.close')).toBe('Close');
		expect(t('common.seat', { number: 2 })).toBe('Seat 2');
		expect(t('common.players', { count: 2 })).toBe('2 players');
	});
});

describe('checkTranslation', () => {
	const source = {
		a: 'Seat {number}',
		b: { one: '{count} player', other: '{count} players' },
		c: 'Close'
	};

	it('accepts a matching translation', () => {
		const de = {
			a: 'Platz {number}',
			b: { one: '{count} Spieler', other: '{count} Spieler' },
			c: 'Schließen'
		};
		expect(checkTranslation('de', de, source, { requireComplete: true })).toEqual([]);
	});

	it('reports drift from the English catalog', () => {
		const bad = { a: 'Platz {nummer}', b: 'Spieler', x: 'Extra' };
		expect(checkTranslation('de', bad, source, { requireComplete: true })).toEqual([
			'de: a has {nummer} but English has {number}',
			'de: b must be plural forms',
			'de: missing c',
			'de: x is not an English key'
		]);
		expect(checkTranslation('de', { c: 'Schließen' }, source, { requireComplete: false })).toEqual(
			[]
		);
	});

	it('requires exactly the plural forms the locale uses', () => {
		const pl = { b: { one: '{count} gracz', other: '{count} graczy' } };
		expect(checkTranslation('pl', pl, source, { requireComplete: false })).toEqual([
			'pl: b is missing its "few" form',
			'pl: b is missing its "many" form'
		]);
		const ja = { b: { one: '{count}人', other: '{count}人' } };
		expect(checkTranslation('ja', ja, source, { requireComplete: false })).toEqual([
			'ja: b has a "one" form ja never uses'
		]);
	});

	it('lists placeholders across plural forms', () => {
		expect(placeholdersOf({ one: '{name} has one', other: '{name} has {count}' })).toEqual([
			'count',
			'name'
		]);
	});
});
