import { APP_NAME } from '#lib/core/app-name.ts';
import type { MessageKey } from '#lib/i18n/catalog.ts';
import { errorDetails, scrubUrls, type AppError } from './app-error.ts';

/**
 * Diagnostics: a snapshot of this device and build, gathered only when the Diagnostics page
 * is opened and never sent anywhere by the app. It never holds player names, notes, scripts,
 * games, room codes or keys, and URLs lose their query string and hash (`scrubUrls`).
 */
export interface DiagnosticRow {
	label: MessageKey;
	value: string;
	/** External page the value links to, e.g. the commit on GitHub. */
	href?: string;
}

export interface DiagnosticSection {
	id: string;
	title: MessageKey;
	rows: DiagnosticRow[];
}

export interface Diagnostics {
	sections: DiagnosticSection[];
	problems: AppError[];
	gatheredAt: number;
}

type Read = () => string | undefined;
const sources = new Map<MessageKey, Read>();

/**
 * Lets a feature add one line to the Live room section, read when the page is opened, e.g.
 * `setDiagnostic('errors.diag.roomStatus', () => socket?.status)`. Return `undefined` when
 * there is nothing to say. Never return names, codes or other game state.
 */
export function setDiagnostic(label: MessageKey, read: Read): () => void {
	sources.set(label, read);
	return () => {
		if (sources.get(label) === read) sources.delete(label);
	};
}

export function registeredRows(): DiagnosticRow[] {
	const rows: DiagnosticRow[] = [];
	for (const [label, read] of sources) {
		try {
			const value = read();
			if (value !== undefined) rows.push({ label, value: scrubUrls(value) });
		} catch {
			// A broken source must not break the page.
		}
	}
	return rows;
}

/** The whole snapshot as plain text, with labels from `label` (the current language). */
export function diagnosticsText(
	diagnostics: Diagnostics,
	label: (key: MessageKey) => string
): string {
	const lines = [`${APP_NAME} diagnostics · ${new Date(diagnostics.gatheredAt).toISOString()}`];
	for (const section of diagnostics.sections) {
		lines.push('', `## ${label(section.title)}`);
		for (const row of section.rows) lines.push(`${label(row.label)}: ${row.value}`);
	}
	lines.push('', `## ${label('errors.diag.problems')} (${diagnostics.problems.length})`);
	for (const problem of diagnostics.problems) lines.push('', errorDetails(problem));
	return lines.join('\n');
}

/** File name for the download, in UTC, e.g. `grim-games-diagnostics-2026-10-16-231502.txt`. */
export function diagnosticsFileName(gatheredAt: number): string {
	const iso = new Date(gatheredAt).toISOString();
	return `grim-games-diagnostics-${iso.slice(0, 10)}-${iso.slice(11, 19).replaceAll(':', '')}.txt`;
}

/** Bytes as MB with one decimal (or KB below 1 MB), for the Storage section. */
export function formatBytes(bytes: number | null | undefined): string {
	if (bytes === null || bytes === undefined) return '?';
	return bytes >= 1_000_000
		? `${(bytes / 1_000_000).toFixed(1)} MB`
		: `${Math.round(bytes / 1000)} KB`;
}
