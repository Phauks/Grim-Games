/**
 * Hatter: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Hatter
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Hatter.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { decide, type Command } from '#lib/core/engine/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { rulesIn } from '#lib/core/data/rules/index.ts';
import { typeOf } from '#lib/core/model/selectors.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { changeableSeats, characterChanger } from '#lib/core/rules/becomes.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { filledInfoToken } from '#lib/core/rules/info-token-characters.ts';
import { remindersEndingAt } from '#lib/core/rules/reminder-ends.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';

describe('Hatter', () => {
	const character = committedCharacter('hatter');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition carousel', () => {
			expect(character.name).toBe('Hatter');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Tea Party Tonight']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('hatter')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Hatter#Examples)', () => {
		it("Example 1: Ojo and Devil's Advocate change characters", () => {
			// Wiki: "The Hatter dies. The Ojo chooses to become the No Dashii and the Devil's Advocate
			// chooses to become the Scarlet Woman."
			const s = scenario([
				'hatter',
				'ojo',
				'devilsadvocate',
				'chef',
				'empath',
				'monk',
				'mayor'
			]).dies('hatter', 'execution');
			expect(characterChanger(s.game, 'hatter', s.characters)).toBe(s.seat('hatter'));
			expect(changeableSeats(s.game, 'hatter', s.characters)).toEqual([
				s.seat('ojo'),
				s.seat('devilsadvocate')
			]);
			const after = s.becomes('ojo', 'nodashii').becomes('devilsadvocate', 'scarletwoman');
			expect(typeOf(after.game, after.seat('ojo'), after.characters)).toBe('demon');
			expect(typeOf(after.game, after.seat('devilsadvocate'), after.characters)).toBe('minion');
		});
		// A dead Minion loses the Vigormortis's Has Ability once the Vigormortis becomes another
		// Demon (M15g).
		it('Example 2: Both evils refuse changes to keep Vigormortis', () => {
			// Wiki: "The Vigormortis has killed their Pit-Hag, then later kills the Hatter. Both players
			// choose to stay the same characters, so that they don't lose the effects of the
			// Vigormortis."
			const s = scenario(['hatter', 'pithag', 'vigormortis', 'chef', 'empath', 'monk', 'mayor'])
				.dies('pithag', 'vigormortis')
				.reminder('pithag', 'vigormortis', 'Has Ability')
				.dies('hatter', 'vigormortis');
			expect(changeableSeats(s.game, 'hatter', s.characters)).toEqual([
				s.seat('pithag'),
				s.seat('vigormortis')
			]);
			expect(abilityState(s.game, s.seat('pithag'), s.characters).works).toBe(true);
			// Had the Vigormortis become another Demon, the dead Pit-Hag would lose its ability.
			const changed = s.becomes('vigormortis', 'nodashii');
			expect(abilityState(changed.game, changed.seat('pithag'), changed.characters).works).toBe(
				false
			);
		});
		it('Example 3: Assassin becomes Mastermind, Mastermind picks Assassin', () => {
			// Wiki: "The Assassin kills a player. The Hatter is executed. That night, the Assassin
			// becomes the Mastermind and the Mastermind shakes their head no to stay the Mastermind. The
			// Storyteller shakes their head no because the Mastermind character has been chosen already,
			// and gestures for the Mastermind player to choose again, so they choose Assassin. The new
			// Assassin then uses their new ability to kill a player."
			const s = scenario(['hatter', 'assassin', 'mastermind', 'imp', 'chef', 'empath', 'monk'])
				.dies('chef', 'assassin')
				.reminder('assassin', 'assassin', 'No Ability')
				.execute('hatter');
			expect(changeableSeats(s.game, 'hatter', s.characters)).toContain(s.seat('mastermind'));
			const party = s.becomes('assassin', 'mastermind');
			// Staying the Mastermind is refused (warned): another player chose it tonight.
			const stay = decide(
				party.game,
				{ type: 'AssignCharacter', seatId: s.seat('mastermind'), characterId: 'mastermind' },
				party.ctx
			);
			expect(stay.ok && stay.warnings.map((w) => w.code)).toContain('already-in-play');
			const after = party.becomes('mastermind', 'assassin');
			const newAssassin = s.seat('mastermind');
			expect(after.game.seats[newAssassin]).toMatchObject({ characterId: 'assassin' });
			expect(abilityState(after.game, newAssassin, after.characters).works).toBe(true);
			// The old Assassin's No Ability is not on the new Assassin: its ability is unused.
			expect(
				after.game.seats[newAssassin].reminders.some(
					(r) => r.characterId === 'assassin' && r.label === 'No Ability'
				)
			).toBe(false);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Hatter#How_to_Run)', () => {
		const cast = ['hatter', 'chef', 'empath', 'monk', 'poisoner', 'imp'];

		it('puts Tea Party Tonight only on the Hatter', () => {
			// Wiki: "If the Hatter dies, mark them with the TEA PARTY TONIGHT reminder."
			const s = scenario(cast).dies('hatter', 'imp');
			const party = { characterId: 'hatter', label: 'Tea Party Tonight' };
			expect(reminderTargetMisses(s.game, party, s.seat('hatter'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, party, s.seat('chef'), s.characters)).toEqual([
				'not-self'
			]);
		});

		it.fails('holds a tea party only once the Hatter has died', () => {
			// Wiki: "If the Hatter dies, mark them with the TEA PARTY TONIGHT reminder. During that
			// night, wake the Minions and Demon."
			// Waits on the engine (unplanned): characterChanger offers the Hatter's change while the Hatter is alive, as nothing ties it to their death or the Tea Party Tonight reminder.
			const s = scenario(cast);
			expect(characterChanger(s.game, 'hatter', s.characters)).toBeUndefined();
			const party = s.dies('hatter', 'imp').reminder('hatter', 'hatter', 'Tea Party Tonight');
			expect(characterChanger(party.game, 'hatter', party.characters)).toBe(party.seat('hatter'));
		});

		it.fails('shows the Minions and Demon the Hatter token on This character selected you', () => {
			// Wiki: "Show them the THIS CHARACTER SELECTED YOU info token, then the Hatter token."
			// Waits on the engine (unplanned): the Hatter's rules fill only the You are token, not This character selected you.
			expect(filledInfoToken(character, 'selected-you', 1)).toMatchObject({
				characterIds: ['hatter']
			});
		});

		it('lets each Minion and the Demon change to a character of their own type', () => {
			// Wiki: "Each player either shakes their head no or points to another character of the same
			// type as their current character."
			const s = scenario(cast).dies('hatter', 'imp');
			expect(changeableSeats(s.game, 'hatter', s.characters)).toEqual([
				s.seat('poisoner'),
				s.seat('imp')
			]);
			const after = s.becomes('poisoner', 'spy').becomes('imp', 'nodashii');
			expect(typeOf(after.game, after.seat('poisoner'), after.characters)).toBe('minion');
			expect(typeOf(after.game, after.seat('imp'), after.characters)).toBe('demon');
		});

		it('takes Tea Party Tonight off by the next day', () => {
			// Wiki: "Put them to sleep. Remove the TEA PARTY TONIGHT reminder. Change each player to the
			// character they chose."
			const s = scenario(cast)
				.dies('hatter', 'imp')
				.reminder('hatter', 'hatter', 'Tea Party Tonight');
			expect(remindersEndingAt(s.game, 'dawn', s.characters)).toHaveLength(1);
		});
	});
});

// The optional rule on the wiki page (https://wiki.bloodontheclocktower.com/Hatter): when
// the Hatter dies, the Demon may become a Minion and a Minion the Demon.
describe('Hatter optional rule', () => {
	const cast = ['hatter', 'chef', 'empath', 'monk', 'poisoner', 'imp'];
	const on: Command = { type: 'SetOptionalRule', characterId: 'hatter', on: true };

	it('off, each Minion and the Demon picks from their own type', () => {
		const { game } = castGame(cast);
		const rule = rulesIn(game, 'hatter', characters)?.changesCharacter;
		expect(rule).toMatchObject({ types: ['minion', 'demon'], sameType: true });
		expect(rule?.anyType).toBeUndefined();
	});

	it('on, they may pick a Minion or a Demon', () => {
		const { game } = castGame(cast, on);
		expect(rulesIn(game, 'hatter', characters)?.changesCharacter).toMatchObject({
			sameType: true,
			anyType: true
		});
	});
});
