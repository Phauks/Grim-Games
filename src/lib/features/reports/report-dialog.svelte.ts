import type { ReportKind } from './reports-protocol.ts';

export interface ReportStart {
	kind?: ReportKind;
	title?: string;
	/** Problem details or diagnostics, shown in the form and sent only if the person keeps them. */
	details?: string;
}

/** Opens the one Report form (ReportDialog, mounted by errors/install.ts) from anywhere. */
class ReportDialogState {
	open = $state(false);
	start = $state<ReportStart>({});
	/** Bumped on every show, so the form resets even when opened twice the same way. */
	opened = $state(0);

	show(start: ReportStart = {}): void {
		this.start = start;
		this.opened++;
		this.open = true;
	}
}

export const reportDialog = new ReportDialogState();
