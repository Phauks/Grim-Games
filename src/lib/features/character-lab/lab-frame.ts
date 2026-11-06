import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { leaveWithoutAsking } from '#lib/features/shell/shell.ts';

/**
 * The Character Lab's game frame on a computer opens each new lab game inside the app that is
 * already running in it, instead of loading the whole app again (load timing, 2026-11-06: a
 * fresh frame took about half a second of a 0.67 s load). The Characters page asks the frame
 * with a message; the frame's app says when it is listening.
 */
const OPEN = 'grimbinder:lab-open';
const READY = 'grimbinder:lab-ready';

/** A game id as the lab makes them: letters, digits and hyphens only. */
const GAME_ID = /^[\w-]+$/;

const fromThisApp = (event: MessageEvent, from: Window | null | undefined) =>
	event.origin === location.origin && !!from && event.source === from;

/**
 * In a frame, opens the game the Characters page around it names, without the leave-game
 * question (the lab replaced that game). Only messages from the parent page of this same app
 * are taken, and only ever to a game's board. Returns the cleanup.
 */
export function followLabFrame(): () => void {
	if (window.parent === window) return () => {};
	const onMessage = (event: MessageEvent) => {
		if (!fromThisApp(event, window.parent)) return;
		const data = event.data as { type?: unknown; gameId?: unknown } | null;
		if (data?.type !== OPEN || typeof data.gameId !== 'string' || !GAME_ID.test(data.gameId))
			return;
		const to = resolve('/grimoire/[gameId]', { gameId: data.gameId });
		leaveWithoutAsking(() => void goto(to, { replaceState: true }));
	};
	window.addEventListener('message', onMessage);
	window.parent.postMessage({ type: READY }, location.origin);
	return () => window.removeEventListener('message', onMessage);
}

/** Asks the app in `frame` to open `gameId`. */
export function openInLabFrame(frame: Window, gameId: string): void {
	frame.postMessage({ type: OPEN, gameId }, location.origin);
}

/** Calls `ready` each time the app in `frame()` starts listening; returns the cleanup. */
export function onLabFrameReady(frame: () => Window | null | undefined, ready: () => void) {
	const onMessage = (event: MessageEvent) => {
		if (fromThisApp(event, frame()) && (event.data as { type?: unknown })?.type === READY) ready();
	};
	window.addEventListener('message', onMessage);
	return () => window.removeEventListener('message', onMessage);
}
