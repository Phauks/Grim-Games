import {
	describeThrown,
	isBenignBrowserError,
	errorKey,
	parseErrorLog,
	recordError,
	type AppError
} from './app-error.ts';

const STORAGE_KEY = 'grim-games:error-log:v1';
/** Most recent distinct problems kept on the device. */
export const MAX_LOGGED = 20;

export interface ReportOptions {
	/** Where in the app it happened: a short fixed label such as `grimoire` or `scripts`. */
	area: string;
	/**
	 * Show the corner card. Default `true`. Pass `false` when your feature already tells the
	 * person what went wrong (an inline "Couldn't load" state), so it is only logged.
	 */
	notify?: boolean;
	/** Set by the global handlers for errors nothing caught. */
	handled?: boolean;
}

function read(): AppError[] {
	try {
		const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
		return parseErrorLog(raw ? JSON.parse(raw) : null, MAX_LOGGED);
	} catch {
		return [];
	}
}

function write(log: AppError[]): void {
	try {
		globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(log));
	} catch {
		// Storage full or blocked: the log still works for this visit.
	}
}

function currentPage(): string {
	return globalThis.location?.pathname ?? '/';
}

/**
 * The device's error log, newest first. It never leaves the device: reporting is a
 * prefilled GitHub issue the person chooses to open from the details dialog.
 */
class ErrorLog {
	/** Kept across reloads, so a crash can still be reported after reopening the app. */
	entries = $state<AppError[]>(read());
	/** Keys of problems from this visit the person hasn't dismissed (the corner card). */
	unseen = $state<string[]>([]);
	/** The details dialog. */
	open = $state(false);

	report(error: unknown, { area, notify = true, handled = true }: ReportOptions): AppError {
		const now = Date.now();
		const { name, message } = describeThrown(error);
		const index = this.entries.findIndex((e) => e.key === errorKey(area, name, message));
		const entry = recordError(
			error,
			{ area, page: currentPage(), handled, now },
			index >= 0 ? this.entries[index] : undefined
		);
		this.entries = [entry, ...this.entries.filter((_, i) => i !== index)].slice(0, MAX_LOGGED);
		if (notify && !this.unseen.includes(entry.key)) this.unseen = [entry.key, ...this.unseen];
		write($state.snapshot(this.entries));
		return entry;
	}

	/** Hides the corner card; the log keeps everything. */
	dismiss(): void {
		this.unseen = [];
	}

	showDetails(): void {
		this.open = true;
		this.unseen = [];
	}

	clear(): void {
		this.entries = [];
		this.unseen = [];
		write([]);
	}
}

export const errorLog = new ErrorLog();

/**
 * Records a problem on this device and, unless `notify: false`, shows the small corner card
 * (never a modal, so it can't interrupt a game). Never throws.
 *
 * ```ts
 * try { await loadScript(id); }
 * catch (e) { reportError(e, { area: 'scripts' }); }
 * ```
 *
 * Don't report expected outcomes, such as an engine command that returns `{ ok: false }`;
 * show those with `toast()`. Don't put player names, scripts or other game state in the
 * messages of errors you throw: messages can end up in a GitHub issue.
 */
export function reportError(error: unknown, options: ReportOptions): AppError | undefined {
	try {
		// Keep the original in the console, with its full stack, for anyone debugging.
		console.error(`[${options.area}]`, error);
		return errorLog.report(error, options);
	} catch {
		// Reporting must never become a second failure.
		return undefined;
	}
}

let installed = false;

/** Catches whatever nothing else caught. Called once from `src/hooks.client.ts`. */
export function installGlobalErrorHandlers(): void {
	if (installed || typeof window === 'undefined') return;
	installed = true;
	window.addEventListener('error', (event) => {
		// Failed <img>/<script> loads also fire `error` but without an Error; skip those.
		if (!(event.error instanceof Error) && !event.message) return;
		if (isBenignBrowserError(event.message)) return;
		errorLog.report(event.error ?? event.message, { area: 'app', handled: false });
	});
	window.addEventListener('unhandledrejection', (event) => {
		errorLog.report(event.reason, { area: 'app', handled: false });
	});
}
