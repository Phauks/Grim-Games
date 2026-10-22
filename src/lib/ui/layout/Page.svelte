<script lang="ts">
	import type { Snippet } from 'svelte';
	import NavMenuButton from '#lib/features/shell/NavMenuButton.svelte';
	import { navDrawer } from '#lib/features/shell/nav-drawer.svelte.ts';

	interface Props {
		/** The page's one `<h1>`; every page has one, so screen readers can find it. */
		title: string;
		/** Keeps the title for screen readers only (the blank Home page). */
		hideTitle?: boolean;
		/** Before the title, in the same heading (the locked draw's script logo). */
		lead?: Snippet;
		/** `page`: the window's width up to --page-max. `text`: running text at --measure. */
		width?: 'page' | 'text';
		/** Buttons at the end of the title row; on a narrow page, in their own row under it. */
		actions?: Snippet;
		/**
		 * The actions are a few icon buttons, small enough to stay at the end of the title's row
		 * at every width (Trevor, 2026-10-19: the bag's cog and Share beside "Draw").
		 */
		iconActions?: boolean;
		/**
		 * Before the heading, on its line and outside it, in place of the hamburger the app's
		 * pages put there (Player view mounts its own, as the board has; 2026-10-19).
		 */
		start?: Snippet;
		/** One muted line under the title (an author, a date, the script in play). */
		subtitle?: Snippet;
		/** One row under the title for search, filters and view switches. */
		toolbar?: Snippet;
		/**
		 * A column beside the content on a computer window (counts, players, the check),
		 * sticky at the top of the screen; above the content on phones and tablets.
		 */
		side?: Snippet;
		/**
		 * Phones and tablets: the side's pieces join the page's flow instead of sitting in one
		 * block, so a sticky piece (setup's counts and search) stays in view while the content
		 * scrolls under it.
		 */
		sideFlow?: boolean;
		/** The content lays out in two columns on a wide computer window (Account). */
		columns?: boolean;
		children: Snippet;
	}

	let {
		title,
		hideTitle = false,
		lead,
		width = 'page',
		actions,
		iconActions = false,
		start,
		subtitle,
		toolbar,
		side,
		sideFlow = false,
		columns = false,
		children
	}: Props = $props();

	// Before the title: the page's own `start`, else the hamburger while no sidebar shows
	// (phones, tablets, a closed sidebar), since there is no app header (2026-10-22).
	const before = $derived(start ?? (navDrawer.pageButton ? menuButton : undefined));
</script>

{#snippet menuButton()}<NavMenuButton />{/snippet}

<!--
	The frame of every page reached from the sidebar (Trevor, 2026-10-17): one width and gutter,
	the title row with its actions at the end (under the title on a phone), then an optional
	toolbar, then the content.
	No Back button: the sidebar navigates. Overlays (dialogs, sheets) go beside it, not inside.
-->
<main class="page" data-width={width}>
	{#if hideTitle && before}<div class="start">{@render before()}</div>{/if}
	<header class="head" class:visually-hidden={hideTitle}>
		<div class="title-row" data-icon-actions={iconActions ? '' : undefined}>
			{#if before && !hideTitle}
				<div class="start">
					{@render before()}
					<h1>
						{#if lead}{@render lead()}{/if}{title}
					</h1>
				</div>
			{:else}
				<h1>
					{#if lead}{@render lead()}{/if}{title}
				</h1>
			{/if}
			{#if actions}<div class="actions">{@render actions()}</div>{/if}
		</div>
		{#if subtitle}<p class="subtitle">{@render subtitle()}</p>{/if}
	</header>
	{#if toolbar}<div class="toolbar">{@render toolbar()}</div>{/if}
	{#if side}
		<div class="split" data-side-flow={sideFlow ? '' : undefined}>
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
		container: page-head / inline-size;
	}
	/*
	 * A narrow page (phones): the actions get their own row under the title, so a wide button
	 * can never squeeze the title into a column that breaks its words. Decided by the page's
	 * width alone, never by how wide the buttons happen to be.
	 */
	.title-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-2);
	}
	h1 {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		margin: 0;
		font-size: var(--page-title-size);
		/* The narrowest phone at the largest text, with the hamburger beside it: a long title
		   breaks (hyphenated where the browser can) rather than push the page sideways. */
		overflow-wrap: anywhere;
		hyphens: auto;
	}
	.start {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.title-row[data-icon-actions] {
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
	}
	.title-row[data-icon-actions] .actions {
		flex-wrap: nowrap;
		justify-content: flex-end;
	}
	/* Wider pages: the actions sit at the end of the title's row; the title keeps 20u at least. */
	@container page-head (min-width: 36rem) {
		.title-row {
			grid-template-columns: minmax(calc(20 * var(--u)), 1fr) minmax(0, auto);
			align-items: center;
			gap: var(--space-3);
		}
		.actions {
			justify-content: flex-end;
		}
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
	/*
	 * Two columns once the window has room for both beside an open sidebar (14u), so opening
	 * or closing the sidebar never moves sections between one and two columns (Trevor,
	 * 2026-10-18: Account looked different after toggling it). Decided by the window, not
	 * by the room the sidebar leaves. Each section starts at the top of its row.
	 */
	@media (min-width: 94rem) {
		.content.columns {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			align-items: start;
		}
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
	@media (max-width: 74.99rem) {
		[data-side-flow] > .side {
			display: contents;
		}
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
			/* Just under the phone's status bar. */
			top: calc(var(--app-top) + var(--space-2));
			max-height: calc(100dvh - var(--app-top) - var(--space-4));
			overflow-y: auto;
			padding-bottom: var(--space-4);
		}
	}
</style>
