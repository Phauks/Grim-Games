/**
 * Nominating and executing the Storyteller (https://wiki.bloodontheclocktower.com/Atheist):
 * any living player may nominate the Storyteller, and an execution of the Storyteller ends
 * the game. Good wins if the Atheist is in play, even dead; otherwise evil wins.
 */
import { describe, expect, it } from 'vitest';
import { warned } from '#lib/core/model/fixtures.test-support.ts';
import type { Script } from '#lib/core/data/index.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { gameEnds } from './game-end.ts';
import { storytellerNominee, storytellerNominators } from './nominations.ts';

describe('nominating the Storyteller', () => {
	it('is offered when the Atheist is in play', () => {
		const s = scenario(['atheist', 'chef', 'empath']);
		expect(storytellerNominee(s.game, s.characters)).toBe(true);
	});

	// Trevor, 2026-11-02: an option in every game that has the Atheist or could have it.
	it('is offered when the script has the Atheist and it is not in play', () => {
		const script = (ids: string[]): Script => ({
			meta: { name: 'Test' },
			entries: ids.map((id) => ({ kind: 'official', id }))
		});
		const cast = ['chef', 'empath', 'imp'];
		const withAtheist = scenario(cast, { script: script([...cast, 'atheist']) });
		expect(storytellerNominee(withAtheist.game, withAtheist.characters)).toBe(true);
		const without = scenario(cast, { script: script(cast) });
		expect(storytellerNominee(without.game, without.characters)).toBe(false);
	});

	it('counts as the nominator’s nomination today', () => {
		const s = scenario(['atheist', 'chef', 'empath']).do((at) => ({
			type: 'NominateStoryteller',
			nominator: at.seat('chef')
		}));
		expect(storytellerNominators(s.game)).toEqual([s.seat('chef')]);
		expect(
			warned(s.session, s.ctx, {
				type: 'Nominate',
				nominator: s.seat('chef'),
				nominee: s.seat('empath')
			})
		).toContain('already-nominated');
		expect(
			warned(s.session, s.ctx, { type: 'NominateStoryteller', nominator: s.seat('empath') })
		).toContain('already-nominee');
	});

	it('warns when a dead player nominates the Storyteller', () => {
		const s = scenario(['atheist', 'chef', 'empath']).dies('chef');
		expect(
			warned(s.session, s.ctx, { type: 'NominateStoryteller', nominator: s.seat('chef') })
		).toContain('dead-nominator');
	});
});

describe('executing the Storyteller', () => {
	it('with the Atheist in play, good wins, even if the Atheist is dead', () => {
		const s = scenario(['atheist', 'chef', 'empath']).dies('atheist').do({
			type: 'ExecuteStoryteller'
		});
		expect(gameEnds(s.game, s.characters)[0]).toMatchObject({
			rule: 'storyteller-executed',
			winner: 'good',
			characterId: 'atheist',
			seats: [s.seat('atheist')]
		});
	});

	it('with no Atheist in play, evil wins', () => {
		const s = scenario(['chef', 'empath', 'imp']).do({ type: 'ExecuteStoryteller' });
		const [end] = gameEnds(s.game, s.characters);
		expect(end).toMatchObject({ rule: 'storyteller-executed', winner: 'evil', seats: [] });
		expect(end.characterId).toBeUndefined();
	});

	it('the Drunk who thinks they are the Atheist is not the Atheist: evil wins', () => {
		const s = scenario(['drunk', 'chef', 'empath', 'imp']).do({ type: 'ExecuteStoryteller' });
		expect(gameEnds(s.game, s.characters)[0]).toMatchObject({ winner: 'evil' });
	});

	it('warns on a second execution today', () => {
		const s = scenario(['atheist', 'chef', 'empath']).execute('chef');
		expect(warned(s.session, s.ctx, { type: 'ExecuteStoryteller' })).toContain('already-executed');
		const t = scenario(['atheist', 'chef', 'empath']).do({ type: 'ExecuteStoryteller' });
		expect(warned(t.session, t.ctx, { type: 'Execute', seatId: t.seat('chef') })).toContain(
			'already-executed'
		);
	});
});
