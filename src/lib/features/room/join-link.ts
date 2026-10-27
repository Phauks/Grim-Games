import { resolve } from '$app/paths';

/**
 * The room's one link and QR (Trevor, 2026-10-26: "if we just make it open the join screen,
 * then a second QR code for spoilers is unnecessary"): Join game with the code filled in, so
 * whoever scans it picks Join as player, Grim view or Public Town. The code rides in the hash,
 * which never reaches the server.
 */
export function roomJoinLink(code: string): string {
	return `${location.origin}${resolve('/join')}#${code}`;
}
