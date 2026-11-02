/**
 * Fang Gu: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Fang_Gu
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Fang Gu.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { gameEnds, starPass } from '#lib/core/rules/game-end.ts';
import { filledInfoToken } from '#lib/core/rules/info-token-characters.ts';
import { nightKill } from '#lib/core/rules/night-kill.ts';
import { placeholdersFor } from '#lib/core/rules/night-text.ts';
import { reminderTargets } from '#lib/core/rules/reminder-targets.ts';
import { setupModifierFor } from '#lib/core/rules/setup-modifiers.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Fang Gu', () => {
	const character = committedCharacter('fanggu');

	describe('data (roles.json)', () => {
		it('is a Demon from edition snv', () => {
			expect(character.name).toBe('Fang Gu');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead', 'Once']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('fanggu')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Fang_Gu#Examples)', () => {
		it('Example 1: Fang Gu kills an Outsider and jumps, kills again', () => {
			// Wiki: "The Fang Gu attacks the Artist, who dies. The next night, the Fang Gu attacks the
			// Sweetheart, who becomes the Fang Gu while the old Fang Gu dies. The Sweetheart does not
			// make a player drunk, because they did not die. The next night, the new Fang Gu attacks
			// the Klutz, who dies."
			const first = scenario(['fanggu', 'artist', 'sweetheart', 'klutz', 'chef', 'witch'])
				.dies('artist', 'fanggu')
				.newDay();
			expect(gameEnds(first.game, first.characters)).toEqual([]);
			// The old Fang Gu dies by its own kill and spends its one jump.
			const jumping = first.reminder('fanggu', 'fanggu', 'Once').dies('fanggu', 'fanggu');
			expect(starPass(jumping.game, jumping.characters)).toEqual({
				characterId: 'fanggu',
				heirs: [jumping.seat('sweetheart'), jumping.seat('klutz')]
			});
			const jumped = jumping.becomes('sweetheart', 'fanggu', 'evil').newDay();
			expect(jumped.game.seats[jumped.seat('sweetheart')]).toMatchObject({
				characterId: 'fanggu',
				alignment: 'evil',
				dead: false
			});
			expect(gameEnds(jumped.game, jumped.characters)).toEqual([]);
			// The new Fang Gu kills the Klutz; no second jump is offered.
			const third = jumped.dies('klutz', 'fanggu');
			expect(third.game.seats[third.seat('klutz')].dead).toBe(true);
			expect(starPass(third.game, third.characters)).toBeUndefined();
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Fang_Gu#How_to_Run)', () => {
		it('setup adds one Outsider in place of a Townsfolk', () => {
			// Wiki: "While setting up the game, before putting character tokens in the bag, add one extra
			// Outsider character token and remove one Townsfolk character token."
			expect(setupModifierFor(character)).toMatchObject({
				summary: '+1 Outsider',
				ops: [{ kind: 'delta', type: 'outsider', values: [1] }]
			});
		});

		it('chooses one player each night after the first, any player, and marks them Dead', () => {
			// Wiki: "Each night except the first, wake the Fang Gu. They point at any player. Put the Fang
			// Gu to sleep."
			expect(placeholdersFor(character, 'first')).toBeUndefined();
			const s = scenario(['fanggu', 'artist', 'sweetheart', 'klutz', 'chef', 'witch']).dies('chef');
			expect(nightKill(s.game, s.seat('fanggu'), 'fanggu', s.characters)?.max).toBe(1);
			const dead = { characterId: 'fanggu', label: 'Dead' };
			expect(reminderTargets(s.game, dead, s.characters).flatMap((t) => t.misses)).toEqual([]);
		});

		it('a player who is not an Outsider dies by the Fang Gu', () => {
			// Wiki: "If the chosen player is not an Outsider, that player dies—mark them with the DEAD
			// reminder."
			const s = scenario(['fanggu', 'artist', 'sweetheart', 'klutz', 'chef', 'witch'])
				.newDay()
				.dies('artist', 'fanggu');
			expect(s.game.seats[s.seat('artist')]).toMatchObject({ dead: true, deathCause: 'fanggu' });
			expect(starPass(s.game, s.characters)).toBeUndefined();
		});

		it('the Outsider who becomes the Fang Gu is shown You are, the Fang Gu', () => {
			// Wiki: "Show them the YOU ARE info token, then the Fang Gu token, then the YOU ARE info token,
			// then a thumbs-down."
			expect(filledInfoToken(character, 'you-are', 1)?.characterIds).toEqual(['fanggu']);
		});

		it('Once stays put after the jump, so a second Fang Gu death passes to nobody', () => {
			// Wiki: "Put the ONCE reminder in the center of the Grimoire. (Unlike “Once per game”
			// abilities, this reminder stays there for the rest of the game. Don’t remove it, even if the
			// Fang Gu dies or changes character.)"
			const jumped = scenario(['fanggu', 'artist', 'sweetheart', 'klutz', 'chef', 'witch'])
				.newDay()
				.reminder('fanggu', 'fanggu', 'Once')
				.dies('fanggu', 'fanggu')
				.becomes('sweetheart', 'fanggu', 'evil')
				.newDay()
				.dusk();
			expect(
				jumped.game.seats[jumped.seat('fanggu')].reminders.map((r) => [r.characterId, r.label])
			).toEqual([['fanggu', 'Once']]);
			const again = jumped.dies('sweetheart', 'fanggu');
			expect(starPass(again.game, again.characters)).toBeUndefined();
		});
	});
});
