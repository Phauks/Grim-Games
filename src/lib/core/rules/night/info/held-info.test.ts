/**
 * One Day More's Signal Failure (https://beardytas.com/garden-of-djinn/one-day-more/). A Script
 * World Cup rule, not a character, so the tests quote the author's page.
 */
import { describe, expect, it } from 'vitest';
import { scenario } from '#lib/core/testing/scenario.ts';
import type { NightStep } from '#lib/core/rules/night/night-order.ts';
import { delaysDayInfo, delaysInfo, heldInfo, withHeldInfoSteps } from './held-info.ts';

const RULE = { except: ['artist'] };

describe('One Day More', () => {
	const base = scenario(['fortuneteller', 'chef', 'artist', 'mutant', 'poisoner', 'fanggu']);

	// "The Djinn only affects character abilities containing 'know' or 'learn'." "The artist is
	// also immune."
	it('delays characters that learn information, but not the Artist or others', () => {
		const delays = (id: string) => delaysInfo(base.game, id, base.characters, RULE);
		expect(delays('fortuneteller')).toBe(true);
		expect(delays('chef')).toBe(true);
		expect(delays('artist')).toBe(false);
		expect(delays('fanggu')).toBe(false);
		expect(delaysInfo(base.game, 'chef', base.characters, undefined)).toBe(false);
	});

	// "There is a 24 hour delay impacting all characters with abilities that know or learn
	// information." The Savant learns things in the day, the Puzzlemaster learns from a guess.
	it('delays day information too: the Savant and the Puzzlemaster', () => {
		const day = scenario(['savant', 'puzzlemaster', 'artist', 'chef', 'poisoner', 'imp']);
		const delays = (id: string) => delaysDayInfo(day.game, id, day.characters, RULE);
		expect(delays('savant')).toBe(true);
		expect(delays('puzzlemaster')).toBe(true);
		expect(delays('artist')).toBe(false);
		expect(delays('chef')).toBe(false);
		expect(delaysDayInfo(day.game, 'savant', day.characters, undefined)).toBe(false);
	});

	// "Information is backwards looking to when the ability was used." "a Fortune Teller who picks
	// the Mutant on night 2 learns a 'No' on night 3, even if the Mutant has since been Fang Gu
	// jumped to": what they get is what was recorded when the ability was used.
	it('gives tonight what was worked out last night, as it was then', () => {
		const night = base.do((at) => ({
			type: 'RecordNightInfo',
			seatId: at.seat('fortuneteller'),
			characterId: 'fortuneteller',
			text: 'No'
		}));
		expect(
			heldInfo(night.game, night.seat('fortuneteller'), 'fortuneteller', night.characters)
		).toEqual([]);
		const next = night.newDay().becomes('mutant', 'fanggu');
		expect(
			heldInfo(next.game, next.seat('fortuneteller'), 'fortuneteller', next.characters).map(
				(h) => h.text
			)
		).toEqual(['No']);
	});

	// "Droisoning only affects the receiving of information." "A Sage who dies sober on night 3 and
	// is droisoned on night 4 receives misinformation."
	it('marks it as possibly false when the player is drunk or poisoned on receiving it', () => {
		const recorded = base
			.do((at) => ({
				type: 'RecordNightInfo',
				seatId: at.seat('chef'),
				characterId: 'chef',
				text: 'Shown 1'
			}))
			.newDay();
		const sober = heldInfo(recorded.game, recorded.seat('chef'), 'chef', recorded.characters);
		expect(sober.map((h) => [h.text, h.shows, h.impaired])).toEqual([['Shown 1', '1', false]]);
		const poisoned = recorded.poisoned('chef');
		const now = heldInfo(poisoned.game, poisoned.seat('chef'), 'chef', poisoned.characters);
		expect(now.map((h) => h.impaired)).toEqual([true]);
	});

	it('wakes a first-night character the night after, to receive what it learned', () => {
		const recorded = base
			.do((at) => ({
				type: 'RecordNightInfo',
				seatId: at.seat('chef'),
				characterId: 'chef',
				text: '1'
			}))
			.newDay();
		const steps: NightStep[] = [
			{ id: 'dusk', kind: 'marker', afterDawn: false, placement: 'marker', notes: [] },
			{ id: 'dawn', kind: 'marker', afterDawn: false, placement: 'marker', notes: [] }
		] as NightStep[];
		const out = withHeldInfoSteps(steps, recorded.game, recorded.characters, RULE);
		expect(out.map((s) => s.id)).toEqual(['dusk', 'chef', 'dawn']);
		expect(out[1].heldInfo).toBe(true);
		expect(withHeldInfoSteps(steps, recorded.game, recorded.characters, undefined)).toEqual(steps);
	});
});
