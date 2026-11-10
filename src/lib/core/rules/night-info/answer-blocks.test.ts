/**
 * The `answers` building blocks (M78): `any`, `character` and `characters` over a group of
 * players, with the Town Crier, Flowergirl, Undertaker and the Godfather's first night kept as
 * presets of them. A custom character asks what no official character does. Rules sources:
 * - https://wiki.bloodontheclocktower.com/Town_Crier (whether a Minion nominated today)
 * - https://wiki.bloodontheclocktower.com/Undertaker (the character of the player executed today)
 * - https://wiki.bloodontheclocktower.com/Godfather (which Outsiders are in play)
 */
import { describe, expect, it } from 'vitest';
import { parseCharacter } from '#lib/core/data/parse.ts';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import type { Character } from '#lib/core/data/types.ts';
import { castWith, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { nightAnswer } from './answers.ts';

function custom(answers: Record<string, unknown>): Character {
	const issues = new Issues();
	const c = parseCharacter(
		{ id: 'bellringer', name: 'Bellringer', team: 'townsfolk', ability: 'x', rules: { answers } },
		'[0]',
		issues,
		{ strict: false, scriptFields: true }
	)!;
	expect(issues.list).toEqual([]);
	return c;
}

/** A game with a custom character in seat 0. */
function seated(
	answers: Record<string, unknown>,
	cast: string[],
	...steps: Parameters<ReturnType<typeof castWith>>[1][]
) {
	const bell = custom(answers);
	const all = new Map([...characters, [bell.id, bell]]);
	const { game, seats } = castWith({ characters: all })([bell.id, ...cast], ...steps);
	return { answer: nightAnswer(game, seats[0], bell.id, all)!, seats };
}

describe('answers building blocks', () => {
	it('reads the official names as presets of a block', () => {
		const read = (answers: unknown) => {
			const issues = new Issues();
			return parseCharacterRules({ answers }, 'x', issues, [])?.answers;
		};
		expect(read({ question: 'minion-nominated' })).toEqual({
			question: 'any',
			among: 'nominators',
			types: ['minion'],
			mark: 'minion-nominated',
			preset: 'minion-nominated'
		});
		expect(read({ question: 'executed-character' })).toEqual({
			question: 'character',
			among: 'executed',
			preset: 'executed-character'
		});
	});

	it('refuses a group that does not fit what is asked', () => {
		const issues = (answers: unknown) => {
			const list = new Issues();
			parseCharacterRules({ answers }, 'x', list, []);
			return list.list;
		};
		expect(issues({ question: 'any', among: 'voters', types: ['demon'] })).toEqual([
			'x.answers.mark: votes are not recorded: `voters` needs a `mark`'
		]);
		expect(issues({ question: 'character', among: 'abnormal' })).toEqual([
			'x.answers.among: only a `count` looks at `abnormal`'
		]);
		expect(issues({ question: 'characters', among: 'everyone' })).toEqual([
			'x.answers.types: a `characters` shows one character type'
		]);
		expect(issues({ question: 'count', among: 'dead', mark: 'demon-voted' })).toEqual([
			'x.answers.mark: only `any` takes it'
		]);
	});

	it('learns whether a Demon nominated today, which no official character does', () => {
		const { answer } = seated(
			{ question: 'any', among: 'nominators', types: ['demon'] },
			['imp', 'chef', 'empath'],
			(s) => ({ type: 'Nominate', nominator: s[1], nominee: s[2] })
		);
		expect(answer).toMatchObject({ kind: 'yes-no', value: true });
	});

	it('gives no answer with nobody nominated, as the Town Crier does', () => {
		const { answer } = seated({ question: 'any', among: 'nominators', types: ['demon'] }, [
			'imp',
			'chef'
		]);
		expect(answer).toMatchObject({ kind: 'none', reason: 'No nominations recorded today' });
	});

	it("learns the executed player's character only when they are evil", () => {
		const evil = seated(
			{ question: 'character', among: 'executed', alignment: 'evil' },
			['imp', 'poisoner', 'chef'],
			(s) => ({ type: 'Execute', seatId: s[2] })
		);
		expect(evil.answer).toMatchObject({ kind: 'character', value: 'poisoner' });
		const good = seated(
			{ question: 'character', among: 'executed', alignment: 'evil' },
			['imp', 'poisoner', 'chef'],
			(s) => ({ type: 'Execute', seatId: s[3] })
		);
		expect(good.answer).toMatchObject({ kind: 'none', reason: 'Nobody died by execution today' });
	});

	it('learns which Minions are in play, as the Godfather does Outsiders', () => {
		const { answer } = seated({ question: 'characters', among: 'everyone', types: ['minion'] }, [
			'imp',
			'poisoner',
			'chef',
			'butler'
		]);
		expect(answer).toMatchObject({ kind: 'characters', type: 'minion', value: ['poisoner'] });
	});

	it('counts the nominators who are evil', () => {
		const { answer } = seated(
			{ question: 'count', among: 'nominators', alignment: 'evil' },
			['imp', 'poisoner', 'chef'],
			(s) => ({ type: 'Nominate', nominator: s[1], nominee: s[3] }),
			(s) => ({ type: 'Nominate', nominator: s[3], nominee: s[2] })
		);
		expect(answer).toMatchObject({ kind: 'number', value: 1 });
	});
});
