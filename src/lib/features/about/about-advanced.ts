import { rememberOpen } from '#lib/ui/primitives/Collapsible.svelte';

/** Where About's Advanced part (the diagnostics) remembers being open. */
export const ADVANCED_KEY = 'settings-about-advanced';

/** Opens About's Advanced part next time the About page shows: the old Diagnostics place. */
export function openAdvancedNextTime(): void {
	rememberOpen(ADVANCED_KEY);
}
