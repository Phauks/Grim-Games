/**
 * Changing the script mid-game (08-script-loading.md §5.6). The Storyteller can override
 * anything, so characters that are not on the new script stay where they are and are only
 * warned about. Travellers, Fabled and Loric need no script entry
 * (https://wiki.bloodontheclocktower.com/Travellers, https://wiki.bloodontheclocktower.com/Fabled).
 */
import { describe, expect, it } from 'vitest';
import type { CharacterId, Script } from '#lib/core/data/index.ts';
import { newGame, run } from '#lib/core/model/fixtures.test-support.ts';
import { publicProjection } from '#lib/core/sync/public-projection.ts';
import { dispatch, openSession, redo, replay, undo } from './log.ts';

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve', 'Fay'];

function scriptOf(name: string, ids: CharacterId[]): Script {
	return { meta: { name }, entries: ids.map((id) => ({ kind: 'official', id })) };
}

const smaller = scriptOf('Smaller', ['imp', 'slayer', 'washerwoman', 'chef', 'baron']);

function setup() {
	const { session, ctx, seats } = newGame(names);
	const s = run(
		session,
		ctx,
		{ type: 'AssignCharacter', seatId: seats[0], characterId: 'imp' },
		{ type: 'AssignCharacter', seatId: seats[1], characterId: 'slayer' },
		{ type: 'AssignCharacter', seatId: seats[2], characterId: 'poisoner' },
		{ type: 'AssignCharacter', seatId: seats[3], characterId: 'tealady' },
		{ type: 'AssignCharacter', seatId: seats[4], characterId: 'gunslinger', alignment: 'good' },
		{
			type: 'AddReminder',
			seatId: seats[1],
			reminder: { characterId: 'poisoner', label: 'Poisoned' }
		},
		{ type: 'AddRuleCharacter', characterId: 'djinn' },
		{ type: 'SetBluffs', set: 0, characterIds: ['mayor', 'chef', 'soldier'] },
		{ type: 'SetDead', seatId: seats[1], dead: true }
	);
	return { session: s, ctx, seats };
}

function changeScript(script: Script) {
	const { session, ctx } = setup();
	const result = dispatch(session, { type: 'ChangeScript', script }, ctx);
	if (!result.ok) throw new Error(result.error.message);
	return { before: session, result, ctx };
}

describe('ChangeScript', () => {
	it('replaces the script and changes nothing else', () => {
		const { before, result } = changeScript(smaller);
		expect(result.session.log.entries.at(-1)?.events).toEqual([
			{ type: 'ScriptChanged', script: smaller }
		]);
		expect(result.session.game).toEqual({ ...before.game, script: smaller });
	});

	it('warns about each character the new script lacks, removing none', () => {
		const { result } = changeScript(smaller);
		const warnings = result.warnings.filter((w) => w.code === 'not-on-script');
		expect(warnings.map((w) => w.message).sort()).toEqual(
			[
				'Mayor is not on the script',
				'Poisoner is not on the script',
				'Soldier is not on the script',
				'Tea Lady is not on the script'
			].sort()
		);
		expect(result.warnings).toHaveLength(warnings.length);
	});

	it('warns about bag tiles not on the new script', () => {
		const { session, ctx } = newGame(names);
		const s = run(session, ctx, {
			type: 'BuildBag',
			tiles: [
				{ shows: 'imp', grimoire: 'imp' },
				{ shows: 'librarian', grimoire: 'drunk' }
			],
			includeTravellers: false,
			shuffle: false
		});
		const result = dispatch(s, { type: 'ChangeScript', script: smaller }, ctx);
		if (!result.ok) throw new Error(result.error.message);
		expect(result.warnings.map((w) => w.message).sort()).toEqual([
			'Drunk is not on the script',
			'Librarian is not on the script'
		]);
	});

	it('gives no warnings when everything is on the new script', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(session, ctx, { type: 'AssignCharacter', seatId: seats[0], characterId: 'imp' });
		const result = dispatch(s, { type: 'ChangeScript', script: smaller }, ctx);
		expect(result.ok && result.warnings).toEqual([]);
	});

	it('does nothing when the script is the same', () => {
		const { session, ctx } = setup();
		const result = dispatch(session, { type: 'ChangeScript', script: session.game.script }, ctx);
		if (!result.ok) throw new Error(result.error.message);
		expect(result.session).toBe(session);
		expect(result.warnings.map((w) => w.code)).toEqual(['no-change']);
	});

	it('undoes and redoes as one step', () => {
		const { before, result } = changeScript(smaller);
		const undone = undo(result.session);
		expect(undone.game).toEqual(before.game);
		expect(redo(undone).game.script).toEqual(smaller);
	});

	it('replays from the log, including a saved copy', () => {
		const { result, ctx } = changeScript(smaller);
		const later = run(result.session, ctx, {
			type: 'AssignCharacter',
			seatId: result.session.game.seating[5],
			characterId: 'baron'
		});
		expect(replay(later.log)).toEqual(later.game);
		const copy = openSession(JSON.parse(JSON.stringify(later.log)));
		expect(copy.game).toEqual(later.game);
		expect(copy.game.script).toEqual(smaller);
	});

	it('leaves the public projection unchanged', () => {
		const { before, result } = changeScript(smaller);
		expect(publicProjection(result.session.game)).toEqual(publicProjection(before.game));
	});
});
