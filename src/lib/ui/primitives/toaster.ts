import { createToaster } from '@ark-ui/svelte/toast';

/** The app's one toast queue; render `<Toaster />` once in the root layout. */
export const toaster = createToaster({ placement: 'bottom', overlap: false, gap: 8, max: 3 });

export function toast(title: string, description?: string): void {
	toaster.create({ title, description, type: 'info', duration: 3000 });
}
