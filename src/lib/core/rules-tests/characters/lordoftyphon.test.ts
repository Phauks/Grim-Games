/**
 * Lord of Typhon: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Lord_of_Typhon
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Lord of Typhon.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { castGame } from '#lib/core/model/fixtures.test-support.ts';
import { evilInOneLine, nightStepAlerts } from '#lib/core/rules/night/night-alerts.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { changeableSeats, characterChanger } from '#lib/core/rules/abilities/becomes.ts';
import {
	committedCharacter,
	committedGameData,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';
import { analyseSetup } from '#lib/core/rules/setup/setup.ts';
import { decide } from '#lib/core/engine/index.ts';
import { filledInfoToken } from '#lib/core/rules/night/info-token-characters.ts';
import { nightKill } from '#lib/core/rules/night/night-kill.ts';
import { nightOrder } from '#lib/core/rules/night/night-order.ts';
import {
	nightTextPlain,
	nightTextSegments,
	placeholdersFor
} from '#lib/core/rules/night/night-text.ts';
import { setupPrep } from '#lib/core/rules/setup/setup-reminders.ts';

const data = committedGameData();
const get = (...ids: string[]) => ids.map((id) => data.byId.get(id)!);

/** The Lord of Typhon's seating alerts, by seat number. */
const seating = (cast: string[]) => {
	const s = scenario(cast);
	return nightStepAlerts(s.game, 'lordoftyphon', s.characters)
		.filter((a) => a.kind === 'seating')
		.map((a) => s.seats.indexOf(a.seatId) + 1);
};

describe('Lord of Typhon', () => {
	const character = committedCharacter('lordoftyphon');

	describe('data (roles.json)', () => {
		it('is a Demon from edition carousel', () => {
			expect(character.name).toBe('Lord of Typhon');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('lordoftyphon')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	// The ability: the evil players sit in one line, the Lord of Typhon inside it with a Minion on
	// each side. The app warns on its night step when they don't; it never moves anyone.
	describe('seating', () => {
		it('warns when the Lord of Typhon sits at the end of the evil line', () => {
			expect(seating(['lordoftyphon', 'poisoner', 'spy', 'empath', 'monk'])).toEqual([1]);
		});

		it('warns when an evil player sits apart from the line', () => {
			expect(
				seating(['poisoner', 'lordoftyphon', 'spy', 'empath', 'monk', 'baron', 'chef'])
			).toEqual([2]);
		});

		it('does not warn while its first night still makes the Minions', () => {
			expect(seating(['lordoftyphon', 'chef', 'empath', 'monk', 'saint'])).toEqual([]);
		});

		it('counts the line round the table', () => {
			const { game, seats, ctx } = castGame(['lordoftyphon', 'spy', 'empath', 'monk', 'poisoner']);
			expect(evilInOneLine(game, seats[0], ctx.characters)).toBe(true);
		});

		// Evil Townsfolk may be part of the line but need not be (M22): the Bounty Hunter's
		// evil Townsfolk sitting apart is no warning.
		it('does not need an evil Townsfolk in the line', () => {
			const s = scenario(['poisoner', 'lordoftyphon', 'spy', 'empath', 'bountyhunter', 'chef']).do(
				(at) => ({ type: 'SetAlignment', seatId: at.seat('chef'), alignment: 'evil' })
			);
			expect(evilInOneLine(s.game, s.seat('lordoftyphon'), s.characters)).toBe(true);
		});
	});

	// The players either side become Minions, the usual number plus one, spreading out from the
	// Lord of Typhon (M22).
	// Wiki (How to Run): "During the first night, wake the appropriate number of players directly
	// clockwise and anti-clockwise from the Lord of Typhon."
	describe('first night Minions', () => {
		it('offers only the nearest non-Minion on each side, until there is one Minion extra', () => {
			let s = scenario(['lordoftyphon', 'chef', 'empath', 'monk', 'saint', 'butler', 'mayor']);
			expect(changeableSeats(s.game, 'lordoftyphon', s.characters).sort()).toEqual(
				[s.seat('chef'), s.seat('mayor')].sort()
			);
			expect(characterChanger(s.game, 'lordoftyphon', s.characters)).toBe(s.seat('lordoftyphon'));
			// Seven players usually have one Minion: two become Minions here.
			s = s.becomes('chef', 'poisoner', 'evil');
			expect(changeableSeats(s.game, 'lordoftyphon', s.characters).sort()).toEqual(
				[s.seat('empath'), s.seat('mayor')].sort()
			);
			s = s.becomes('mayor', 'spy', 'evil');
			expect(characterChanger(s.game, 'lordoftyphon', s.characters)).toBeUndefined();
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Lord_of_Typhon#Examples)', () => {
		// Two Minions sit either side of the Lord of Typhon: nothing to warn about.
		it('Example 1: two Minions flank the Lord of Typhon', () => {
			// Wiki: "There are two Minions: the Organ Grinder and the Mezepheles. In between them,
			// neighboring them both, sits the Lord of Typhon. The number of Outsiders is normal."
			expect(seating(['empath', 'poisoner', 'lordoftyphon', 'spy', 'monk'])).toEqual([]);
		});
		it('Example 2: Ten players include two extra Outsiders', () => {
			// Wiki: "The Vizier neighbors the Harpy, who neighbors the Lord of Typhon, who neighbors the
			// Goblin. There are ten players, and two Outsiders in play, due to the Lord of Typhon
			// ability."
			const cast = ['vizier', 'harpy', 'lordoftyphon', 'goblin', 'chef', 'empath', 'monk', 'mayor'];
			expect(seating([...cast, 'saint', 'butler'])).toEqual([]);
			const result = analyseSetup({ players: 10, inPlay: get(...cast, 'saint', 'butler') });
			// No Minions dealt, or the usual two plus one already seated (M22).
			expect(result.expected.minion).toEqual([0, 3]);
			expect(result.expected.outsider).toContain(2);
			expect(result.chosen).toEqual({ townsfolk: 4, outsider: 2, minion: 3, demon: 1 });
			expect(result.warnings).toEqual([]);
		});
		it('Example 3: Puzzlemaster becomes Boomdandy, no Outsiders', () => {
			// Wiki: "The Fearmonger neighbors the Boomdandy, who neighbors the Lord of Typhon, who
			// neighbors the Poisoner, who neighbors the Mastermind. There are 15 players, but zero
			// Outsiders in play, since the Lord of Typhon removed one Outsider, and the Puzzlemaster
			// became the Boomdandy during the first night."
			// The Puzzlemaster, dealt beside the Lord of Typhon, turns into a Minion: the line is whole.
			const good = ['chef', 'empath', 'monk', 'mayor', 'washerwoman', 'librarian', 'investigator'];
			const evil = ['fearmonger', 'puzzlemaster', 'lordoftyphon', 'poisoner', 'mastermind'];
			const s = scenario([...evil, ...good]);
			expect(s.characters.get('puzzlemaster')?.type).toBe('outsider');
			const after = s.becomes('puzzlemaster', 'boomdandy', 'evil');
			expect(
				nightStepAlerts(after.game, 'lordoftyphon', after.characters).filter(
					(a) => a.kind === 'seating'
				)
			).toEqual([]);
			const townsfolk = [...good, 'fortuneteller', 'undertaker', 'soldier'];
			const inPlay = get(
				...townsfolk,
				'fearmonger',
				'boomdandy',
				'lordoftyphon',
				'poisoner',
				'mastermind'
			);
			const result = analyseSetup({ players: 15, inPlay });
			expect(result.expected.minion).toEqual([0, 4]);
			expect(result.expected.outsider).toContain(0);
			expect(result.chosen).toEqual({ townsfolk: 10, outsider: 0, minion: 4, demon: 1 });
			expect(result.warnings).toEqual([]);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Lord_of_Typhon#How_to_Run)', () => {
		const cast = ['lordoftyphon', 'chef', 'empath', 'monk', 'saint', 'butler', 'mayor'];

		it('deals no Minions and lets the Outsider count change', () => {
			// Wiki: "During setup, remove all Minion tokens and add Townsfolk or Outsider tokens."
			expect(setupPrep('lordoftyphon', character.name, data.byId)).toMatchObject([
				{ text: expect.stringContaining('Deal no Minions') }
			]);
			const result = analyseSetup({ players: 7, inPlay: get(...cast) });
			expect(result.expected.minion).toContain(0);
			expect(result.expected.outsider).toEqual(expect.arrayContaining([0, 1, 2]));
			expect(result.warnings).toEqual([]);
		});

		it('shows each new Minion a different Minion token', () => {
			// Wiki: "Show each of these players a unique Minion token, and give a thumbs down. Replace
			// these players' good character tokens with these Minion tokens and put these players to
			// sleep."
			const s = scenario(cast).becomes('chef', 'poisoner', 'evil');
			const same = decide(
				s.game,
				{ type: 'AssignCharacter', seatId: s.seat('mayor'), characterId: 'poisoner' },
				s.ctx
			);
			expect(same.ok && same.warnings.map((w) => w.code)).toContain('already-in-play');
			expect(filledInfoToken(character, 'you-are', 1)).toBeDefined();
		});

		it('keeps the Minion Info and Demon Info steps after it on the first night', () => {
			// Wiki: "Then, do the Minion Info and Demon Info steps as normal."
			const { steps } = nightOrder({
				night: 'first',
				sheet: data.nightSheet,
				official: data.byId,
				inPlay: get(...cast),
				players: 7
			});
			const ids = steps.map((step) => step.id);
			expect(ids).toContain('minioninfo');
			expect(ids.indexOf('lordoftyphon')).toBeLessThan(ids.indexOf('minioninfo'));
			expect(ids.indexOf('lordoftyphon')).toBeLessThan(ids.indexOf('demoninfo'));
		});

		it('kills the chosen player on each night after the first', () => {
			// Wiki: "Each night except the first, wake the Lord of Typhon. They point at any player.
			// That player dies—mark them with the DEAD reminder. Put the Lord of Typhon to sleep."
			const placeholders = placeholdersFor(character, 'other');
			const text = nightTextPlain(
				nightTextSegments(character.otherNightReminder!, character, {
					...(placeholders ? { placeholders } : {})
				})
			);
			expect(text).toContain('[+Dead]');
			const s = scenario(cast).newDay().dusk();
			expect(nightKill(s.game, s.seat('lordoftyphon'), 'lordoftyphon', s.characters)).toEqual({
				max: 1,
				delayed: []
			});
		});
	});
});
