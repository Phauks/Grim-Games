import { readStored, writeStored } from '#lib/ui/stored.ts';
import { markSent, parseOutbox, sendLater, type StoredOutbox } from './outbox.ts';
import { sendReport } from './reports-api.ts';
import type { ReportDraft } from './reports-protocol.ts';

const STORAGE_KEY = 'grim-games:report-outbox';
/** One tab sends at a time, so two open tabs don't race on the same saved report. */
const LOCK = 'grim-games:report-outbox';
/** While reports wait, sending is tried again this often, besides when the browser says online. */
const RETRY_MS = 30_000;

export type SendResult =
	{ status: 'sent'; id: number } | { status: 'waiting'; sendId: string } | { status: 'refused' };

/**
 * The reports this device has saved to send and has sent (Trevor, 2026-10-27). A report is
 * saved before it is sent, so it survives no connection, a dropped answer, or the app being
 * closed; it goes when the app is open and online again. Each carries a send id, so a resend
 * of one the Worker already has is stored once (worker/report-box.ts).
 */
export class ReportOutbox {
	#stored = $state.raw<StoredOutbox>(parseOutbox(readStored(STORAGE_KEY)));
	#flushing: Promise<void> | undefined;
	#retry: ReturnType<typeof setTimeout> | undefined;
	#started = false;

	get waiting() {
		return this.#stored.waiting;
	}

	get sent() {
		return this.#stored.sent;
	}

	/** Sends what an earlier visit left waiting, and again whenever the connection returns. */
	start(): void {
		if (this.#started || typeof window === 'undefined') return;
		this.#started = true;
		window.addEventListener('online', () => void this.flush());
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') void this.flush();
		});
		// Another tab saved or sent one.
		window.addEventListener('storage', (event) => {
			if (event.key === STORAGE_KEY) this.#reload();
		});
		void this.flush();
	}

	/** Saves the report on this device, then tries to send it now. */
	async send(draft: ReportDraft): Promise<SendResult> {
		const sendId = crypto.randomUUID();
		this.#reload();
		const saved = this.#write({
			...this.#stored,
			waiting: [...this.#stored.waiting, { sendId, draft, savedAt: Date.now() }]
		});
		// Storage full or blocked: another tab's copy would drop it, so it goes now or not at all.
		if (!saved) return this.#sendUnsaved(sendId, draft);
		await this.flush();
		// A flush already running may have missed it: one more pass picks it up.
		if (this.#stored.waiting.some((w) => w.sendId === sendId)) await this.flush();
		if (this.#stored.waiting.some((w) => w.sendId === sendId)) return { status: 'waiting', sendId };
		const sent = this.#stored.sent.find((s) => s.sendId === sendId);
		if (sent?.id !== undefined) return { status: 'sent', id: sent.id };
		// Refused while the form is still open: the form says so and keeps the text, so the
		// list needn't.
		this.#write({ ...this.#stored, sent: this.#stored.sent.filter((s) => s.sendId !== sendId) });
		return { status: 'refused' };
	}

	async #sendUnsaved(sendId: string, draft: ReportDraft): Promise<SendResult> {
		this.#stored = {
			...this.#stored,
			waiting: this.#stored.waiting.filter((w) => w.sendId !== sendId)
		};
		try {
			return { status: 'sent', id: await sendReport({ ...draft, sendId }) };
		} catch {
			return { status: 'refused' };
		}
	}

	/** Sends every waiting report, oldest first, stopping at the first that has to wait. */
	flush(): Promise<void> {
		this.#flushing ??= this.#flushAll().finally(() => (this.#flushing = undefined));
		return this.#flushing;
	}

	async #flushAll(): Promise<void> {
		clearTimeout(this.#retry);
		const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
		const run = () => this.#sendWaiting();
		const done = locks ? await locks.request(LOCK, run) : await run();
		if (!done || this.#stored.waiting.length > 0) {
			this.#retry = setTimeout(() => void this.flush(), RETRY_MS);
		}
	}

	/** True when nothing is left waiting that could be sent now. */
	async #sendWaiting(): Promise<boolean> {
		const tried: string[] = [];
		for (;;) {
			this.#reload();
			const next = this.#stored.waiting.find((w) => !tried.includes(w.sendId));
			if (!next) return true;
			tried.push(next.sendId);
			let id: number | undefined;
			try {
				id = await sendReport({ ...next.draft, sendId: next.sendId });
			} catch (error) {
				if (sendLater(error)) return false;
			}
			this.#reload();
			this.#write(markSent(this.#stored, next.sendId, id, Date.now()));
		}
	}

	/** Takes up what another tab wrote. Storage blocked: keeps this tab's own copy. */
	#reload(): void {
		const raw = readStored(STORAGE_KEY);
		if (raw !== undefined) this.#stored = parseOutbox(raw);
	}

	/** Stored when storage allows; otherwise it is still sent while this tab stays open. */
	#write(outbox: StoredOutbox): boolean {
		this.#stored = outbox;
		return writeStored(STORAGE_KEY, outbox);
	}
}

export const reportOutbox = new ReportOutbox();
