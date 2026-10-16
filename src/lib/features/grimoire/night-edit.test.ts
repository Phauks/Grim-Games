import { describe, expect, it } from 'vitest';
import { editionScript, toScript } from '#lib/core/data/index.ts';
import {
	createGame,
	dispatch,
	type Command,
	type EngineContext,
	type GameSession
} from '#lib/core/engine/index.ts';
import { characterLookup } from '#lib/core/model/index.ts';
import { nightOrder, type Night } from '#lib/core/rules/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { addStep, editStep, moveStep, restoreStep, skipStep, skippedSteps } from './night-edit.ts';

const data = committedGameData();
const script = toScript(editionScript('tb', data)!);
const characters = characterLookup(data, script);
let n = 0;
const ctx: EngineContext = { characters, newId: () => `id${++n}`, now: () => 0, random: () => 0 };
const inPlay = ['poisoner', 'washerwoman', 'empath'].map((id) => characters.get(id)!);

function start(): GameSession {
	const created = createGame({ type: 'CreateGame', script, playerCount: 5 }, ctx);
	if (!created.ok) throw new Error();
	return created.session;
}
function run(session: GameSession, command: Command | undefined): GameSession {
	const result = dispatch(session, command!, ctx);
	if (!result.ok) throw new Error(result.error.message);
	return result.session;
}
const order = (session: GameSession, night: Night = 'first') =>
	nightOrder({
		night,
		sheet: data.nightSheet,
		inPlay,
		players: 5,
		overrides: session.game.nightOrderOverrides
	}).steps;
const ids = (session: GameSession, night?: Night) => order(session, night).map((s) => s.id);

// The Storyteller may run the night as they see fit
// (https://wiki.bloodontheclocktower.com/Night_Order). Each edit is one command.
describe('night order editing', () => {
	it('moves a step up and down, one command each, replacing its earlier move', () => {
		let s = start();
		const before = ids(s);
		const empath = before.indexOf('empath');
		s = run(s, moveStep(order(s), s.game.nightOrderOverrides, 'first', empath, -1));
		expect(ids(s).indexOf('empath')).toBe(empath - 1);
		s = run(s, moveStep(order(s), s.game.nightOrderOverrides, 'first', empath - 1, 1));
		expect(ids(s)).toEqual(before);
		expect(s.game.nightOrderOverrides).toHaveLength(1);
		expect(moveStep(order(s), s.game.nightOrderOverrides, 'first', 0, -1)).toBeUndefined();
	});
	it('skips a step on one night only, and restores it', () => {
		let s = start();
		s = run(s, skipStep(s.game.nightOrderOverrides, 'first', 'poisoner'));
		expect(ids(s)).not.toContain('poisoner');
		expect(ids(s, 'other')).toContain('poisoner');
		const [skipped] = skippedSteps(s.game.nightOrderOverrides, 'first');
		expect(skipped.id).toBe('poisoner');
		s = run(s, restoreStep(skipped.index));
		expect(ids(s)).toContain('poisoner');
	});
	it('edits text, adds a step of its own, and removes it again', () => {
		let s = start();
		s = run(s, editStep(s.game.nightOrderOverrides, 'first', 'empath', 'Fingers.'));
		expect(order(s).find((x) => x.id === 'empath')?.reminder).toBe('Fingers.');
		s = run(s, addStep('first', 'empath', 'Check', 'Look at the bag.', 'mine'));
		const steps = order(s);
		expect(steps[steps.findIndex((x) => x.id === 'empath') + 1]).toMatchObject({
			id: 'mine',
			title: 'Check',
			reminder: 'Look at the bag.'
		});
		s = run(s, editStep(s.game.nightOrderOverrides, 'first', 'mine', 'Count the bag.'));
		expect(order(s).find((x) => x.id === 'mine')).toMatchObject({
			title: 'Check',
			reminder: 'Count the bag.'
		});
		s = run(s, skipStep(s.game.nightOrderOverrides, 'first', 'mine'));
		expect(ids(s)).not.toContain('mine');
		expect(skippedSteps(s.game.nightOrderOverrides, 'first')).toEqual([]);
	});
});
