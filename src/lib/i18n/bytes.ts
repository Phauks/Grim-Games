import { intl } from './locale.svelte.ts';

/**
 * A size in the reader's locale: megabytes to one decimal from 0.1 MB, kilobytes below
 * (Settings > Data, the update download in About).
 */
export function formatBytes(bytes: number): string {
	const mb = bytes / 1_000_000;
	return mb >= 0.1
		? intl.number(mb, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 })
		: intl.number(bytes / 1000, { style: 'unit', unit: 'kilobyte', maximumFractionDigits: 0 });
}
