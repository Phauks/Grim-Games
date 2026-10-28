import type { InboxItem } from './inbox.svelte.ts';

/**
 * What the Storyteller's Messages shows (Trevor, 2026-10-28: "filters to message menu to sort
 * by player and if requesting consultation and unread or read"). A reported picture counts as
 * unread until it is judged, and never as a consult.
 */
export interface InboxFilter {
	/** One player's messages and pictures, by member id; `all` for everyone's. */
	player: string;
	/** Show unread messages and pictures still to judge. */
	unread: boolean;
	/** Show messages already read. */
	read: boolean;
	/** Only messages that ask for a Storyteller consult. */
	consult: boolean;
}

export const ALL_INBOX: InboxFilter = { player: 'all', unread: true, read: true, consult: false };

export function filterInbox(items: readonly InboxItem[], filter: InboxFilter): InboxItem[] {
	return items.filter((item) => {
		if (filter.player !== 'all' && item.memberId !== filter.player) return false;
		const unread = item.kind === 'picture' || !item.read;
		if (!(unread ? filter.unread : filter.read)) return false;
		return !filter.consult || (item.kind === 'message' && !!item.consult);
	});
}

/** Each player with something in Messages, once, in the order they first appear. */
export function inboxSenders(items: readonly InboxItem[]): string[] {
	return [...new Set(items.map((i) => i.memberId))];
}
