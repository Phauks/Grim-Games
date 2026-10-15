import { mount } from 'svelte';
import ErrorNotice from './ErrorNotice.svelte';
import { installGlobalErrorHandlers } from './report.svelte.ts';

let installed = false;

/**
 * Starts error reporting before the app renders (from `src/hooks.client.ts`). The corner card
 * is mounted on its own, outside the root layout, so it still appears if the layout itself
 * fails to render.
 */
export function installErrorReporting(): void {
	if (installed) return;
	installed = true;
	installGlobalErrorHandlers();
	mount(ErrorNotice, { target: document.body });
}
