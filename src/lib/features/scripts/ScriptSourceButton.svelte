<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';

	/**
	 * Opens a script at its source page in a new tab (Trevor, 2026-10-22 New game, 2026-10-23
	 * Search). Kept in place, disabled, when there is no page; its label then names the source,
	 * such as the file name, when there is one.
	 */
	interface Props {
		/** The script's own page where it came from (`sourcePage`). */
		page?: string;
		/** Where it came from in words (`describeSource`), for a source without a page. */
		source?: string;
	}

	let { page, source }: Props = $props();
</script>

{#if page}
	<IconButton
		icon="openInNewTab"
		label={t('scripts.openSource')}
		href={page}
		rel="noopener noreferrer"
	/>
{:else}
	<IconButton
		icon="openInNewTab"
		label={source ? t('scripts.noSourcePage', { source }) : t('scripts.openSource')}
		disabled
	/>
{/if}
