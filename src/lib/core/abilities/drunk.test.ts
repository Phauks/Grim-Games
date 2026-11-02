/**
 * Drunk: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Drunk
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Drunk.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import {
	committedCharacter,
	committedGameData,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';
import { trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import { abilityState, protection } from '#lib/core/rules/ability.ts';
import { planBag } from '#lib/core/rules/bag-plan.ts';
import { nightOrder } from '#lib/core/rules/night-order.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { setupReminders } from '#lib/core/rules/setup-reminders.ts';
import {
	infoPicker,
	isAllowed,
	isTruthful,
	nightAnswer,
	withNightInfo
} from '#lib/core/rules/night-info.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Drunk', () => {
	const character = committedCharacter('drunk');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition tb', () => {
			expect(character.name).toBe('Drunk');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual(['Is The Drunk']);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('drunk')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([
				{ type: 'selection', name: 'bag-disabled' },
				{ type: 'reveal', name: 'replace-character' }
			]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Drunk#Examples)', () => {
		it("Example 1: Drunk who thinks they're Soldier dies to Imp", () => {
			// Wiki: "The Drunk, who thinks they are the Soldier, is attacked by the Imp. The Drunk dies."
			const s = scenario(['soldier', 'chef', 'imp', 'monk', 'poisoner']).drunk('soldier');
			expect(protection(s.game, s.seat('soldier'), s.characters, 'demon')).toBeUndefined();
		});
		it('Example 2: Drunk Empath gets false numbers two nights', () => {
			// Wiki: "The Drunk, who thinks they are the Empath, wakes and learns a "0,” even though they
			// are sitting next to one evil player. The next night, they learn a "1."."
			// Beside one evil player, the Drunk "Empath" may be told 0, and 1 the next night: any
			// number is allowed, the true one is still worked out.
			const s = scenario(['empath', 'imp', 'chef', 'monk', 'saint']).drunk('empath');
			const picker = infoPicker(s.game, s.seat('empath'), 'empath', s.characters)!;
			expect(picker).toMatchObject({ unreliable: 'drunk', anyAllowed: true, range: { truth: 1 } });
			expect(isAllowed(picker, { seats: [], number: 0 })).toBe(true);
			const next = s.newDay();
			const later = infoPicker(next.game, next.seat('empath'), 'empath', next.characters)!;
			expect(isAllowed(later, { seats: [], number: 1 })).toBe(true);
		});
		it('Example 3: Drunk Ravenkeeper picks Saint, is shown Poisoner', () => {
			// Wiki: "The Drunk, who thinks they are the Ravenkeeper, is killed at night. They choose the
			// Saint, but learn that this player is the Poisoner."
			const s = scenario(['ravenkeeper', 'saint', 'imp', 'poisoner', 'chef'])
				.drunk('ravenkeeper')
				.dies('ravenkeeper', 'imp');
			const picker = infoPicker(s.game, s.seat('ravenkeeper'), 'ravenkeeper', s.characters)!;
			const shown = { seats: [s.seat('saint')], characterId: 'poisoner' };
			expect(isAllowed(picker, shown)).toBe(true);
			expect(isTruthful(picker, shown)).toBe(false);
		});
		it('Example 4: Drunk Undertaker learns the Drunk was executed', () => {
			// Wiki: "The Fortune Teller is executed. That night, the Drunk, who thinks they are
			// Undertaker, learns that the Drunk died today."
			// The Fortune Teller was executed; the Drunk "Undertaker" may be told anything.
			const s = scenario(['undertaker', 'fortuneteller', 'imp', 'monk', 'poisoner'])
				.drunk('undertaker')
				.execute('fortuneteller');
			expect(nightAnswer(s.game, s.seat('undertaker'), 'undertaker', s.characters)).toMatchObject({
				kind: 'character',
				value: 'fortuneteller',
				unreliable: 'drunk'
			});
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Drunk#How_to_Run)', () => {
		it('keeps the Drunk token out of the bag and holds back its Is The Drunk reminder', () => {
			// How to Run: at setup the Drunk token never goes in the bag; a Townsfolk token goes in
			// instead, and the Is The Drunk reminder waits in the Grimoire.
			const data = committedGameData();
			const ids = ['chef', 'empath', 'monk', 'drunk', 'poisoner', 'imp'];
			const result = planBag({
				selection: Object.fromEntries(ids.map((id) => [id, 1])),
				scriptCharacters: ids.map((id) => data.byId.get(id)!),
				lookup: (id) => data.byId.get(id)
			});
			expect(result.tiles.map((t) => t.grimoire)).not.toContain('drunk');
			expect(result.unseated).toEqual([{ characterId: 'drunk', label: 'Is The Drunk' }]);
		});

		it('puts Is The Drunk on the Drunk first, beside a Townsfolk token only', () => {
			// How to Run: before the first night, the Is The Drunk reminder goes by a Townsfolk
			// token, and that player is really the Drunk.
			const s = scenario(['washerwoman', 'chef', 'drunk', 'imp', 'saint']);
			expect(setupReminders(s.game, s.characters)[0]).toMatchObject({
				label: 'Is The Drunk',
				seatId: s.seat('drunk'),
				first: true
			});
			const token = { characterId: 'drunk', label: 'Is The Drunk' };
			expect(reminderTargetMisses(s.game, token, s.seat('chef'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, token, s.seat('saint'), s.characters)).toEqual(['type']);
		});

		it('makes that player an Outsider without the Townsfolk ability they were shown', () => {
			// How to Run: the marked player is the Drunk, an Outsider, and has no Townsfolk ability
			// though they believe they do.
			const s = scenario(['chef', 'empath', 'imp', 'monk', 'poisoner']).drunk('chef');
			expect(trueCharacter(s.game, s.seat('chef'), s.characters)).toBe('drunk');
			expect(typeOf(s.game, s.seat('chef'), s.characters)).toBe('outsider');
			const state = abilityState(s.game, s.seat('chef'), s.characters);
			expect(state.works).toBe(false);
			expect(state.impairments.map((i) => i.reason)).toEqual(['drunk']);
		});

		it("wakes the Drunk at the shown Townsfolk's night step, flagged as drunk", () => {
			// How to Run: run the Drunk as the Townsfolk they think they are, waking them when that
			// character would wake; their information may be false.
			const s = scenario(['washerwoman', 'empath', 'imp', 'monk', 'poisoner']).drunk('washerwoman');
			const data = committedGameData();
			const inPlay = s.game.seating.map((id) => s.characters.get(s.game.seats[id].characterId!)!);
			const steps = withNightInfo(
				nightOrder({ night: 'first', sheet: data.nightSheet, inPlay, players: 5 }).steps,
				s.game,
				s.characters,
				'first',
				{ died: [] },
				data.nightSheet.firstNight
			);
			const step = steps.find((step) => step.id === 'washerwoman');
			expect(step?.impaired?.map((a) => a.seatId)).toEqual([s.seat('washerwoman')]);
			expect(step?.info).toMatchObject({ pickers: [{ unreliable: 'drunk' }] });
		});
	});
});
