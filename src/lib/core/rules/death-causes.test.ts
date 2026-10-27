/**
 * Characters that can cause a death. Each official character's `deathCause` lives in its
 * rules block (`data/rules/<id>.json`); the tests below cite the wiki pages they encode.
 */
import { describe, expect, it } from 'vitest';
import type { Character, Script } from '#lib/core/data/types.ts';
import { characterLookup } from '#lib/core/model/characters.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { newGame } from '#lib/core/model/fixtures.test-support.ts';
import { OFFICIAL_RULES } from '#lib/core/data/rules/index.ts';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import {
	deathCauseEntry,
	deathCauses,
	gameDeathCauses,
	isExecution,
	reminderDeathCause,
	type DeathKind
} from './death-causes.ts';

const data = committedGameData();
const official: Script = { entries: [] };
const characters = characterLookup(data, official);
const kindOf = (id: string) => deathCauseEntry(id)?.kind;
/** Official characters whose ability can cause a death, by id. */
const DEATH_CAUSE_ENTRIES = Object.fromEntries(
	[...OFFICIAL_RULES].flatMap(([id]) => {
		const entry = deathCauseEntry(id);
		return entry ? [[id, entry]] : [];
	})
);
/** Official characters whose ability never causes a death, and why. */
const NO_DEATH = Object.fromEntries(
	[...OFFICIAL_RULES].flatMap(([id, rules]) =>
		rules.deathCause && 'none' in rules.deathCause ? [[id, rules.deathCause.none]] : []
	)
);

describe('coverage', () => {
	it('lists every official character exactly once, as a death cause or as no death', () => {
		const listed = Object.keys(DEATH_CAUSE_ENTRIES);
		const quiet = Object.keys(NO_DEATH);
		expect(listed.filter((id) => quiet.includes(id))).toEqual([]);
		const all = new Set([...listed, ...quiet]);
		expect(data.characters.filter((c) => !all.has(c.id)).map((c) => c.id)).toEqual([]);
		expect([...all].filter((id) => !data.byId.has(id))).toEqual([]);
	});

	it('gives every character that can cause a death a wiki page', () => {
		for (const id of Object.keys(DEATH_CAUSE_ENTRIES)) {
			expect(data.byId.get(id)?.edition, id).toBeDefined();
		}
	});
});

describe('kinds', () => {
	it.each<[string, DeathKind, string]>([
		// Kills another player.
		['slayer', 'kills', 'Slayer: the chosen Demon dies'],
		['assassin', 'kills', 'Assassin: the chosen player dies, even if protected'],
		['golem', 'kills', 'Golem: a nominee who is not the Demon dies'],
		['gossip', 'kills', 'Gossip: a true statement means a player dies tonight'],
		['lycanthrope', 'kills', 'Lycanthrope: a chosen good player dies'],
		['gunslinger', 'kills', 'Gunslinger: a player who voted dies'],
		['moonchild', 'kills', 'Moonchild: the chosen good player dies, not the Moonchild'],
		['harlot', 'kills', 'Harlot: both players might die'],
		['angel', 'kills', 'Angel: a punishment may be a death'],
		['bigwig', 'kills', 'Bigwig: the chosen player might die'],
		// Only its own death.
		['tinker', 'own-death', 'Tinker: the Tinker might die at any time'],
		['gambler', 'own-death', 'Gambler: a wrong guess kills the Gambler'],
		['acrobat', 'own-death', 'Acrobat: a drunk or poisoned choice kills the Acrobat'],
		['grandmother', 'own-death', 'Grandmother: dies when the Demon kills the grandchild'],
		// An execution or an extra one.
		['virgin', 'execution', 'Virgin: a Townsfolk nominator is executed'],
		['butcher', 'execution', 'Butcher: a second nomination, so a second execution'],
		['judge', 'execution', 'Judge: forces the current execution to pass'],
		['vizier', 'execution', 'Vizier: may execute immediately'],
		// Only through an ability it has or gives.
		['philosopher', 'gained-ability', 'Philosopher: gains a good ability'],
		['plaguedoctor', 'gained-ability', 'Plague Doctor: the Storyteller gains a Minion ability']
	])('%s: %s (%s)', (id, kind) => {
		expect(kindOf(id)).toBe(kind);
	});

	// https://wiki.bloodontheclocktower.com/Witch: the cursed player dies if they nominate.
	it('the Witch kills the nominating player', () => {
		expect(kindOf('witch')).toBe('kills');
	});

	// https://wiki.bloodontheclocktower.com/Pit-Hag: making a Demon makes tonight's deaths
	// the Storyteller's choice; the Pit-Hag's ability itself kills no one (Trevor, 2026-10-23:
	// "not a source of direct death").
	it('the Pit-Hag is not a cause of death', () => {
		expect(kindOf('pithag')).toBeUndefined();
		expect(Object.hasOwn(NO_DEATH, 'pithag')).toBe(true);
	});

	// https://wiki.bloodontheclocktower.com/Barber: only swaps characters.
	it('the Barber never causes a death', () => {
		expect(kindOf('barber')).toBeUndefined();
		expect(Object.hasOwn(NO_DEATH, 'barber')).toBe(true);
	});

	// https://wiki.bloodontheclocktower.com/Mastermind: only adds a day; any execution that
	// day is an ordinary one.
	it('the Mastermind never causes a death', () => {
		expect(Object.hasOwn(NO_DEATH, 'mastermind')).toBe(true);
	});

	// https://wiki.bloodontheclocktower.com/Mayor: whoever dies instead is killed by the Demon.
	it('the Mayor never causes a death', () => {
		expect(Object.hasOwn(NO_DEATH, 'mayor')).toBe(true);
	});

	// https://wiki.bloodontheclocktower.com/Storm_Catcher: it protects; it never kills.
	it('the Storm Catcher never causes a death', () => {
		expect(Object.hasOwn(NO_DEATH, 'stormcatcher')).toBe(true);
	});
});

describe('Demons', () => {
	const demons = data.characters.filter((c) => c.type === 'demon').map((c) => c.id);

	// Each Demon's wiki page: every Demon kills, except the Leviathan (below).
	it('every Demon but the Leviathan kills', () => {
		expect(demons.length).toBeGreaterThan(15);
		for (const id of demons.filter((d) => d !== 'leviathan')) {
			expect(deathCauseEntry(id), id).toMatchObject({ kind: 'kills' });
			expect(deathCauseEntry(id)?.onlyWith, id).toBeUndefined();
		}
	});

	// https://wiki.bloodontheclocktower.com/Leviathan: it does not kill; with the Banshee
	// jinx it chooses a player each night, and a chosen Banshee dies.
	it('the Leviathan kills only with the Banshee', () => {
		expect(deathCauses(['leviathan', 'empath'], characters)).toEqual([]);
		expect(deathCauses(['leviathan', 'banshee'], characters)).toEqual([
			{ characterId: 'leviathan', kind: 'kills' }
		]);
	});
});

describe('deathCauses', () => {
	it('keeps script order and drops characters that never cause a death', () => {
		expect(
			deathCauses(
				['washerwoman', 'virgin', 'slayer', 'tinker', 'poisoner', 'imp', 'philosopher'],
				characters
			)
		).toEqual([
			{ characterId: 'virgin', kind: 'execution' },
			{ characterId: 'slayer', kind: 'kills' },
			{ characterId: 'tinker', kind: 'own-death' },
			{ characterId: 'imp', kind: 'kills' },
			{ characterId: 'philosopher', kind: 'gained-ability' }
		]);
	});

	// https://wiki.bloodontheclocktower.com/Travellers and /Fabled: they can join any game,
	// so those in play are offered even when the script does not list them.
	it('adds Travellers, Fabled and Loric in play after the script, each once', () => {
		expect(
			deathCauses(['imp', 'gunslinger'], characters, [
				'gunslinger',
				'harlot',
				'thief',
				'doomsayer',
				'stormcatcher',
				'imp'
			])
		).toEqual([
			{ characterId: 'imp', kind: 'kills' },
			{ characterId: 'gunslinger', kind: 'kills' },
			{ characterId: 'harlot', kind: 'kills' },
			{ characterId: 'doomsayer', kind: 'kills' }
		]);
	});

	it('offers a homebrew Demon as a killer and other homebrew characters as unknown', () => {
		const brew = (id: string, type: Character['type']): Character => ({
			...(data.byId.get('imp') as Character),
			id,
			name: id,
			type
		});
		const script: Script = {
			entries: [
				{ kind: 'custom', character: brew('brewdemon', 'demon') },
				{ kind: 'custom', character: brew('brewfolk', 'townsfolk') },
				{ kind: 'official', id: 'chef' }
			]
		};
		expect(deathCauses(['brewdemon', 'brewfolk', 'chef'], characterLookup(data, script))).toEqual([
			{ characterId: 'brewdemon', kind: 'kills' },
			{ characterId: 'brewfolk', kind: 'unknown' }
		]);
	});

	// A custom character's own `deathCause` works as an official one's: the Slayer's kill
	// (https://wiki.bloodontheclocktower.com/Slayer), the Leviathan's only with the Banshee
	// (https://wiki.bloodontheclocktower.com/Leviathan), the Chef's none.
	it('reads a custom character’s own deathCause rule', () => {
		const brew = (id: string, deathCause: unknown): Character => ({
			...(data.byId.get('chef') as Character),
			id,
			name: id,
			rules: parseCharacterRules({ deathCause }, id, new Issues())
		});
		const script: Script = {
			entries: [
				{
					kind: 'custom',
					character: brew('hunter', { kind: 'kills', victim: { who: 'registers', as: 'demon' } })
				},
				{ kind: 'custom', character: brew('sleeper', { kind: 'kills', onlyWith: ['banshee'] }) },
				{ kind: 'custom', character: brew('cook', { none: 'info' }) }
			]
		};
		const lookup = characterLookup(data, script);
		expect(deathCauses(['hunter', 'sleeper', 'cook'], lookup)).toEqual([
			{ characterId: 'hunter', kind: 'kills' }
		]);
		expect(deathCauses(['hunter', 'sleeper', 'cook', 'banshee'], lookup)).toEqual([
			{ characterId: 'hunter', kind: 'kills' },
			{ characterId: 'sleeper', kind: 'kills' }
		]);
	});

	it('reports a malformed deathCause rule', () => {
		const issues = new Issues();
		for (const deathCause of [
			{ kind: 'maims' },
			{ kind: 'kills', victim: { who: 'registers' } },
			{ kind: 'kills', victim: { who: 'self', as: 'good' } },
			{ none: 'info', kind: 'kills' }
		]) {
			parseCharacterRules({ deathCause }, 'rules', issues);
		}
		expect(issues.list.map((i) => i.split(': ')[0])).toEqual([
			'rules.deathCause.kind',
			'rules.deathCause.victim.as',
			'rules.deathCause.victim.as',
			'rules.deathCause.kind'
		]);
	});

	it('reads a game: its script, its seats and its Fabled and Loric', () => {
		const { session, seats } = newGame(3);
		const game = {
			...session.game,
			seats: {
				...session.game.seats,
				[seats[0]]: { ...session.game.seats[seats[0]], characterId: 'gangster' }
			},
			ruleCharacters: ['angel']
		};
		const ids = gameDeathCauses(game, characters).map((o) => o.characterId);
		expect(ids).toContain('slayer');
		expect(ids).toContain('imp');
		expect(ids.slice(-2)).toEqual(['gangster', 'angel']);
		expect(ids).not.toContain('washerwoman');
	});
});

describe('the Minions that can cause a death', () => {
	// Each cites its wiki page in its rules block; the Pit-Hag is not one (Trevor,
	// 2026-10-23), nor is any Minion whose ability only informs, poisons or changes things.
	it('are exactly these', () => {
		const minions = Object.keys(DEATH_CAUSE_ENTRIES)
			.filter((id) => characters.get(id)?.type === 'minion')
			.sort();
		expect(minions).toEqual([
			'assassin',
			'boffin',
			'boomdandy',
			'cerenovus',
			'godfather',
			'harpy',
			'psychopath',
			'vizier',
			'witch',
			'wizard'
		]);
	});
});

describe('the cause a reminder gives a death', () => {
	// https://wiki.bloodontheclocktower.com/Fang_Gu: the Fang Gu kills; its "Dead" reminder
	// on a player names it as the cause.
	it("is the reminder's character when it can kill", () => {
		const game = newGame(3, {
			script: { entries: ['fanggu', 'pithag', 'chef'].map((id) => ({ kind: 'official', id })) }
		}).session.game;
		expect(reminderDeathCause(game, characters, 'fanggu')).toBe('fanggu');
	});
	// https://wiki.bloodontheclocktower.com/Pit-Hag and /Chef: neither ability kills.
	it('is none for a character that never kills, or the ∞ reminder', () => {
		const game = newGame(3, {
			script: { entries: ['fanggu', 'pithag', 'chef'].map((id) => ({ kind: 'official', id })) }
		}).session.game;
		expect(reminderDeathCause(game, characters, 'pithag')).toBeUndefined();
		expect(reminderDeathCause(game, characters, 'chef')).toBeUndefined();
		expect(reminderDeathCause(game, characters, 'generic')).toBeUndefined();
	});
});

// https://wiki.bloodontheclocktower.com/Virgin: the nominator is executed, so the Virgin's cause
// counts as an execution (the Saint, https://wiki.bloodontheclocktower.com/Saint).
describe('isExecution', () => {
	it('is an execution, plain or by an ability that executes', () => {
		expect(isExecution('execution')).toBe(true);
		expect(isExecution('virgin')).toBe(true);
		expect(isExecution('demon')).toBe(false);
		expect(isExecution('exile')).toBe(false);
		expect(isExecution('slayer')).toBe(false);
		expect(isExecution(undefined)).toBe(false);
	});
});
