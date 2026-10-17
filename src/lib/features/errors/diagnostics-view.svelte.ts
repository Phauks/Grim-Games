import { collectDiagnostics } from './collect-diagnostics.svelte.ts';
import type { Diagnostics } from './diagnostics.ts';

/** The snapshot the Diagnostics section shows, shared by the panel and the Refresh icon beside its heading. */
export const diagnosticsView = $state<{ current?: Diagnostics }>({});

export async function refreshDiagnostics(): Promise<void> {
	diagnosticsView.current = await collectDiagnostics();
}
