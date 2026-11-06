/**
 * The `learns` building blocks (M60): a custom character that writes its information as a
 * count, players shown or a yes/no gets the same picker as the official character it copies,
 * and can ask what no official character does. Rules sources:
 * - https://wiki.bloodontheclocktower.com/Empath (evil among the alive neighbours)
 * - https://wiki.bloodontheclocktower.com/Chef (pairs of evil neighbours)
 * - https://wiki.bloodontheclocktower.com/Noble (three players, exactly one evil)
 * - https://wiki.bloodontheclocktower.com/Fortune_Teller (yes if either is the Demon or the
 *   red herring)
 */
import { describe, expect, it } from 'vitest';
import { parseCharacter } from '#lib/core/data/parse.ts';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import type { Character } from '#lib/core/data/types.ts';
import { castWith, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { infoPicker } from '../night-info.ts';

function custom(learns: Record<string, unknown>, reminders: string[] = []): Character {
	const issues = new Issues();
	const c = parseCharacter(
		{
			id: 'lamplighter',
			name: 'Lamplighter',
			team: 'townsfolk',
			ability: 'x',
			reminders,
			rules: { learns }
		},
		'[0]',
		issues,
		{ strict: false, scriptFields: true }
	)!;
	expect(issues.list).toEqual([]);
	return c;
}

/** The picker of `official` in seat 0, and of a custom character with `learns` there. */
function both(official: string, learns: Record<string, unknown>, cast: string[]) {
	const lamp = custom(learns);
	const all = new Map([...characters, [lamp.id, lamp]]);
	const { game, seats } = castWith({ characters: all })([official, ...cast]);
	const theirs = infoPicker(game, seats[0], official, all)!;
	const seated = { ...game, seats: { ...game.seats } };
	seated.seats[seats[0]] = { ...game.seats[seats[0]], characterId: lamp.id };
	const mine = infoPicker(seated, seats[0], lamp.id, all)!;
	return { theirs, mine, seats };
}

const same = (a: ReturnType<typeof infoPicker>, b: ReturnType<typeof infoPicker>) => {
	expect(b?.kind).toBe(a?.kind);
	expect(b?.seatCount).toBe(a?.seatCount);
	expect(b?.options).toEqual(a?.options);
	expect(b?.range).toEqual(a?.range);
};

describe('learns building blocks', () => {
	it('a count of the alive neighbours who are evil is the Empath', () => {
		const { theirs, mine } = both(
			'empath',
			{ measure: 'count', scope: 'alive-neighbours', alignment: 'evil' },
			['imp', 'chef', 'poisoner', 'butler']
		);
		same(theirs, mine);
		// Its neighbours are the Imp and the Butler.
		expect(mine.options).toEqual([{ seats: [], number: 1 }]);
	});

	it('a count of neighbour pairs who are both evil is the Chef', () => {
		const { theirs, mine } = both(
			'chef',
			{ measure: 'count', scope: 'neighbour-pairs', alignment: 'evil' },
			['imp', 'poisoner', 'empath', 'butler']
		);
		same(theirs, mine);
		expect(mine.options).toEqual([{ seats: [], number: 1 }]);
	});

	it('three players shown, exactly one evil, is the Noble', () => {
		const { theirs, mine } = both(
			'noble',
			{ measure: 'players', choose: 3, matching: 1, alignment: 'evil' },
			['imp', 'chef', 'empath', 'butler']
		);
		same(theirs, mine);
	});

	it('counts what no official character does: the Outsiders among the alive neighbours', () => {
		const lamp = custom({ measure: 'count', scope: 'alive-neighbours', types: ['outsider'] });
		const all = new Map([...characters, [lamp.id, lamp]]);
		const { game, seats } = castWith({ characters: all })([
			lamp.id,
			'butler',
			'chef',
			'imp',
			'saint'
		]);
		const picker = infoPicker(game, seats[0], lamp.id, all)!;
		expect(picker).toMatchObject({ kind: 'number', measure: 'count', highest: 2 });
		expect(picker.options).toEqual([{ seats: [], number: 2 }]);
	});

	it('a yes if either chosen player is the Demon or carries its token is the Fortune Teller', () => {
		const lamp = custom({ measure: 'any-of', choose: 2, self: true, types: ['demon'] });
		const all = new Map([...characters, [lamp.id, lamp]]);
		const { game, seats } = castWith({ characters: all })([lamp.id, 'imp', 'chef', 'empath']);
		const picker = infoPicker(game, seats[0], lamp.id, all)!;
		expect(picker).toMatchObject({ kind: 'yes-no', seatCount: 2 });
		const yes = picker.options.filter((o) => o.yes).map((o) => o.seats);
		expect(yes).toEqual([
			[seats[0], seats[1]],
			[seats[1], seats[2]],
			[seats[1], seats[3]]
		]);
	});
});

describe('reading a building block', () => {
	const parse = (learns: unknown) => {
		const issues = new Issues();
		return { rules: parseCharacterRules({ learns }, 'rules', issues, []), issues: issues.list };
	};

	it('expands an official name to its block, keeping the name', () => {
		expect(parse({ measure: 'evil-alive-neighbours' }).rules?.learns).toEqual({
			measure: 'count',
			scope: 'alive-neighbours',
			alignment: 'evil',
			preset: 'evil-alive-neighbours'
		});
	});

	it('needs who matches, how many are chosen, and a scope that fits', () => {
		expect(parse({ measure: 'count', scope: 'everyone' }).issues).toEqual([
			'rules.learns: needs who matches: `alignment`, `types`, `woke` or `token`'
		]);
		expect(parse({ measure: 'players', alignment: 'evil' }).issues).toEqual([
			'rules.learns.choose: missing'
		]);
		expect(
			parse({ measure: 'players', scope: 'alive-neighbours', choose: 1, alignment: 'evil' }).issues
		).toEqual([
			'rules.learns.choose: not with scope `alive-neighbours`',
			'rules.learns.scope: only a `count` looks at neighbours'
		]);
		expect(parse({ measure: 'players', choose: 2, matching: 3, alignment: 'evil' }).issues).toEqual(
			['rules.learns.matching: more than are shown']
		);
		expect(parse({ measure: 'chosen-alignment', scope: 'everyone' }).issues).toEqual([
			'rules.learns: only the building blocks take a scope or count'
		]);
	});
});
