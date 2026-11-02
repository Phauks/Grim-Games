/**
 * The `voteWeight` and `voter` parts (M9a). The Thief (https://wiki.bloodontheclocktower.com/Thief),
 * Bureaucrat (/Bureaucrat) and God of Ug (/God_of_Ug) change what a vote counts as; the Butler
 * (/Butler), Zealot (/Zealot) and Beggar (/Beggar) change who may vote. The `voting` part
 * (M9b) changes voting for the whole table: the Voudon (/Voudon), Organ Grinder
 * (/Organ_Grinder) and Ferryman (/Ferryman).
 */
import { describe, expect, it } from 'vitest';
import { parseCharacterRules } from '../character-rules.ts';
import { rulesOf } from '../rules/index.ts';
import { Issues } from '../validate.ts';

const parse = (raw: Record<string, unknown>, reminders?: string[]) => {
	const issues = new Issues();
	return { rules: parseCharacterRules(raw, 'rules', issues, reminders), issues: issues.list };
};

describe('voteWeight', () => {
	it('reads a weight for the carrier of one of its reminders, or for its own player', () => {
		const thief = { reminder: 'Negative Vote', weight: -1 };
		expect(parse({ voteWeight: thief }, ['Negative Vote'])).toEqual({
			rules: { voteWeight: thief },
			issues: []
		});
		expect(parse({ voteWeight: { self: true, weight: 2 } }).rules).toEqual({
			voteWeight: { self: true, weight: 2 }
		});
	});

	it('rejects another character’s reminder, both or neither target, and a weight of 1', () => {
		expect(parse({ voteWeight: { reminder: 'Master', weight: 3 } }, ['3 Votes']).issues).toEqual([
			'rules.voteWeight.reminder: not one of this character’s reminders'
		]);
		expect(parse({ voteWeight: { reminder: 'Hat', self: true, weight: 2 } }).issues).toHaveLength(
			1
		);
		expect(parse({ voteWeight: { weight: 2 } }).issues).toHaveLength(1);
		expect(parse({ voteWeight: { self: true, weight: 1 } }).issues).toHaveLength(1);
		expect(parse({ voteWeight: { self: true, weight: 1.5 } }).issues).toHaveLength(1);
		expect(parse({ voteWeight: { self: false, weight: 2 } }).issues).toHaveLength(1);
		expect(parse({ voteWeight: 3 }).issues).toHaveLength(1);
	});

	it('is in the Thief’s, Bureaucrat’s and God of Ug’s rules', () => {
		expect(rulesOf('thief')?.voteWeight).toEqual({ reminder: 'Negative Vote', weight: -1 });
		expect(rulesOf('bureaucrat')?.voteWeight).toEqual({ reminder: '3 Votes', weight: 3 });
		expect(rulesOf('godofug')?.voteWeight).toEqual({ reminder: 'Hat', weight: 2 });
	});
});

describe('voter', () => {
	it('reads only-with, must and needs-a-token', () => {
		expect(parse({ voter: { onlyWith: 'Master' } }, ['Master'])).toEqual({
			rules: { voter: { onlyWith: 'Master' } },
			issues: []
		});
		expect(parse({ voter: { must: true, minAlive: 5 } }).rules).toEqual({
			voter: { must: true, minAlive: 5 }
		});
		expect(parse({ voter: { needsToken: true } }).rules).toEqual({ voter: { needsToken: true } });
	});

	it('rejects an empty rule, minAlive without must, false flags and another’s reminder', () => {
		expect(parse({ voter: {} }).issues).toEqual([
			'rules.voter: expected onlyWith, must or needsToken'
		]);
		expect(parse({ voter: { needsToken: true, minAlive: 5 } }).issues).toEqual([
			'rules.voter.minAlive: only with must'
		]);
		expect(parse({ voter: { must: true, minAlive: 0 } }).issues).toHaveLength(1);
		expect(parse({ voter: { must: false } }).issues).toHaveLength(2);
		expect(parse({ voter: { onlyWith: 'Hat' } }, ['Master']).issues).toHaveLength(2);
		expect(parse({ voter: { mustNot: true, must: true } }).issues).toEqual([
			'rules.voter.mustNot: unknown field'
		]);
	});

	it('is in the Butler’s, Zealot’s and Beggar’s rules', () => {
		expect(rulesOf('butler')?.voter).toEqual({ onlyWith: 'Master' });
		expect(rulesOf('zealot')?.voter).toEqual({ must: true, minAlive: 5 });
		expect(rulesOf('beggar')?.voter).toEqual({ needsToken: true });
	});
});

describe('voting', () => {
	it('reads who may vote, free ghost votes, no majority, secrecy and regained tokens', () => {
		const voudon = { voters: 'self-and-dead', deadNeedNoToken: true, noMajority: true };
		expect(parse({ voting: voudon })).toEqual({ rules: { voting: voudon }, issues: [] });
		expect(parse({ voting: { secret: true } }).rules).toEqual({ voting: { secret: true } });
		expect(parse({ voting: { deadRegainToken: 'final-day' } }).rules).toEqual({
			voting: { deadRegainToken: 'final-day' }
		});
	});

	it('rejects an empty rule, unknown values, false flags and unknown fields', () => {
		expect(parse({ voting: {} }).issues).toEqual([
			'rules.voting: expected voters, deadNeedNoToken, noMajority, secret or deadRegainToken'
		]);
		expect(parse({ voting: { voters: 'everyone' } }).issues).toEqual([
			'rules.voting.voters: unknown value "everyone"'
		]);
		expect(parse({ voting: { deadRegainToken: 'every-day' } }).issues).toHaveLength(1);
		expect(parse({ voting: { secret: false } }).issues).toEqual([
			'rules.voting.secret: expected true'
		]);
		expect(parse({ voting: { secret: true, open: true } }).issues).toEqual([
			'rules.voting.open: unknown field'
		]);
		expect(parse({ voting: true }).issues).toHaveLength(1);
	});

	it('is in the Voudon’s, Organ Grinder’s and Ferryman’s rules', () => {
		expect(rulesOf('voudon')?.voting).toEqual({
			voters: 'self-and-dead',
			deadNeedNoToken: true,
			noMajority: true
		});
		expect(rulesOf('organgrinder')?.voting).toEqual({ secret: true });
		expect(rulesOf('ferryman')?.voting).toEqual({ deadRegainToken: 'final-day' });
	});
});
