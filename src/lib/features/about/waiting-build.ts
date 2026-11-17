/**
 * What a downloaded build says about itself before it takes over. The page asks the waiting
 * service worker over a MessageChannel (MDN, "Client.postMessage" and "MessagePort"); the
 * worker answers with the saved-game format it reads and the notes it stored at install.
 *
 * - The format tells the page whether the new build can open the game on screen: when it
 *   can't, a game is never reloaded onto it without asking (auto-update.svelte.ts).
 * - The notes are the waiting build's own, so "What changed" describes that build rather than
 *   whichever one the server has deployed since (update-check.svelte.ts).
 */
import { parseBuildNotes, type BuildNotes } from './update-notes.ts';

export const BUILD_INFO = 'BUILD_INFO';

/** Where a build keeps its own notes in its precache: not a served path. */
export const STORED_NOTES_KEY = '/__build-notes';

export interface BuildInfoRequest {
	type: typeof BUILD_INFO;
}

export interface WaitingBuild {
	/** The saved-game format the build reads (SAVED_GAME_VERSION). */
	savedGame: number;
	/** Its notes, when it stored them at install. */
	notes: BuildNotes | null;
}

/** The worker's answer, or undefined when it is not one (an older build that doesn't answer). */
export function parseWaitingBuild(raw: unknown): WaitingBuild | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const { savedGame, notes } = raw as Record<string, unknown>;
	if (typeof savedGame !== 'number' || !Number.isInteger(savedGame)) return undefined;
	return { savedGame, notes: parseBuildNotes(notes) };
}

/**
 * Whether notes fetched at install are this build's: the build's version line names the
 * first seven characters of its commit (vite.config.ts `buildLine`). Notes from a newer
 * deploy that went live mid-install are not kept.
 */
export function notesMatchBuild(notes: BuildNotes | null, version: string): boolean {
	return !!notes && version.includes(` ${notes.commit.slice(0, 7)} `);
}

/** How long the page waits for an answer; an older build never gives one. */
const ASK_MS = 2000;

/** Asks a service worker what it is; undefined when it doesn't answer in time. */
export function askWaitingBuild(worker: ServiceWorker): Promise<WaitingBuild | undefined> {
	return new Promise((resolve) => {
		const channel = new MessageChannel();
		const timer = setTimeout(() => resolve(undefined), ASK_MS);
		channel.port1.onmessage = (event) => {
			clearTimeout(timer);
			resolve(parseWaitingBuild(event.data));
		};
		try {
			const request: BuildInfoRequest = { type: BUILD_INFO };
			worker.postMessage(request, [channel.port2]);
		} catch {
			clearTimeout(timer);
			resolve(undefined);
		}
	});
}
