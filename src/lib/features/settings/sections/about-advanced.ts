import { rememberOpen } from '#lib/ui/primitives/Collapsible.svelte';
import { settingsDialog } from '../settings-dialog.svelte.ts';

/** Where About's Advanced part (the diagnostics) remembers being open. */
export const ADVANCED_KEY = 'settings-about-advanced';

/** Opens Settings at About with Advanced open: the old Diagnostics section's place. */
export function showDiagnostics(): void {
	rememberOpen(ADVANCED_KEY);
	settingsDialog.show('about');
}
