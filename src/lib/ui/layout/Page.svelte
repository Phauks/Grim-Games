<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** The page's one `<h1>`; every page has one, so screen readers can find it. */
		title: string;
		/** Keeps the title for screen readers only (the blank Home page). */
		hideTitle?: boolean;
		/** `page`: the window's width up to --page-max. `text`: running text at --measure. */
		width?: 'page' | 'text';
		/** Buttons at the end of the title row. */
		actions?: Snippet;
		/** One muted line under the title (an author, a date, the script in play). */
		subtitle?: Snippet;
		/** One row under the title for search, filters and view switches. */
		toolbar?: Snippet;
		/**
		 * A column beside the content on a computer window (counts, players, the check),
		 * sticky below the app header; above the content on phones and tablets.
		 */
		side?: Snippet;
		/** The content lays out in --measure wide columns, as many as fit (Account). */
		columns?: boolean;
		children: Snippet;
	}

	let {
		title,
		hideTitle = false,
		width = 'page',
		actions,
		subtitle,
		toolbar,
		side,
		columns = false,
		children
	}: Props = $props();
</script>

<!--
	The frame of every page reached from the sidebar (Trevor, 2026-10-17): one width and gutter,
	the title row with its actions at the end, then an optional toolbar, then the content.
	No Back button: the sidebar navigates. Overlays (dialogs, sheets) go beside it, not inside.
-->
<main class="page" data-width={width}>
	<header class="head" class:visually-hidden={hideTitle}>
		<div class="title-row">
			<h1>{title}</h1>
			{#if actions}<div class="actions">{@render actions()}</div>{/if}
		</div>
		{#if subtitle}<p class="subtitle">{@render subtitle()}</p>{/if}
	</header>
	{#if toolbar}<div class="toolbar">{@render toolbar()}</div>{/if}
	{#if side}
		<div class="split">
			<div class="side">{@render side()}</div>
			<div class="content" class:columns>{@render children()}</div>
		</div>
	{:else}
		<div class="content" class:columns>{@render children()}</div>
	{/if}
</main>

<style>
	.page {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-4);
		max-width: var(--page-max);
		margin: 0 auto;
		padding: var(--space-5) var(--page-gutter) var(--space-6);
	}
	.page[data-width='text'] {
		max-width: calc(var(--measure) + 2 * var(--page-gutter));
	}
	.head {
		display: grid;
		gap: var(--space-1);
	}
	/* The actions stay at the end of the title's row on every screen; a long title wraps. */
	.title-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-3);
	}
	h1 {
		margin: 0;
		font-size: var(--page-title-size);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		align-items: center;
		gap: var(--space-2);
	}
	.subtitle {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.toolbar > :global(*) {
		min-width: 0;
	}
	.content {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: var(--space-5);
	}
	.content > :global(*) {
		min-width: 0;
	}
	.content.columns {
		grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--measure)), 1fr));
	}
	.split {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-4);
	}
	.side {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: var(--space-2);
	}
	/* A computer window: the side column stays in view beside the content. */
	@media (min-width: 75rem) {
		.split {
			grid-template-columns: calc(28 * var(--u)) minmax(0, 1fr);
			align-items: start;
			gap: var(--space-5);
		}
		.side {
			position: sticky;
			/* Just below the app header, which is sticky too. */
			top: calc(var(--tap-target) + env(safe-area-inset-top));
			max-height: calc(100dvh - var(--tap-target) - env(safe-area-inset-top));
			overflow-y: auto;
			padding-bottom: var(--space-4);
		}
	}
</style>
