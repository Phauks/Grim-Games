import { isMissingBuildFile, staleBuild } from '#lib/features/offline/stale-build.svelte.ts';
import { readParsed, writeStored } from '#lib/ui/stored.ts';
import {
	describeThrown,
	isBenignBrowserError,
	errorKey,
	parseErrorLog,
	recordError,
	type AppError
} from './app-error.ts';
import { hasBuiltFrames, resolveBuiltStack } from './source-stack.ts';

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
	/** The page it happened on, when not the one showing: a navigation's destination. */
	page?: string;
}

function read(): AppError[] {
	return readParsed(STORAGE_KEY, (raw) => parseErrorLog(raw, MAX_LOGGED));
}

function write(log: AppError[]): void {
	// Storage full or blocked: the log still works for this visit.
	writeStored(STORAGE_KEY, log);
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

	report(
		error: unknown,
		{ area, notify = true, handled = true, page = currentPage() }: ReportOptions
	): AppError {
		const now = Date.now();
		const { name, message } = describeThrown(error);
		const index = this.entries.findIndex((e) => e.key === errorKey(area, name, message));
		const entry = recordError(
			error,
			{ area, page, handled, now },
			index >= 0 ? this.entries[index] : undefined
		);
		this.entries = [entry, ...this.entries.filter((_, i) => i !== index)].slice(0, MAX_LOGGED);
		if (notify && !this.unseen.includes(entry.key)) this.unseen = [entry.key, ...this.unseen];
		write($state.snapshot(this.entries));
		void this.resolveStacks();
		return entry;
	}

	/**
	 * Points the stacks still in minified build files at the source they came from
	 * (source-stack.ts). Run when a problem is logged and again before its details are read,
	 * for anything an earlier try couldn't reach. Never throws.
	 */
	async resolveStacks(): Promise<void> {
		const pending = this.entries.filter((e) => hasBuiltFrames(e.stack));
		if (pending.length === 0) return;
		const resolved: Record<string, string> = {};
		for (const { stack } of pending) {
			if (!stack) continue;
			const source = await resolveBuiltStack(stack);
			if (source !== stack) resolved[stack] = source;
		}
		if (Object.keys(resolved).length === 0) return;
		// Entries may have changed while the maps loaded; only the stacks that were read change.
		this.entries = this.entries.map((e) =>
			e.stack && Object.hasOwn(resolved, e.stack) ? { ...e, stack: resolved[e.stack] } : e
		);
		write($state.snapshot(this.entries));
	}

	/** Hides the corner card; the log keeps everything. */
	dismiss(): void {
		this.unseen = [];
	}

	showDetails(): void {
		this.open = true;
		this.unseen = [];
		void this.resolveStacks();
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
		if (isMissingBuildFile(event.error ?? event.message)) return staleBuild.mark();
		errorLog.report(event.error ?? event.message, { area: 'app', handled: false });
	});
	window.addEventListener('unhandledrejection', (event) => {
		// A lazily loaded part of a build a newer one replaced (stale-build.svelte.ts).
		if (isMissingBuildFile(event.reason)) return staleBuild.mark();
		errorLog.report(event.reason, { area: 'app', handled: false });
	});
}
