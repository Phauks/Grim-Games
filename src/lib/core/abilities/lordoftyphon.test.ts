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
import { evilInOneLine, nightStepAlerts } from '#lib/core/rules/night-alerts.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import {
	committedCharacter,
	committedGameData,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';
import { analyseSetup } from '#lib/core/rules/setup.ts';

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

	// How to Run: the evil players sit in one line, the Lord of Typhon inside it with a Minion on
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

		it('counts the line round the table', () => {
			const { game, seats } = castGame(['lordoftyphon', 'spy', 'empath', 'monk', 'poisoner']);
			expect(evilInOneLine(game, seats[0])).toBe(true);
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
			expect(result.expected.minion).toEqual([3]);
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
			expect(result.expected.minion).toEqual([4]);
			expect(result.expected.outsider).toContain(0);
			expect(result.chosen).toEqual({ townsfolk: 10, outsider: 0, minion: 4, demon: 1 });
			expect(result.warnings).toEqual([]);
		});
	});
});
