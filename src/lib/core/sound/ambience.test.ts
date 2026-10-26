import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	AMBIENCE_MIXES,
	DEFAULT_AMBIENCE,
	ambienceMix,
	ambienceOptions,
	ambienceUrl,
	parseAmbience
} from './ambience.ts';

describe('the recordings', () => {
	it('are all in static/sounds/ambience, with nothing unused there', () => {
		expect(new Set(readdirSync('static/sounds/ambience'))).toEqual(
			new Set(AMBIENCE_MIXES.map((mix) => `${mix.id}.mp3`))
		);
	});

	it('each have their own id, name and a page to credit', () => {
		expect(new Set(AMBIENCE_MIXES.map((mix) => mix.id)).size).toBe(AMBIENCE_MIXES.length);
		expect(new Set(AMBIENCE_MIXES.map((mix) => mix.name)).size).toBe(AMBIENCE_MIXES.length);
		for (const mix of AMBIENCE_MIXES) expect(mix.page).toMatch(/^https:\/\//);
	});

	it('have a URL under the ambience path', () => {
		expect(ambienceUrl(ambienceMix('night-meadow')!)).toBe('/sounds/ambience/night-meadow.mp3');
	});
});

describe('ambienceOptions', () => {
	it("lists the scene's own recordings first, then weather and fire, never the other scene's", () => {
		const night = ambienceOptions('night');
		expect(night[0].kind).toBe('night');
		expect(night.map((mix) => mix.kind)).not.toContain('day');
		expect(night.at(-1)?.kind).toBe('fire');
		expect(ambienceOptions('day').map((mix) => mix.kind)).not.toContain('night');
		expect(ambienceOptions('day').some((mix) => mix.kind === 'weather')).toBe(true);
	});

	it('offers each default in its own scene', () => {
		expect(ambienceMix(DEFAULT_AMBIENCE.night)?.kind).toBe('night');
		expect(ambienceMix(DEFAULT_AMBIENCE.day)?.kind).toBe('day');
	});
});

describe('parseAmbience', () => {
	it("keeps a recording the scene offers and defaults anything else, such as the other scene's", () => {
		expect(parseAmbience('night', 'fire-crackle')).toBe('fire-crackle');
		expect(parseAmbience('night', 'day-forest')).toBe(DEFAULT_AMBIENCE.night);
		expect(parseAmbience('day', 'gone')).toBe(DEFAULT_AMBIENCE.day);
		expect(parseAmbience('day', undefined)).toBe(DEFAULT_AMBIENCE.day);
	});
});
