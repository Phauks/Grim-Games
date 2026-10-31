/**
 * Room messages that are only passed on to the devices here now, never kept: Call the town
 * (plan U2, with a push to phones not showing the app, U12) and the town's sounds (U10).
 */
import { parseTownSound, type ServerMessage } from '../src/lib/core/sync/room.ts';
import { hearsSound, parseSoundOutput } from '../src/lib/core/sound/soundboard.ts';
import { pushCallTown, type PushEnv } from './push.ts';
import { sendText, type Attachment } from './room-sockets.ts';

/** Calls every phone back to the town; those locked or with the app closed get a notification. */
export function callTown(ctx: DurableObjectState, env: PushEnv): void {
	const text = JSON.stringify({ type: 'call-town' } satisfies ServerMessage);
	const showing = new Set<string>();
	for (const socket of ctx.getWebSockets()) {
		const to = socket.deserializeAttachment() as Attachment | null;
		if (to?.role !== 'player') continue;
		sendText(socket, text);
		if (to.showing && socket.readyState === WebSocket.OPEN) showing.add(to.memberId);
	}
	ctx.waitUntil(pushCallTown(env, ctx.storage, showing));
}

/**
 * Plays a sound on the devices it is for. Never the Storyteller's own (Trevor, 2026-10-30);
 * an older app's, which names none, reaches the town.
 */
export function playTownSound(ctx: DurableObjectState, message: unknown): void {
	const command = parseTownSound(message);
	if (!command) return;
	const to = (message as { to?: unknown }).to;
	const output = parseSoundOutput(to) ?? 'town';
	const text = JSON.stringify({ type: 'town-sound', ...command } satisfies ServerMessage);
	for (const socket of ctx.getWebSockets()) {
		const who = socket.deserializeAttachment() as Attachment | null;
		if (
			(who?.role === 'town' && hearsSound(output, 'town')) ||
			(who?.role === 'player' && hearsSound(output, 'phones'))
		)
			sendText(socket, text);
	}
}
