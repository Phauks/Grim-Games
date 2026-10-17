<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';

	/**
	 * Who wrote the script and which version it is (Trevor, 2026-10-17). Either is left out
	 * when the script doesn't say; nothing shows when neither is known.
	 */
	interface Props {
		author?: string;
		version?: string;
	}

	let { author, version }: Props = $props();
	const parts = $derived(
		[
			author?.trim() ? t('player.byAuthor', { author: author.trim() }) : undefined,
			version?.trim() ? t('player.version', { version: version.trim() }) : undefined
		].filter((p) => p !== undefined)
	);
</script>

{#if parts.length}
	<p class="byline" data-testid="script-byline">{parts.join(' · ')}</p>
{/if}

<style>
	.byline {
		margin: 0 0 var(--space-3);
		color: var(--on-surface-muted);
	}
</style>
