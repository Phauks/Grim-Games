/**
 * Shared test fixtures: the committed TPI data, a deterministic engine context, and a
 * helper to run commands. Node only (reads static/data), so excluded from the Worker build.
 */
import { readFileSync } from 'node:fs';
import { loadGameData, type CharacterId, type Script } from '#lib/core/data/index.ts';
import {
	createGame,
	dispatch,
	type Command,
	type EngineContext,
	type EngineWarning,
	type GameSession
} from '#lib/core/engine/index.ts';
import { characterLookup, type CharacterLookup } from './characters.ts';

const dataDir = new URL('../../../../static/data/', import.meta.url);
const readJson = (file: string): unknown =>
	JSON.parse(readFileSync(new URL(file, dataDir), 'utf8'));

export const gameData = loadGameData({
	roles: readJson('roles.json'),
	jinxes: readJson('jinxes.json'),
	nightsheet: readJson('nightsheet.json')
});

/** A test script: Trouble Brewing plus characters the model tests need. */
export const TEST_SCRIPT_IDS: CharacterId[] = [
	// Trouble Brewing
	'washerwoman',
	'librarian',
	'investigator',
	'chef',
	'empath',
	'fortuneteller',
	'undertaker',
	'monk',
	'ravenkeeper',
	'virgin',
	'slayer',
	'soldier',
	'mayor',
	'butler',
	'drunk',
	'recluse',
	'saint',
	'poisoner',
	'spy',
	'scarletwoman',
	'baron',
	'imp',
	// Others
	'tealady',
	'philosopher',
	'lunatic',
	'marionette',
	'zombuul',
	'legion'
];

export const testScript: Script = {
	meta: { name: 'Test Brewing' },
	entries: TEST_SCRIPT_IDS.map((id) => ({ kind: 'official', id }))
};

export const testCharacters: CharacterLookup = characterLookup(gameData, testScript);

/**
 * A deterministic context: ids `id-1`, `id-2`, ...; a clock that ticks 1000 ms per call
 * from 2026-10-15; and a seeded random sequence (or a fixed list, repeated).
 */
export function testContext(
	options: { characters?: CharacterLookup; random?: number[]; seed?: number } = {}
): EngineContext {
	let id = 0;
	let time = Date.UTC(2026, 9, 15);
	let seed = options.seed ?? 42;
	let next = 0;
	return {
		characters: options.characters ?? testCharacters,
		newId: () => `id-${++id}`,
		now: () => (time += 1000),
		random: () => {
			if (options.random) return options.random[next++ % options.random.length];
			// Park–Miller LCG.
			seed = (seed * 48271) % 2147483647;
			return (seed - 1) / 2147483646;
		}
	};
}

/** Runs commands in order and throws if any is refused. */
export function run(
	session: GameSession,
	ctx: EngineContext,
	...commands: Command[]
): GameSession & { warnings: EngineWarning[] } {
	let current = session;
	let warnings: EngineWarning[] = [];
	for (const command of commands) {
		const result = dispatch(current, command, ctx);
		if (!result.ok) throw new Error(`${command.type} refused: ${result.error.message}`);
		current = result.session;
		warnings = result.warnings;
	}
	return { ...current, warnings };
}

/** A new game with named seats, in seating order. */
export function newGame(
	names: string[] | number,
	options: { ctx?: EngineContext; script?: Script } = {}
): { session: GameSession; ctx: EngineContext; seats: string[] } {
	const ctx = options.ctx ?? testContext();
	const count = typeof names === 'number' ? names : names.length;
	const created = createGame(
		{ type: 'CreateGame', script: options.script ?? testScript, playerCount: count },
		ctx
	);
	if (!created.ok) throw new Error(created.error.message);
	let session = created.session;
	const seats = [...session.game.seating];
	if (Array.isArray(names)) {
		session = run(
			session,
			ctx,
			...names.map((playerName, i): Command => ({
				type: 'RenameSeat',
				seatId: seats[i],
				playerName
			}))
		);
	}
	return { session, ctx, seats };
}

/** A step of {@link castGame}: a command, or a function of the seat ids that returns one. */
export type CastStep = Command | ((seats: string[]) => Command);

/** What {@link castGame} returns: the session, its game, the context and the seat ids. */
export type CastGame = {
	session: GameSession;
	game: GameSession['game'];
	ctx: EngineContext;
	seats: string[];
};

/**
 * {@link castGame} on another script. Its characters come from that script unless
 * `characters` is given.
 */
export function castWith(options: { script?: Script; characters?: CharacterLookup } = {}) {
	const characters =
		options.characters ?? (options.script ? characterLookup(gameData, options.script) : undefined);
	return (cast: CharacterId[], ...steps: CastStep[]): CastGame => {
		const names = [
			'Ana',
			'Ben',
			'Cat',
			'Dev',
			'Eve',
			'Fay',
			'Gus',
			'Hal',
			'Ivy',
			'Jo',
			'Kit',
			'Lu'
		];
		const { session, ctx, seats } = newGame(names.slice(0, cast.length), {
			script: options.script,
			ctx: testContext({ characters })
		});
		const done = run(
			session,
			ctx,
			...cast.map((characterId, i): Command => ({
				type: 'AssignCharacter',
				seatId: seats[i],
				characterId
			})),
			...steps.map((step) => (typeof step === 'function' ? step(seats) : step))
		);
		return { session: done, game: done.game, ctx, seats };
	};
}

/**
 * A game on the test script with one named seat per character, in seating order, then the
 * steps run in order.
 */
export const castGame = castWith();
