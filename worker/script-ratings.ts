/**
 * Public script ratings (Trevor, 2026-11-16): a room adds each ended game's ratings and
 * accolade counts to its script's rating in the shared ledger (worker/game-ledger.ts), and
 * anyone reads a script's rating at `GET /api/script-rating/<id>`, where the id is a hash of
 * the script's name and author (core/feedback/script-rating.ts). Comments, names and accounts
 * never leave the room this way.
 */
import { gameTally, scriptRatingId, SCRIPT_RATING_ID } from '../src/lib/core/feedback/index.ts';
import type { RoomState } from '../src/lib/core/sync/room.ts';
import type { ScriptView } from '../src/lib/core/sync/room-protocol.ts';
import { gameLedger, type GameLedgerEnv } from './game-ledger.ts';

const PATH = /^\/api\/script-rating\/([0-9a-f]{64})$/;

export async function handleScriptRating(
	request: Request,
	env: GameLedgerEnv,
	url: URL
): Promise<Response | undefined> {
	const match = PATH.exec(url.pathname);
	if (!match) return url.pathname.startsWith('/api/script-rating/') ? notFound() : undefined;
	if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
	const ledger = gameLedger(env);
	if (!ledger || !SCRIPT_RATING_ID.test(match[1])) return notFound();
	return Response.json(await ledger.scriptRating(match[1]), {
		headers: { 'Cache-Control': 'public, max-age=60' }
	});
}

const notFound = () => new Response('Not found', { status: 404 });

/**
 * Adds the ended game to its script's public rating. Counts only feedback from players in a
 * seat, and only when a signed-in Storyteller told the game (`storytellers`), so an empty room
 * can't rate a script.
 */
export async function rateScript(
	storage: DurableObjectStorage,
	env: GameLedgerEnv,
	room: RoomState,
	storytellers: readonly string[],
	now: number
): Promise<void> {
	const gameId = room.ended?.gameId;
	const ledger = gameLedger(env);
	if (!gameId || !ledger || storytellers.length === 0) return;
	const seated = new Set(room.members.filter((m) => m.seatId).map((m) => m.memberId));
	const feedback = (room.feedback ?? []).filter((f) => seated.has(f.memberId));
	const tally = gameTally(feedback.map((f) => f.feedback));
	const meta = (await storage.get<ScriptView>('script'))?.script.meta;
	if (!tally || !meta?.name) return;
	await ledger.rateGame(gameId, await scriptRatingId(meta.name, meta.author), tally, now);
}
