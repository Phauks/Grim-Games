/**
 * Opens the Report form as a bug report with this device's diagnostics attached, gathering
 * them first when nothing has yet. The sidebar's and the board menu's Report an issue use it,
 * and a script's own (ReportButton, with `start`); the person can still remove the details
 * before sending.
 */
import { diagnosticsText } from './diagnostics.ts';
import { diagnosticsView, refreshDiagnostics } from './diagnostics-view.svelte.ts';
import { reportDialog, type ReportStart } from '#lib/features/reports/report-dialog.svelte.ts';
import type { MessageKey } from '#lib/i18n/catalog.ts';
import { t } from '#lib/i18n/locale.svelte.ts';

export async function reportWithDiagnostics(
	start: Omit<ReportStart, 'details'> = {}
): Promise<void> {
	if (!diagnosticsView.current) await refreshDiagnostics();
	const diagnostics = diagnosticsView.current;
	const label = (key: MessageKey) => (t as (key: MessageKey) => string)(key);
	reportDialog.show({
		kind: 'bug',
		...start,
		details: diagnostics ? diagnosticsText(diagnostics, label) : undefined
	});
}
