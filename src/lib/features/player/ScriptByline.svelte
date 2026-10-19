<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';

	/**
	 * Who wrote the script and which version it is (Trevor, 2026-10-17), and in a game who
	 * the Storyteller is. Each is left out when unknown; nothing shows when none is.
	 */
	interface Props {
		author?: string;
		version?: string;
		/** Who is running the game, when the script is a game's (Trevor, 2026-10-19). */
		storyteller?: string;
		/** A span, for a line that is already a paragraph (a Page subtitle). */
		inline?: boolean;
	}

	let { author, version, storyteller, inline = false }: Props = $props();
	const parts = $derived(
		[
			author?.trim() ? t('player.byAuthor', { author: author.trim() }) : undefined,
			version?.trim() ? t('player.version', { version: version.trim() }) : undefined,
			storyteller?.trim() ? t('player.storytellerIs', { name: storyteller.trim() }) : undefined
		].filter((p) => p !== undefined)
	);
</script>

{#if parts.length}
	<svelte:element this={inline ? 'span' : 'p'} class="byline" data-testid="script-byline"
		>{parts.join(' · ')}</svelte:element
	>
{/if}

<style>
	p.byline {
		margin: 0 0 var(--space-3);
	}
	.byline {
		color: var(--on-surface-muted);
	}
</style>
