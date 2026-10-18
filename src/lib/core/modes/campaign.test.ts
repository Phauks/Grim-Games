/**
 * Flesh and Bone campaigns (https://fleshandbone.app/rules.php): executed characters are
 * eliminated and replaced by one of the same type, Demons grow by one per game up to four,
 * the scripts must flow, and the campaign ends with no Demon left.
 */
import { describe, expect, it } from 'vitest';
import type { Character } from '#lib/core/data/types.ts';
import { GAME_RECORD_VERSION, type GameRecord } from '#lib/core/stats/record.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import {
	assembleScript,
	campaignCandidates,
	campaignOver,
	campaignRule,
	defaultEliminated,
	executedCharacters,
	flowCharacter,
	nextCampaignScript
} from './campaign.ts';
import { NO_RESTRICTIONS, runsPart } from './pool.ts';
import { gameModeById } from './registry.ts';

const data = committedGameData();
const tb = data.characters.filter((c) => c.edition === 'tb');
const byId = (id: string) => data.characters.find((c) => c.id === id)!;
const fleshAndBone = gameModeById('flesh-and-bone')!;
const rule = campaignRule(fleshAndBone)!;

function record(
	seats: GameRecord['seats'],
	dayLog: GameRecord['dayLog'],
	winner?: GameRecord['winner']
): GameRecord {
	return {
		recordVersion: GAME_RECORD_VERSION,
		gameId: 'g',
		role: 'storyteller',
		createdAt: 0,
		endedAt: 1,
		script: {},
		days: dayLog.length,
		seats,
		ruleCharacters: [],
		dayLog,
		characters: {},
		...(winner ? { winner } : {})
	};
}

const day = (n: number, executed: string[] = [], exiled: string[] = []) => ({
	day: n,
	nominations: executed.length,
	executed,
	exiled
});

describe('executedCharacters', () => {
	it('lists characters that died by execution, in order', () => {
		const r = record(
			[
				{ seatId: 'a', end: { characterId: 'chef' }, dead: true, deathCause: 'execution' },
				{ seatId: 'b', end: { characterId: 'imp' }, dead: true, deathCause: 'demon' },
				{ seatId: 'c', end: { characterId: 'baron' }, dead: true, deathCause: 'execution' }
			],
			[day(0), day(1, ['c']), day(2, ['a'])]
		);
		expect(executedCharacters(r)).toEqual(['baron', 'chef']);
	});

	it('leaves out executions that did not kill, and exiles', () => {
		const r = record(
			[
				{ seatId: 'a', end: { characterId: 'chef' }, dead: false },
				{ seatId: 't', end: { characterId: 'gunslinger' }, dead: true, deathCause: 'exile' }
			],
			[day(0), day(1, ['a'], ['t'])]
		);
		expect(executedCharacters(r)).toEqual([]);
	});
});

describe('defaultEliminated', () => {
	it('eliminates every executed character, or only the last in the slow variant', () => {
		expect(defaultEliminated(rule, ['baron', 'chef'])).toEqual(['baron', 'chef']);
		expect(defaultEliminated({ ...rule, eliminate: 'last-executed' }, ['baron', 'chef'])).toEqual([
			'chef'
		]);
	});
});

describe('flowCharacter', () => {
	it("is the winning team's first character on the script", () => {
		expect(flowCharacter(tb, 'good')?.type).toBe('townsfolk');
		expect(flowCharacter(tb, 'evil')?.type).toBe('minion');
		expect(flowCharacter(tb, undefined)).toBeUndefined();
	});
});

describe('nextCampaignScript', () => {
	it('replaces an eliminated character in place with one of the same type, off the script', () => {
		const next = nextCampaignScript({
			mode: fleshAndBone,
			script: tb,
			eliminate: ['chef'],
			eliminatedBefore: [],
			official: data.characters,
			restrictions: NO_RESTRICTIONS,
			random: () => 0
		});
		const [r] = next.replacements;
		expect(r.out.id).toBe('chef');
		expect(r.in?.type).toBe('townsfolk');
		expect(tb.some((c) => c.id === r.in?.id)).toBe(false);
		expect(next.characters.indexOf(r.in!)).toBe(tb.findIndex((c) => c.id === 'chef'));
	});

	it('adds one Demon per game until there are four', () => {
		const next = nextCampaignScript({
			mode: fleshAndBone,
			script: tb,
			eliminate: [],
			eliminatedBefore: [],
			official: data.characters,
			restrictions: NO_RESTRICTIONS,
			random: () => 0
		});
		expect(next.added?.type).toBe('demon');
		expect(next.characters.filter((c) => c.type === 'demon')).toHaveLength(2);
		const four = [
			...tb,
			...data.characters.filter((c) => c.type === 'demon' && c.id !== 'imp').slice(0, 3)
		];
		const full = nextCampaignScript({
			mode: fleshAndBone,
			script: four,
			eliminate: [],
			eliminatedBefore: [],
			official: data.characters,
			restrictions: NO_RESTRICTIONS,
			random: () => 0
		});
		expect(full.added).toBeUndefined();
	});

	it('never brings back an eliminated or restricted character', () => {
		const candidates = campaignCandidates(
			fleshAndBone,
			'minion',
			tb,
			[],
			data.characters,
			NO_RESTRICTIONS
		);
		const [kept, ...rest] = candidates;
		const next = nextCampaignScript({
			mode: fleshAndBone,
			script: tb,
			eliminate: ['baron'],
			eliminatedBefore: rest.slice(1).map((c) => c.id),
			official: data.characters,
			restrictions: { banned: [rest[0].id], allowed: [] },
			random: () => 0
		});
		expect(next.replacements[0].in?.id).toBe(kept.id);
	});

	it('leaves the slot empty when no character of the type is left', () => {
		const minions = data.characters.filter((c) => c.type === 'minion' && c.id !== 'baron');
		const next = nextCampaignScript({
			mode: fleshAndBone,
			script: tb,
			eliminate: ['baron'],
			eliminatedBefore: minions.map((c) => c.id),
			official: data.characters,
			restrictions: NO_RESTRICTIONS,
			random: () => 0
		});
		expect(next.replacements[0].in).toBeUndefined();
		expect(next.characters.some((c) => c.id === 'baron')).toBe(false);
	});
});

describe('assembleScript', () => {
	it('puts a new Demon after the last Demon', () => {
		const script: Character[] = [byId('chef'), byId('imp'), byId('baron')];
		const out = assembleScript(script, [], byId('po'));
		expect(out.map((c) => c.id)).toEqual(['chef', 'imp', 'po', 'baron']);
	});
});

describe('campaignOver', () => {
	it('ends the campaign when no Demon is left', () => {
		expect(campaignOver(fleshAndBone, tb)).toBe(false);
		expect(
			campaignOver(
				fleshAndBone,
				tb.filter((c) => c.type !== 'demon')
			)
		).toBe(true);
	});
});

describe('runsPart', () => {
	it('runs the campaign pool and between-games rules', () => {
		expect(runsPart(fleshAndBone, 'pool')).toBe(true);
		expect(runsPart(fleshAndBone, 'betweenGames')).toBe(true);
	});
});
