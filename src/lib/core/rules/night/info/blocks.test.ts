/**
 * The `learns` building blocks (M60): a custom character that writes its information as a
 * count, players shown or a yes/no gets the same picker as the official character it copies,
 * and can ask what no official character does. Rules sources:
 * - https://wiki.bloodontheclocktower.com/Empath (evil among the alive neighbours)
 * - https://wiki.bloodontheclocktower.com/Chef (pairs of evil neighbours)
 * - https://wiki.bloodontheclocktower.com/Noble (three players, exactly one evil)
 * - https://wiki.bloodontheclocktower.com/Fortune_Teller (yes if either is the Demon or the
 *   red herring)
 * - https://wiki.bloodontheclocktower.com/Washerwoman (two players, one a Townsfolk, shown
 *   which), /Ravenkeeper (a player's character), /Seamstress (whether two players are the same
 *   alignment), /Village_Idiot (a player's alignment), /Shugenja (the closest evil player's
 *   direction), /Clockmaker (steps from the Demon to its nearest Minion), /High_Priestess (a
 *   player the Storyteller picks), /Sage (a pair, at least one the Demon that killed it):
 *   the blocks added in M78.
 */
import { describe, expect, it } from 'vitest';
import { parseCharacter } from '#lib/core/data/parse.ts';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import type { Character } from '#lib/core/data/types.ts';
import { castWith, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { infoPicker } from './picker.ts';

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

describe('learns building blocks added in M78', () => {
	const cast = ['imp', 'chef', 'poisoner', 'butler', 'empath'];

	it('two players, at least one the Demon that killed it, is the Sage', () => {
		// Wiki (Sage): "If the Demon kills you, you learn that it is 1 of 2 players."
		const { theirs, mine } = both(
			'sage',
			{ measure: 'players', choose: 2, matching: 1, atLeast: true, types: ['demon'], killer: true },
			cast
		);
		same(theirs, mine);
		expect(mine.options.every((o) => o.seats.length === 2)).toBe(true);
	});

	it('`atLeast` shows pairs where both may match, which no official character does', () => {
		const lamp = custom({
			measure: 'players',
			choose: 2,
			matching: 1,
			atLeast: true,
			alignment: 'evil'
		});
		const all = new Map([...characters, [lamp.id, lamp]]);
		const { game, seats } = castWith({ characters: all })([lamp.id, 'imp', 'poisoner', 'chef']);
		const picker = infoPicker(game, seats[0], lamp.id, all)!;
		const pairs = picker.options.map((o) => [...o.seats].sort());
		expect(pairs).toContainEqual([seats[1], seats[2]].sort());
		expect(pairs).not.toContainEqual([seats[0], seats[3]].sort());
	});

	it('a `character` of two players, one a Townsfolk, is the Washerwoman', () => {
		const { theirs, mine } = both(
			'washerwoman',
			{ measure: 'character', choose: 2, types: ['townsfolk'] },
			cast
		);
		same(theirs, mine);
		expect(mine).toMatchObject({ kind: 'pair-character', characterType: 'townsfolk' });
	});

	it('a `character` of one player, any of them, is the Ravenkeeper', () => {
		const { theirs, mine, seats } = both(
			'ravenkeeper',
			{ measure: 'character', choose: 1, self: true },
			cast
		);
		expect(mine).toMatchObject({ kind: theirs.kind, seatCount: theirs.seatCount });
		// The waking player is shown as their own character, which differs between the two.
		const others = (p: typeof mine) => p.options.filter((o) => o.seats[0] !== seats[0]);
		expect(others(mine)).toEqual(others(theirs));
		expect(mine.options.map((o) => o.seats[0])).toEqual(theirs.options.map((o) => o.seats[0]));
		expect(mine.characterType).toBeUndefined();
	});

	it('`same` of two players is the Seamstress', () => {
		const { theirs, mine } = both('seamstress', { measure: 'same', choose: 2 }, cast);
		same(theirs, mine);
	});

	it('an `alignment` of one player is the Village Idiot', () => {
		const { theirs, mine } = both(
			'villageidiot',
			{ measure: 'alignment', choose: 1, self: true },
			cast
		);
		same(theirs, mine);
		expect(mine.answer).toBe('alignment');
	});

	it('the `direction` of the closest evil player is the Shugenja', () => {
		const { theirs, mine } = both('shugenja', { measure: 'direction', alignment: 'evil' }, cast);
		same(theirs, mine);
		expect(mine.answer).toBe('direction');
	});

	it('the `distance` from the Demon to a Minion is the Clockmaker', () => {
		const { theirs, mine } = both(
			'clockmaker',
			{ measure: 'distance', types: ['demon'], to: ['minion'] },
			cast
		);
		same(theirs, mine);
		expect(mine).toMatchObject({ highest: 3, lowest: 1 });
	});

	it('a `storyteller` pick of one player is the High Priestess', () => {
		const { theirs, mine } = both('highpriestess', { measure: 'storyteller', choose: 1 }, cast);
		same(theirs, mine);
		expect(mine.mustBeFalse).toBeUndefined();
	});

	it('measures what no official character does: steps from the Demon to the nearest Outsider', () => {
		const lamp = custom({ measure: 'distance', types: ['demon'], to: ['outsider'] });
		const all = new Map([...characters, [lamp.id, lamp]]);
		const { game, seats } = castWith({ characters: all })([
			lamp.id,
			'imp',
			'chef',
			'empath',
			'butler'
		]);
		const picker = infoPicker(game, seats[0], lamp.id, all)!;
		// The Imp sits at 1, the Butler at 4: 2 steps through the Lamplighter's seat.
		expect(picker).toMatchObject({ kind: 'number', measure: 'distance' });
		expect(picker.options).toEqual([{ seats: [], number: 2 }]);
	});

	it('shows an evil player’s character, which no official character does', () => {
		const lamp = custom({ measure: 'character', choose: 1, alignment: 'evil' });
		const all = new Map([...characters, [lamp.id, lamp]]);
		const { game, seats } = castWith({ characters: all })([lamp.id, 'imp', 'chef', 'poisoner']);
		const picker = infoPicker(game, seats[0], lamp.id, all)!;
		expect(picker.options.map((o) => [o.seats, o.characterId])).toEqual([
			[[seats[1]], 'imp'],
			[[seats[3]], 'poisoner']
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
			'rules.learns: needs who matches: `alignment`, `types`, `woke`, `token` or `differsFromToken`'
		]);
		expect(parse({ measure: 'players', alignment: 'evil' }).issues).toEqual([
			'rules.learns.choose: missing'
		]);
		expect(
			parse({ measure: 'players', scope: 'alive-neighbours', choose: 1, alignment: 'evil' }).issues
		).toEqual([
			'rules.learns.choose: not with scope `alive-neighbours`',
			'rules.learns.scope: only a `count` takes a scope'
		]);
		expect(parse({ measure: 'players', choose: 2, matching: 3, alignment: 'evil' }).issues).toEqual(
			['rules.learns.matching: more than are shown']
		);
		expect(parse({ measure: 'chosen-alignment', scope: 'everyone' }).issues).toEqual([
			'rules.learns.scope: only a `count` takes a scope'
		]);
		expect(parse({ measure: 'distance', types: ['demon'] }).issues).toEqual([
			'rules.learns.to: missing'
		]);
		expect(parse({ measure: 'direction', choose: 1, alignment: 'evil' }).issues).toEqual([
			'rules.learns.choose: not with `direction`'
		]);
		expect(parse({ measure: 'character', choose: 3 }).issues).toEqual([
			'rules.learns.choose: a `character` shows 1 or 2 players'
		]);
		expect(parse({ measure: 'same-alignment', to: ['minion'] }).issues).toEqual([
			'rules.learns.to: only `distance` takes it'
		]);
	});
});
