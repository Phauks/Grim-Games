/**
 * Sharing a finished game's recap with the players (Trevor, 2026-10-19): the Storyteller
 * uploads the parts they chose, and the players open /recap/<id> from the link or QR code.
 * This device remembers each game's share and its delete key, so the Storyteller can stop
 * sharing later; losing that only means the recap lasts until it expires.
 */
import { readParsed, writeStored } from '#lib/ui/stored.ts';
import { fetchJson, fetchWithTimeout, SLOW_FETCH_TIMEOUT_MS } from '#lib/ui/fetch.ts';
import type { GameId } from '#lib/core/model/types.ts';
import {
	RECAP_API,
	RECAP_DELETE_KEY_HEADER,
	readCreatedRecap,
	readSharedRecap,
	recapApiPath,
	type CreatedRecap,
	type SharedRecap
} from './recap-share-api.ts';
import type { RecapParts } from './recap-html.ts';

/** Why a shared recap couldn't be opened. */
export type RecapFetchError = 'gone' | 'busy' | 'offline' | 'damaged';

export async function fetchSharedRecap(id: string): Promise<SharedRecap | RecapFetchError> {
	let response: Response;
	let body: unknown;
	try {
		({ response, body } = await fetchJson(recapApiPath(id), { credentials: 'omit' }));
	} catch {
		return 'offline';
	}
	if (response.status === 404) return 'gone';
	if (response.status === 429) return 'busy';
	if (!response.ok) return 'damaged';
	return readSharedRecap(body) ?? 'damaged';
}

/** Uploads a recap; throws if the server didn't store it. */
export async function uploadRecap(shared: SharedRecap): Promise<CreatedRecap> {
	const { response, body } = await fetchJson(RECAP_API, {
		method: 'POST',
		timeoutMs: SLOW_FETCH_TIMEOUT_MS,
		credentials: 'omit',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(shared)
	});
	const created = response.ok ? readCreatedRecap(body) : undefined;
	if (!created) throw new Error(`Recap not shared (HTTP ${response.status})`);
	return created;
}

/** Deletes a shared recap. Already gone counts as done. */
export async function deleteRecap(share: CreatedRecap): Promise<void> {
	const response = await fetchWithTimeout(recapApiPath(share.id), {
		method: 'DELETE',
		credentials: 'omit',
		headers: { [RECAP_DELETE_KEY_HEADER]: share.deleteKey }
	});
	if (!response.ok && response.status !== 404) {
		throw new Error(`Recap not deleted (HTTP ${response.status})`);
	}
}

/** A game's share on this device. */
export interface RecapShare extends CreatedRecap {
	parts: RecapParts;
	at: number;
}

const STORE_KEY = 'grim-games:recap-shares:v1';
const MAX_STORED = 200;

function isShare(v: unknown): v is RecapShare {
	if (typeof v !== 'object' || v === null) return false;
	const s = v as Record<string, unknown>;
	const parts = s.parts as Record<string, unknown> | undefined;
	return (
		typeof s.id === 'string' &&
		typeof s.deleteKey === 'string' &&
		typeof s.at === 'number' &&
		typeof parts === 'object' &&
		parts !== null &&
		typeof parts.log === 'boolean' &&
		typeof parts.image === 'boolean' &&
		typeof parts.notes === 'boolean'
	);
}

function readShares(): Record<GameId, RecapShare> {
	return readParsed(STORE_KEY, (raw) => {
		if (typeof raw !== 'object' || raw === null) return {};
		return Object.fromEntries(Object.entries(raw).filter(([, v]) => isShare(v)));
	});
}

function writeShares(shares: Record<GameId, RecapShare>): void {
	const kept = Object.entries(shares)
		.sort(([, a], [, b]) => b.at - a.at)
		.slice(0, MAX_STORED);
	writeStored(STORE_KEY, kept.length ? Object.fromEntries(kept) : undefined);
}

export const recapShares = {
	read(gameId: GameId): RecapShare | undefined {
		return readShares()[gameId];
	},
	write(gameId: GameId, share: RecapShare): void {
		writeShares({ ...readShares(), [gameId]: share });
	},
	remove(gameId: GameId): void {
		const shares = readShares();
		delete shares[gameId];
		writeShares(shares);
	}
};
