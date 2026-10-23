/**
 * The game the Storyteller has open: the engine session, its character lookup and the
 * saved copy. Every accepted command is saved straight away (saves are queued, so they
 * land in order), which is what lets a reload or a PWA update reopen the game exactly.
 *
 * Rules warnings are returned to the caller, which shows them as toasts so nothing on the
 * board moves (no layout reflow). Refusals change nothing.
 */
import type { GameData, Script } from '#lib/core/data/index.ts';
import {
	canRedo,
	canUndo,
	createGame,
	dispatch,
	MemoryGameStore,
	openSession,
	type SavedGame,
	redo,
	systemContext,
	toSavedGame,
	undo,
	type Command,
	type EngineContext,
	type EngineError,
	type EngineWarning,
	type GameSession,
	type GameStore
} from '#lib/core/engine/index.ts';
import {
	characterLookup,
	type CharacterLookup,
	type Game,
	type GameId
} from '#lib/core/model/index.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { endedGames } from '#lib/features/grimoire/device-notes.ts';
import { allowedOffScriptIn } from '#lib/features/modes/game-mode.ts';
import { IdbGameStore } from './idb-store.ts';

let defaultStore: GameStore | undefined;

/** Saved games on this device: IndexedDB, or memory when the browser has none. */
export function gameStore(): GameStore {
	defaultStore ??= globalThis.indexedDB ? new IdbGameStore() : new MemoryGameStore();
	return defaultStore;
}

export type RunResult = { ok: true; warnings: EngineWarning[] } | { ok: false; error: EngineError };

export class OpenGame {
	#session = $state.raw<GameSession>() as GameSession;
	readonly #characters: CharacterLookup;
	/** Bumped when the script's own characters change, so what reads `characters` updates. */
	#charactersVersion = $state(0);
	#script: unknown;
	readonly #ctx: EngineContext;
	readonly #store: GameStore;
	#saving: Promise<void> = Promise.resolve();

	private constructor(
		session: GameSession,
		characters: CharacterLookup,
		store: GameStore,
		ctx?: EngineContext
	) {
		this.#characters = characters;
		this.#script = session.game.script;
		this.session = session;
		this.#ctx = ctx ?? systemContext(characters);
		this.#store = store;
	}

	/**
	 * Starts and saves a new game with `playerCount` empty seats, run by `storytellerName`
	 * when given.
	 */
	static async create(
		data: Pick<GameData, 'characters'>,
		script: Script,
		playerCount: number,
		store: GameStore = gameStore(),
		ctx?: EngineContext,
		storytellerName?: string
	): Promise<OpenGame> {
		const characters = characterLookup(data, script);
		const context = ctx ?? systemContext(characters);
		const created = createGame(
			{ type: 'CreateGame', script, playerCount, ...(storytellerName ? { storytellerName } : {}) },
			context
		);
		if (!created.ok) throw new Error(created.error.message);
		const game = new OpenGame(created.session, characters, store, context);
		await game.save();
		return game;
	}

	/** Opens a saved game; undefined when there is no such game. Throws `SavedGameError`. */
	static async open(
		data: Pick<GameData, 'characters'>,
		gameId: GameId,
		store: GameStore = gameStore(),
		ctx?: EngineContext
	): Promise<OpenGame | undefined> {
		const saved = await store.load(gameId);
		if (!saved) return undefined;
		const session = openSession(saved.log);
		const characters = characterLookup(data, session.game.script);
		const game = new OpenGame(session, characters, store, ctx);
		if (endedGames.read()[gameId]) game.setViewOnly(true);
		return game;
	}

	/**
	 * Someone else's game, from the view-only link (Specters, Trevor 2026-10-18): it is
	 * shown as their device sends it, never saved here, and no command is accepted.
	 */
	static watch(data: Pick<GameData, 'characters'>, saved: SavedGame): OpenGame {
		const session = openSession(saved.log);
		const game = new OpenGame(
			session,
			characterLookup(data, session.game.script),
			new MemoryGameStore()
		);
		game.watching = true;
		game.setViewOnly(true);
		return game;
	}

	get session(): GameSession {
		return this.#session;
	}

	set session(next: GameSession) {
		this.#session = next;
		this.#followScript(next.game.script);
	}

	/** Characters for the game: official ones plus its script's own. */
	get characters(): CharacterLookup {
		void this.#charactersVersion;
		return this.#characters;
	}

	/**
	 * Keeps the lookup on the script's own characters when the script changes during the game
	 * (the Storyteller setting how one goes in the bag, backlog L25). The same map, so the
	 * engine context built on it sees the change too.
	 */
	#followScript(script: Game['script']): void {
		if (script === this.#script) return;
		this.#script = script;
		if (!(this.#characters instanceof Map)) return;
		for (const entry of script.entries) {
			if (entry.kind === 'custom') this.#characters.set(entry.character.id, entry.character);
		}
		this.#charactersVersion++;
	}

	watching = false;

	/**
	 * Shows a newer copy of a watched game. False when its script changed, so its characters
	 * must be looked up again (`watch`).
	 */
	follow(saved: SavedGame): boolean {
		const session = openSession(saved.log);
		if (JSON.stringify(session.game.script) !== JSON.stringify(this.game.script)) return false;
		this.session = session;
		this.#savedCursor = session.log.cursor;
		return true;
	}

	/** Why a command is refused while the game can't be changed here. */
	get readOnlyMessage(): string {
		return this.watching
			? 'Only the Storyteller can change this game.'
			: 'The game is over. Reopen it to change it.';
	}

	/**
	 * An ended game opens to look around in (Trevor, 2026-10-17): no command is accepted,
	 * and stepping through History (`goTo`, undo, redo) only changes what is shown, never
	 * the saved game. Reopening the game leaves this mode at the saved point.
	 */
	viewOnly = $state(false);
	#savedCursor = 0;

	/** Where the saved game is in its History, whatever an ended game is showing. */
	get savedCursor(): number {
		return this.viewOnly ? this.#savedCursor : this.session.log.cursor;
	}

	setViewOnly(on: boolean): void {
		if (on === this.viewOnly) return;
		if (on) this.#savedCursor = this.session.log.cursor;
		else if (this.session.log.cursor !== this.#savedCursor)
			this.session = openSession({ ...this.session.log, cursor: this.#savedCursor });
		this.viewOnly = on;
	}

	get game(): Game {
		return this.session.game;
	}

	/** Runs a command and saves the result. */
	run(command: Command): RunResult {
		if (this.viewOnly)
			return {
				ok: false,
				error: { code: 'no-game', message: this.readOnlyMessage }
			};
		const result = dispatch(this.session, command, this.#ctx);
		if (!result.ok) return result;
		if (result.session !== this.session) {
			this.session = result.session;
			void this.save();
		}
		// A character a special rule put in play from off the script is not flagged (Trevor,
		// 2026-10-23).
		const allowed = allowedOffScriptIn(this.game.gameId);
		const warnings = result.warnings.filter(
			(w) =>
				!(
					w.code === 'not-on-script' &&
					w.characters?.length &&
					w.characters.every((id) => allowed.has(id))
				)
		);
		return { ok: true, warnings };
	}

	get canUndo(): boolean {
		return canUndo(this.session);
	}

	get canRedo(): boolean {
		return canRedo(this.session);
	}

	undo(): void {
		if (!this.canUndo) return;
		this.session = undo(this.session);
		void this.save();
	}

	redo(): void {
		if (!this.canRedo) return;
		this.session = redo(this.session);
		void this.save();
	}

	/**
	 * Rolls the game back (or forward again) to just after `cursor` entries of its history,
	 * in one step. Entries after it stay in the log as the redo stack until a new change
	 * replaces them. The first entry (the new game) is always kept.
	 */
	goTo(cursor: number): void {
		const target = Math.max(1, Math.min(cursor, this.session.log.entries.length));
		if (target === this.session.log.cursor) return;
		this.session = openSession({ ...this.session.log, cursor: target });
		void this.save();
	}

	/**
	 * Queues a save of the current session; resolves once it (and earlier ones) landed. An
	 * ended game being looked at is never saved.
	 */
	save(): Promise<void> {
		if (this.viewOnly) return this.#saving;
		const snapshot = toSavedGame(this.session, this.#ctx.now());
		this.#saving = this.#saving
			.then(() => this.#store.save(snapshot))
			// A failed save is reported (corner card) and the next command saves again.
			.catch((e: unknown) => void reportError(e, { area: 'grimoire' }));
		return this.#saving;
	}
}
