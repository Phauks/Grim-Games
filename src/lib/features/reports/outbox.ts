import { ReportRefused } from './reports-api.ts';
import { isReportKind, isSendId, type ReportDraft } from './reports-protocol.ts';

/**
 * Reports saved on the device until the Worker has them (Trevor, 2026-10-27: "bug reports can
 * be submitted offline, and will truly submit when back on network"). The state and sending
 * live in outbox.svelte.ts; this is the stored shape and the decisions, kept testable.
 */

/** A report not yet sent, with the id that makes a resend count once (worker/report-box.ts). */
export interface WaitingReport {
	sendId: string;
	draft: ReportDraft;
	savedAt: number;
}

/** A report this device sent: its number, or none when the Worker refused it. */
export interface SentReport {
	sendId: string;
	title: string;
	at: number;
	id?: number;
}

export interface StoredOutbox {
	version: 1;
	waiting: WaitingReport[];
	sent: SentReport[];
}

/** How many sent reports the list keeps; older ones are dropped. */
export const MAX_SENT = 20;

export const emptyOutbox = (): StoredOutbox => ({ version: 1, waiting: [], sent: [] });

function isWaiting(value: unknown): value is WaitingReport {
	if (typeof value !== 'object' || value === null) return false;
	const entry = value as Partial<WaitingReport>;
	const draft = entry.draft as Partial<ReportDraft> | undefined;
	return (
		isSendId(entry.sendId) &&
		typeof entry.savedAt === 'number' &&
		typeof draft === 'object' &&
		draft !== null &&
		isReportKind(draft.kind) &&
		typeof draft.title === 'string' &&
		typeof draft.body === 'string'
	);
}

function isSent(value: unknown): value is SentReport {
	if (typeof value !== 'object' || value === null) return false;
	const entry = value as Partial<SentReport>;
	return (
		isSendId(entry.sendId) &&
		typeof entry.title === 'string' &&
		typeof entry.at === 'number' &&
		(entry.id === undefined || typeof entry.id === 'number')
	);
}

/** The stored outbox, or an empty one; damaged entries are dropped, the rest kept. */
export function parseOutbox(raw: unknown): StoredOutbox {
	if (typeof raw !== 'object' || raw === null) return emptyOutbox();
	const stored = raw as Partial<StoredOutbox>;
	if (stored.version !== 1) return emptyOutbox();
	return {
		version: 1,
		waiting: Array.isArray(stored.waiting) ? stored.waiting.filter(isWaiting) : [],
		sent: Array.isArray(stored.sent) ? stored.sent.filter(isSent).slice(0, MAX_SENT) : []
	};
}

/**
 * Whether a failed send should stay saved and be tried again: no connection (fetch throws),
 * a timeout, too many sends, or a Worker error. Anything else the Worker refused would be
 * refused again.
 */
export function sendLater(error: unknown): boolean {
	if (!(error instanceof ReportRefused)) return true;
	return error.status === 408 || error.status === 429 || error.status >= 500;
}

/** `outbox` with the waiting report `sendId` moved to the sent list, newest first. */
export function markSent(outbox: StoredOutbox, sendId: string, id: number | undefined, at: number) {
	const entry = outbox.waiting.find((w) => w.sendId === sendId);
	if (!entry) return outbox;
	const sent: SentReport = {
		sendId,
		title: entry.draft.title,
		at,
		...(id === undefined ? {} : { id })
	};
	return {
		version: 1,
		waiting: outbox.waiting.filter((w) => w.sendId !== sendId),
		sent: [sent, ...outbox.sent.filter((s) => s.sendId !== sendId)].slice(0, MAX_SENT)
	} satisfies StoredOutbox;
}
