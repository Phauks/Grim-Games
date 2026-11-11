/**
 * Borrowed abilities bring their reminder tokens (plan M50, Trevor 2026-11-04: "if a character
 * also has the ability of a character, we need to make sure we have the reminder tokens to
 * facilitate that ability"). Every way a player, or the Storyteller, has another character's
 * ability lists that character, so its reminders are in the bank and placing one never warns
 * that the character isn't in play.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Boffin,
 * https://wiki.bloodontheclocktower.com/Hermit,
 * https://wiki.bloodontheclocktower.com/Philosopher,
 * https://wiki.bloodontheclocktower.com/Plague_Doctor
 */
import { describe, expect, it } from 'vitest';
import type { Script } from '#lib/core/data/index.ts';
import type { Command } from '#lib/core/engine/index.ts';
import { warned } from '#lib/core/model/fixtures.test-support.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { borrowedAbilities, borrowedAbilitiesOf } from './borrowed-abilities.ts';

/** Placing `label` of `characterId` on `on`: the warnings it raises. */
const placing = (s: Scenario, on: string, characterId: string, label: string) =>
	warned(s.session, s.ctx, {
		type: 'AddReminder',
		seatId: s.seat(on),
		reminder: { characterId, label }
	} as Command);

describe('borrowedAbilities', () => {
	it("lists the Virgin a Boffin's Demon holds, so its No Ability reminder needs no warning", () => {
		// Wiki: "The Imp has the Virgin ability. The Alsaahir nominates the Imp, and is immediately
		// executed."
		const before = scenario(['boffin', 'imp', 'alsaahir', 'chef', 'empath']);
		expect(borrowedAbilities(before.game, before.characters).has('virgin')).toBe(false);
		expect(placing(before, 'imp', 'virgin', 'No Ability')).toEqual([
			'reminder-character-not-in-play'
		]);
		const s = before.do((s) => ({
			type: 'SetHeldAbility',
			seatId: s.seat('imp'),
			via: 'boffin',
			characterId: 'virgin'
		}));
		expect(borrowedAbilities(s.game, s.characters).get('virgin')).toBe(true);
		expect(placing(s, 'imp', 'virgin', 'No Ability')).toEqual([]);
	});

	it('lists the Monk a Philosopher gained, living or dead', () => {
		// Wiki: "During the first night, the Philosopher chooses to gain the Dreamer's ability. They
		// gain the Dreamer's ability from now on and act when the Dreamer normally acts."
		// The same with the Monk, whose Safe reminder the Philosopher's choice needs.
		const s = scenario(['philosopher', 'chef', 'empath', 'witch', 'nodashii']).do((s) => ({
			type: 'GiveAbility',
			seatId: s.seat('philosopher'),
			ability: { characterId: 'monk', via: 'philosopher' }
		}));
		expect(borrowedAbilities(s.game, s.characters).get('monk')).toBe(true);
		expect(placing(s, 'chef', 'monk', 'Safe')).toEqual([]);
		// Dead, the holder's reminders stay to hand but no longer count as a living holder's.
		const dead = s.dies('philosopher');
		expect(borrowedAbilities(dead.game, dead.characters).get('monk')).toBe(false);
	});

	it('lists a Minion ability the Storyteller gained from the Plague Doctor', () => {
		// Wiki: "The Plague Doctor dies. The Storyteller gains the Poisoner ability and chooses a
		// player to poison each night for the rest of the game."
		const s = scenario(['plaguedoctor', 'imp', 'monk', 'empath', 'chef'])
			.dies('plaguedoctor', 'execution')
			.do({ type: 'SetStorytellerAbility', via: 'plaguedoctor', characterId: 'poisoner' });
		expect(borrowedAbilities(s.game, s.characters).get('poisoner')).toBe(true);
		expect(placing(s, 'monk', 'poisoner', 'Poisoned')).toEqual([]);
	});

	it("never lists a seat's own character", () => {
		const s = scenario(['monk', 'imp', 'chef', 'empath', 'poisoner']);
		expect(borrowedAbilities(s.game, s.characters).size).toBe(0);
	});
});

describe('borrowedAbilitiesOf', () => {
	it("lists the Hermit's Outsider abilities, never the Hermit's own", () => {
		// Wiki: "Marianna is the Hermit, and has the Klutz, Butler, and Recluse abilities. Each night,
		// she chooses a player as her master due to the Butler ability. The Ravenkeeper dies and
		// learns that she is the Lord of Typhon, due to the Recluse ability. Marianna is executed,
		// and chooses a player due to the Klutz ability. She chooses the Wizard. Good loses."
		const script: Script = {
			entries: ['hermit', 'klutz', 'butler', 'recluse', 'ravenkeeper', 'imp', 'empath', 'monk'].map(
				(id) => ({ kind: 'official', id })
			)
		};
		const s = scenario(['hermit', 'ravenkeeper', 'imp', 'empath', 'monk'], { script });
		const ids = borrowedAbilitiesOf(s.game, s.seat('hermit'), s.characters).map(
			(a) => a.characterId
		);
		expect(ids.sort()).toEqual(['butler', 'klutz', 'recluse']);
	});

	it('lists an ability given by hand, and nothing for a player with none', () => {
		const s = scenario(['chef', 'imp', 'empath', 'poisoner', 'saint']);
		expect(borrowedAbilitiesOf(s.game, s.seat('chef'), s.characters)).toEqual([]);
		const given = s.do((x) => ({
			type: 'GiveAbility',
			seatId: x.seat('chef'),
			ability: { characterId: 'monk' }
		}));
		expect(borrowedAbilitiesOf(given.game, s.seat('chef'), s.characters)).toEqual([
			{ characterId: 'monk', works: true }
		]);
	});
});
