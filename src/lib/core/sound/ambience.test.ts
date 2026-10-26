import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	AMBIENCE_CREDITS,
	AMBIENCE_SOUNDS,
	ambienceChoices,
	ambienceFiles,
	ambienceFor,
	callVariation,
	defaultAmbienceChoices,
	nextCallDelay,
	parseAmbienceChoices,
	pickFile,
	RATE_SECONDS
} from './ambience.ts';

describe('the recordings', () => {
	const files = new Set(AMBIENCE_SOUNDS.flatMap((sound) => sound.files));

	it('are all in static/sounds/ambience, with nothing unused there', () => {
		expect(new Set(readdirSync('static/sounds/ambience'))).toEqual(files);
	});

	it('each have a public domain or CC0 credit', () => {
		expect(new Set(AMBIENCE_CREDITS.map((credit) => credit.file))).toEqual(files);
	});

	it('give each sound its own id and a default it allows', () => {
		expect(new Set(AMBIENCE_SOUNDS.map((sound) => sound.id)).size).toBe(AMBIENCE_SOUNDS.length);
		for (const sound of AMBIENCE_SOUNDS) expect(ambienceChoices(sound)).toContain(sound.choice);
	});

	it('list each file once as a URL', () => {
		const urls = ambienceFiles();
		expect(urls).toHaveLength(files.size);
		expect(urls).toContain('/sounds/ambience/wind.mp3');
	});
});

describe('parseAmbienceChoices', () => {
	it('keeps valid choices and defaults the rest', () => {
		const choices = parseAmbienceChoices({
			owl: 'often',
			crickets: 'off',
			wolf: 'on',
			ghost: 'on'
		});
		expect(choices.owl).toBe('often');
		expect(choices.crickets).toBe('off');
		// A call can't be just "on"; it falls back to its default.
		expect(choices.wolf).toBe('rare');
		expect(choices).not.toHaveProperty('ghost');
	});

	it('gives every sound its default from nothing', () => {
		expect(parseAmbienceChoices('nonsense')).toEqual(defaultAmbienceChoices());
		expect(defaultAmbienceChoices().crickets).toBe('on');
	});
});

describe('ambienceFor', () => {
	it("plays the scene's sounds and the weather, not those turned off", () => {
		const choices = { ...defaultAmbienceChoices(), rain: 'on' as const, owl: 'off' as const };
		const night = ambienceFor('night', choices).map((sound) => sound.id);
		expect(night).toContain('crickets');
		expect(night).toContain('rain');
		expect(night).not.toContain('owl');
		expect(night).not.toContain('songbirds');
		expect(ambienceFor('day', choices).map((sound) => sound.id)).toContain('songbirds');
	});
});

describe('call timing', () => {
	it('waits half to one and a half times the average', () => {
		expect(nextCallDelay('sometimes', () => 0)).toBe(RATE_SECONDS.sometimes / 2);
		expect(nextCallDelay('sometimes', () => 0.999)).toBeCloseTo(RATE_SECONDS.sometimes * 1.5, 1);
		expect(RATE_SECONDS.often).toBeLessThan(RATE_SECONDS.sometimes);
		expect(RATE_SECONDS.sometimes).toBeLessThan(RATE_SECONDS.rare);
	});

	it('varies speed, loudness and side within bounds', () => {
		expect(callVariation(() => 0)).toEqual({ speed: 0.94, gain: 0.6, pan: -0.7 });
		const high = callVariation(() => 1);
		expect(high.speed).toBeCloseTo(1.06);
		expect(high.gain).toBeCloseTo(1);
		expect(high.pan).toBeCloseTo(0.7);
	});

	it('never repeats the last file when there are others', () => {
		expect(pickFile(['a.mp3', 'b.mp3'], 'a.mp3', () => 0)).toBe('b.mp3');
		expect(pickFile(['a.mp3'], 'a.mp3', () => 0.5)).toBe('a.mp3');
	});
});
