import { describe, expect, it } from 'vitest';
import type { Script } from '#lib/core/data/types.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import {
	bagRoleOf,
	canDuplicate,
	isNotDealt,
	isReplacedAfterDraw,
	notDealtInPlay,
	replacementReminder,
	scriptWithBagRole,
	withBagRole
} from './bag-characters.ts';

const data = committedGameData();
const get = (id: string) => data.byId.get(id)!;
const none: never[] = [];

describe('canDuplicate', () => {
	// https://wiki.bloodontheclocktower.com/Village_Idiot: up to two extra Village Idiots.
	it('the Village Idiot can always have copies', () => {
		expect(canDuplicate(get('villageidiot'), none)).toBe(true);
	});

	// https://wiki.bloodontheclocktower.com/Legion: most players are Legion.
	it('Legion can always have copies', () => {
		expect(canDuplicate(get('legion'), none)).toBe(true);
	});

	it('other characters cannot, without a rule that allows it', () => {
		for (const id of ['chef', 'saint', 'poisoner', 'imp', 'riot']) {
			expect(canDuplicate(get(id), [get('chef'), get('imp')])).toBe(false);
		}
	});

	// https://wiki.bloodontheclocktower.com/Pope: duplicate good characters. TPI's data also
	// marks evil ones; the Pope's rules block keeps them out (M22).
	it('with the Pope, good characters can repeat but evil ones cannot', () => {
		const pope = [get('pope')];
		expect(canDuplicate(get('chef'), pope)).toBe(true);
		expect(canDuplicate(get('saint'), pope)).toBe(true);
		expect(canDuplicate(get('imp'), pope)).toBe(false);
	});

	// https://wiki.bloodontheclocktower.com/Atheist: the Storyteller can break the rules.
	it('with the Atheist, any character can repeat', () => {
		const atheist = [get('atheist')];
		expect(canDuplicate(get('chef'), atheist)).toBe(true);
		expect(canDuplicate(get('imp'), atheist)).toBe(true);
	});

	it('only the data decides: every bag-duplicate character', () => {
		const ids = data.characters.filter((c) => canDuplicate(c, none)).map((c) => c.id);
		expect(ids.sort()).toEqual(['legion', 'villageidiot']);
	});
});

// https://wiki.bloodontheclocktower.com/Lil%27_Monsta
it("isNotDealt: only Lil' Monsta among official characters", () => {
	expect(data.characters.filter(isNotDealt).map((c) => c.id)).toEqual(['lilmonsta']);
});

describe('bag roles a Storyteller sets on homebrew characters', () => {
	// A made-up Outsider that thinks it is another character, with a script that leaves out
	// TPI's `special` data (backlog L25).
	const imposter = {
		...get('saint'),
		id: 'imposter',
		name: 'Imposter',
		special: [],
		remindersGlobal: ['Is Imposter']
	};

	it('reads the official characters as TPI marks them', () => {
		expect(bagRoleOf(get('chef'))).toBe('dealt');
		expect(bagRoleOf(get('drunk'))).toBe('replaces');
		expect(bagRoleOf(get('lilmonsta'))).toBe('not-dealt');
	});

	it('a replacing character is marked with its own "Is …" reminder, "The" or not', () => {
		const set = withBagRole(imposter, 'replaces');
		expect(bagRoleOf(set)).toBe('replaces');
		expect(isReplacedAfterDraw(set)).toBe(true);
		expect(replacementReminder(set)).toEqual({ characterId: 'imposter', label: 'Is Imposter' });
	});

	it('one with no "Is …" reminder gets one', () => {
		const set = withBagRole({ ...imposter, remindersGlobal: [] }, 'replaces');
		expect(set.remindersGlobal).toEqual(['Is The Imposter']);
	});

	it('changing back keeps its other special data', () => {
		const pointing = { type: 'ability', name: 'pointing' } as const;
		const set = withBagRole({ ...imposter, special: [pointing] }, 'not-dealt');
		expect(isNotDealt(set)).toBe(true);
		expect(withBagRole(set, 'dealt').special).toEqual([pointing]);
	});

	it('changes only that character on the script', () => {
		const script = {
			entries: [
				{ kind: 'official' as const, id: 'chef' },
				{ kind: 'custom' as const, character: imposter }
			]
		};
		const changed = scriptWithBagRole(script, 'imposter', 'replaces');
		expect(changed.entries[0]).toEqual(script.entries[0]);
		const entry = changed.entries[1];
		expect(entry?.kind === 'custom' && bagRoleOf(entry.character)).toBe('replaces');
	});
});

// https://wiki.bloodontheclocktower.com/Lil%27_Monsta: never dealt, so no seat holds it, and a
// Minion babysits it; the night still wakes the Minions for it.
describe('notDealtInPlay', () => {
	const script = (ids: string[]): Script => ({
		meta: { name: 'Not dealt' },
		entries: ids.map((id) => ({ kind: 'official' as const, id }))
	});
	const cast = ['poisoner', 'widow', 'chef', 'empath', 'monk'];
	const of = (seated: string[], ids: string[]) => {
		const s = scenario(seated, { script: script(ids) });
		return { s, inPlay: notDealtInPlay(s.game, s.characters) };
	};

	it('finds it in play when no seated player is a Demon', () => {
		expect(of(cast, [...cast, 'lilmonsta', 'imp']).inPlay).toEqual(['lilmonsta']);
	});

	it('not when a seated player is a Demon, unless a player carries its token', () => {
		const { s, inPlay } = of([...cast, 'imp'], [...cast, 'lilmonsta', 'imp']);
		expect(inPlay).toEqual([]);
		const carried = s.reminder('widow', 'lilmonsta', 'Is The Demon');
		expect(notDealtInPlay(carried.game, carried.characters)).toEqual(['lilmonsta']);
	});

	it('not when a seated character’s own setup change leaves out the Demon (the Summoner)', () => {
		const seated = ['summoner', 'widow', 'chef', 'empath', 'monk'];
		expect(of(seated, [...seated, 'lilmonsta']).inPlay).toEqual([]);
	});

	it('not before any player has a character, nor when it is off the script', () => {
		expect(of([], [...cast, 'lilmonsta']).inPlay).toEqual([]);
		expect(of(cast, cast).inPlay).toEqual([]);
	});
});
