import type { MessageKey } from '#lib/i18n/catalog.ts';
import type { Report } from './reports-protocol.ts';

/**
 * Reports as Markdown, to hand off (Trevor, 2026-10-27: "make it easier for me to export
 * reports so I can hand them off to you"): one report from its dialog, or every report the
 * inbox shows, in one file. Only what the reader may see is there; the Worker already left out
 * the rest (worker/reports.ts). Labels come in as `label`, so this stays testable without the
 * app's locale.
 */

export interface ExportedReport {
	report: Report;
	/** Who sent it, as the inbox shows it. */
	reporter: string;
	/** The script it was sent with, as TPI's JSON, when there is one and it could be fetched. */
	script?: unknown[];
}

type Label = (key: MessageKey) => string;

/** A code fence longer than any run of backticks in `text`, so the text can't close it. */
function fence(text: string): string {
	const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
	return '`'.repeat(Math.max(3, longest + 1));
}

function block(text: string, language = ''): string {
	const f = fence(text);
	return `${f}${language}\n${text}\n${f}`;
}

/** One report: a heading, the facts as a list, then its text, details and script. */
export function reportMarkdown({ report, reporter, script }: ExportedReport, label: Label): string {
	const facts: [string, string | undefined][] = [
		[label('reports.kind'), label(`reports.kind.${report.kind}`)],
		[label('reports.status'), label(`reports.status.${report.status}`)],
		[label('reports.sentAt'), new Date(report.createdAt).toISOString()],
		[label('reports.reporter'), reporter],
		[label('reports.contact'), report.contact],
		[label('reports.page'), report.page],
		[label('reports.build'), report.build],
		[label('reports.device'), report.device],
		[label('reports.script'), report.hasScript ? report.scriptName || '✓' : undefined]
	];
	const parts = [
		`## #${report.id} ${report.title}`,
		facts
			.filter((fact): fact is [string, string] => !!fact[1])
			.map(([name, value]) => `- ${name}: ${value}`)
			.join('\n'),
		`### ${label('reports.body')}`,
		block(report.body)
	];
	if (report.details) parts.push(`### ${label('reports.details')}`, block(report.details));
	if (script) parts.push(`### ${label('reports.script')}`, block(JSON.stringify(script), 'json'));
	return parts.join('\n\n');
}

/** Several reports in one document, newest first as the inbox lists them. */
export function reportsMarkdown(
	reports: readonly ExportedReport[],
	label: Label,
	exportedAt: number
): string {
	const heading = `# ${label('reports.inbox')} (${reports.length}), ${new Date(exportedAt).toISOString()}`;
	return [heading, ...reports.map((r) => reportMarkdown(r, label))].join('\n\n---\n\n') + '\n';
}

/** `reports-2026-10-27.md`. */
export function reportsFileName(exportedAt: number): string {
	return `reports-${new Date(exportedAt).toISOString().slice(0, 10)}.md`;
}

/** `report-12.md`. */
export function reportFileName(id: number): string {
	return `report-${id}.md`;
}
