/**
 * Script facts. Each test cites the wiki page whose rule it relies on.
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { editionScript } from '#lib/core/data/script.ts';
import { scriptFacts } from './script-facts.ts';

const data = committedGameData();
const chars = (...ids: string[]) => ids.map((id) => data.byId.get(id)!);

describe('scriptFacts', () => {
	it('counts Trouble Brewing by type, with no jinxes and no Djinn', () => {
		const tb = editionScript('tb', data)!;
		const facts = scriptFacts(tb.characters, data.jinxes);
		expect(facts.counts).toMatchObject({ townsfolk: 13, outsider: 4, minion: 4, demon: 1 });
		expect(facts.jinxes).toEqual([]);
		expect(facts.djinn).toBe(false);
	});

	// https://wiki.bloodontheclocktower.com/Drunk and https://wiki.bloodontheclocktower.com/Baron
	// both change setup (TPI's [bracketed] setup text).
	it('names the characters that change setup, in script order', () => {
		const tb = editionScript('tb', data)!;
		expect(scriptFacts(tb.characters, data.jinxes).modifiers.map((m) => m.id)).toEqual([
			'drunk',
			'baron'
		]);
	});

	// https://wiki.bloodontheclocktower.com/Djinn: any jinxed pair on the script brings it in.
	it('lists jinxed pairs and says the Djinn applies', () => {
		const facts = scriptFacts(chars('spy', 'magician', 'chef', 'imp'), data.jinxes);
		expect(facts.jinxes.map((j) => [...j.characters].sort().join('+'))).toEqual(['magician+spy']);
		expect(facts.djinn).toBe(true);
	});

	// https://wiki.bloodontheclocktower.com/Choirboy: needs the King in play.
	it('flags a required character missing from the script', () => {
		expect(scriptFacts(chars('choirboy', 'chef', 'imp'), data.jinxes).requirements).toEqual([
			{ id: 'choirboy', requires: 'king', onScript: false }
		]);
		expect(scriptFacts(chars('choirboy', 'king', 'imp'), data.jinxes).requirements).toEqual([
			{ id: 'choirboy', requires: 'king', onScript: true }
		]);
	});
});
