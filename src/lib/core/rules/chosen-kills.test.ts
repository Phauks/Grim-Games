/**
 * Night kills that choose something other than a player (`kills.chooses`): a named character
 * (https://wiki.bloodontheclocktower.com/Ojo) or players who each choose to live or die
 * (https://wiki.bloodontheclocktower.com/Al-Hadikhia).
 */
import { describe, expect, it } from 'vitest';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import {
	killChoice,
	liveOrDieChosen,
	namedCharacterKill,
	resolveLiveOrDie
} from './chosen-kills.ts';

describe('killChoice', () => {
	it('reads what the kill chooses from the rules block', () => {
		expect(killChoice('ojo')).toBe('character');
		expect(killChoice('alhadikhia')).toBe('live-or-die');
		expect(killChoice('imp')).toBeUndefined();
	});

	it('refuses an unknown choice', () => {
		const issues = new Issues();
		parseCharacterRules({ kills: { by: 'demon', chooses: 'seat' } }, 'x', issues);
		expect(issues.list).toHaveLength(1);
		expect(issues.list[0]).toMatch(/^x\.kills\.chooses/);
	});
});

describe('namedCharacterKill', () => {
	const s = scenario(['ojo', 'chef', 'empath', 'monk', 'poisoner']);

	it('finds the player whose true character it is, dead or alive', () => {
		expect(namedCharacterKill(s.game, 'chef', s.characters)).toEqual({
			storytellerChooses: false,
			seats: [s.seat('chef')]
		});
		const dead = s.dies('empath', 'ojo');
		expect(namedCharacterKill(dead.game, 'empath', dead.characters).seats).toEqual([
			dead.seat('empath')
		]);
	});

	it('goes by the true character, not the token the player sees', () => {
		// The Drunk's player sees the Mayor's token.
		const placed = scenario(['ojo', 'chef', 'empath', 'monk', 'poisoner', 'mayor']).reminder(
			'mayor',
			'drunk',
			'Is The Drunk'
		);
		const real = placed.seat('mayor');
		expect(namedCharacterKill(placed.game, 'drunk', placed.characters).seats).toEqual([real]);
		expect(namedCharacterKill(placed.game, 'mayor', placed.characters).storytellerChooses).toBe(
			true
		);
	});

	it('lets the Storyteller choose anyone when the character is not in play', () => {
		expect(namedCharacterKill(s.game, 'virgin', s.characters)).toEqual({
			storytellerChooses: true,
			seats: s.game.seating
		});
	});
});

describe('liveOrDieChosen', () => {
	it('lists the marked players in the order of the reminders', () => {
		const s = scenario(['alhadikhia', 'chef', 'empath', 'monk', 'poisoner'])
			.reminder('monk', 'alhadikhia', '1')
			.reminder('chef', 'alhadikhia', '3')
			.reminder('empath', 'alhadikhia', '2');
		expect(liveOrDieChosen(s.game, 'alhadikhia', s.characters)).toEqual([
			s.seat('monk'),
			s.seat('empath'),
			s.seat('chef')
		]);
	});
});

describe('resolveLiveOrDie', () => {
	const s = scenario(['alhadikhia', 'chef', 'empath', 'monk', 'poisoner']);
	const [chef, empath, monk] = [s.seat('chef'), s.seat('empath'), s.seat('monk')];

	it('kills those who choose death, when someone chooses it', () => {
		const out = resolveLiveOrDie(s.game, [
			{ seatId: chef, lives: false },
			{ seatId: empath, lives: true },
			{ seatId: monk, lives: true }
		]);
		expect(out.allDie).toBe(false);
		expect(out.results.map((r) => [r.dead, r.died, r.revived])).toEqual([
			[true, true, false],
			[false, false, false],
			[false, false, false]
		]);
	});

	it('kills everyone when everyone lives', () => {
		const out = resolveLiveOrDie(s.game, [
			{ seatId: chef, lives: true },
			{ seatId: empath, lives: true },
			{ seatId: monk, lives: true }
		]);
		expect(out.allDie).toBe(true);
		expect(out.results.every((r) => r.dead && r.died)).toBe(true);
	});

	it('counts a player who chose death but survived as alive', () => {
		const out = resolveLiveOrDie(s.game, [
			{ seatId: chef, lives: false, survives: true },
			{ seatId: empath, lives: true },
			{ seatId: monk, lives: true }
		]);
		expect(out.allDie).toBe(true);
		expect(out.results.map((r) => r.dead)).toEqual([false, true, true]);
	});

	it('brings back a dead player who chooses life, and leaves one who chooses death dead', () => {
		const dead = s.dies('chef', 'alhadikhia').dies('empath', 'alhadikhia');
		const out = resolveLiveOrDie(dead.game, [
			{ seatId: chef, lives: true },
			{ seatId: empath, lives: false },
			{ seatId: monk, lives: true }
		]);
		expect(out.allDie).toBe(false);
		expect(out.results.map((r) => [r.dead, r.died, r.revived])).toEqual([
			[false, false, true],
			[true, false, false],
			[false, false, false]
		]);
	});

	it('chooses nobody: nobody dies', () => {
		expect(resolveLiveOrDie(s.game, [])).toEqual({ allDie: false, results: [] });
	});
});
