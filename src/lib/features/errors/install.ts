import { mount } from 'svelte';
import ReportDialog from '#lib/features/reports/ReportDialog.svelte';
import { reportOutbox } from '#lib/features/reports/outbox.svelte.ts';
import ErrorNotice from './ErrorNotice.svelte';
import { installGlobalErrorHandlers } from './report.svelte.ts';

let installed = false;

/**
 * Starts error reporting before the app renders (from `src/hooks.client.ts`). The corner card
 * is mounted on its own, outside the root layout, so it still appears if the layout itself
 * fails to render; so is the Report form.
 */
export function installErrorReporting(): void {
	if (installed) return;
	installed = true;
	installGlobalErrorHandlers();
	mount(ErrorNotice, { target: document.body });
	mount(ReportDialog, { target: document.body });
	// Reports saved while offline go as soon as the app opens online, or the connection returns.
	reportOutbox.start();
}
