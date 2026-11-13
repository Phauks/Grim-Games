/**
 * The game result players share (Trevor, 2026-11-12, plan R4: "I won as the [character]"
 * with a link, option A with a name-free result page): when a game played in a room ends,
 * the Storyteller's device uploads who won and each seat's character, no names, as a shared
 * recap (`resultRecap`), and the room passes its id to the phones with the game-over.
 *
 * This device keeps each game's upload and its delete key, so ending the same game again
 * the same way reuses it, and ending it another way (after Reopen) replaces it.
 */
import type { GameId } from '#lib/core/model/types.ts';
import { readParsed, writeStored } from '#lib/ui/stored.ts';
import { buildRecap, type RecapSource } from '#lib/features/history/recap.ts';
import { resultRecap, type CreatedRecap } from '#lib/features/history/recap-share-api.ts';
import { deleteRecap, uploadRecap } from '#lib/features/history/recap-share.ts';

interface StoredResult extends CreatedRecap {
	/** How the game ended when it was shared: who won and how. */
	ending: string;
	at: number;
}

const STORE_KEY = 'grim-games:game-results:v1';
const MAX_STORED = 50;

function isStored(v: unknown): v is StoredResult {
	if (typeof v !== 'object' || v === null) return false;
	const s = v as Record<string, unknown>;
	return (
		typeof s.id === 'string' &&
		typeof s.deleteKey === 'string' &&
		typeof s.ending === 'string' &&
		typeof s.at === 'number'
	);
}

function readAll(): Record<GameId, StoredResult> {
	return readParsed(STORE_KEY, (raw) => {
		if (typeof raw !== 'object' || raw === null) return {};
		return Object.fromEntries(Object.entries(raw).filter(([, v]) => isStored(v)));
	});
}

function write(gameId: GameId, result: StoredResult): void {
	const kept = Object.entries({ ...readAll(), [gameId]: result })
		.sort(([, a], [, b]) => b.at - a.at)
		.slice(0, MAX_STORED);
	writeStored(STORE_KEY, Object.fromEntries(kept));
}

/** One upload at a time for each game. */
const pending = new Map<GameId, Promise<string>>();

/**
 * The result page id for this game as it ended, uploading it when there is none yet. A
 * result shared for another ending of the same game is deleted (best effort).
 */
export function gameResult(source: RecapSource): Promise<string> {
	const gameId = source.game.gameId;
	const ending = JSON.stringify([source.winner ?? null, source.reason ?? null]);
	const known = readAll()[gameId];
	if (known?.ending === ending) return Promise.resolve(known.id);
	const running = pending.get(gameId);
	if (running) return running;
	const upload = (async () => {
		if (known) await deleteRecap(known).catch(() => undefined);
		const created = await uploadRecap(resultRecap(buildRecap(source)));
		write(gameId, { ...created, ending, at: Date.now() });
		return created.id;
	})().finally(() => pending.delete(gameId));
	pending.set(gameId, upload);
	return upload;
}
