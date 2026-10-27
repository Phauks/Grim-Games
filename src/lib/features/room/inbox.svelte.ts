import type { ClientMessage, HostView, PlayerMessage } from '#lib/core/sync/room.ts';
import type { PictureReportView } from '#lib/core/sync/room-pictures.ts';

/** One line in the Storyteller's Messages: a player's message, or a reported picture. */
export type InboxItem =
	({ kind: 'message' } & PlayerMessage) | ({ kind: 'picture'; id: string } & PictureReportView);

/**
 * The Storyteller's Messages (Trevor, 2026-10-27: "Combine into a communication menu where
 * notifications from players about bad images also goes"): players' messages and reported
 * pictures in one list, newest first. A reported picture stays new until the Storyteller
 * judges it; a message, until it is opened.
 */
export class RoomInbox {
	/** Players' pictures other phones reported, waiting for a verdict (2026-10-27). */
	pictureReports = $state.raw<readonly PictureReportView[]>([]);
	/** Players' messages this game, oldest first. */
	messages = $state.raw<readonly PlayerMessage[]>([]);
	#send: (message: ClientMessage) => boolean;

	constructor(send: (message: ClientMessage) => boolean) {
		this.#send = send;
	}

	receive(view: HostView): void {
		this.pictureReports = view.pictureReports ?? [];
		this.messages = view.messages ?? [];
	}

	clear(): void {
		this.pictureReports = [];
		this.messages = [];
	}

	/** Everything, newest first; a report from an older room, with no time, leads. */
	get items(): InboxItem[] {
		const items: InboxItem[] = [
			...this.messages.map((m) => ({ kind: 'message' as const, ...m })),
			...this.pictureReports.map((r) => ({ kind: 'picture' as const, id: r.hash, ...r }))
		];
		return items.sort((a, b) => (b.at ?? Infinity) - (a.at ?? Infinity));
	}

	/** What still waits for the Storyteller: unread messages and pictures to judge. */
	get unread(): number {
		return this.messages.filter((m) => !m.read).length + this.pictureReports.length;
	}

	/** The Storyteller opened Messages: every message in it now counts as read. */
	readAll(): void {
		const ids = this.messages.flatMap((m) => (m.read ? [] : [m.id]));
		if (ids.length === 0 || !this.#send({ type: 'read-messages', ids })) return;
		this.messages = this.messages.map((m) => (m.read ? m : { ...m, read: true }));
	}

	/** Lets a reported picture stand, or takes the player's picture away for this game. */
	judgePicture(hash: string, allow: boolean): void {
		this.#send({ type: 'judge-picture', hash, allow });
		this.pictureReports = this.pictureReports.filter((r) => r.hash !== hash);
	}
}
