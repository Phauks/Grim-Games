<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import PageMenuButton from '#lib/features/shell/PageMenuButton.svelte';
	import { navDrawer } from '#lib/features/shell/nav-drawer.svelte.ts';
	import { fitWords } from '#lib/ui/fit-words.ts';
	import { oneRow } from '#lib/ui/one-row.ts';

	interface Props {
		/** The page's one `<h1>`; every page has one, so screen readers can find it. */
		title: string;
		/** Keeps the title for screen readers only (the blank Home page). */
		hideTitle?: boolean;
		/** Before the title, in the same heading (the locked draw's script logo). */
		lead?: Snippet;
		/** Buttons at the end of the title row; on a narrow page, in their own row under it. */
		actions?: Snippet;
		/**
		 * The actions are a few icon buttons, small enough to stay at the end of the title's row
		 * at every width (Trevor, 2026-10-19: the bag's cog and Share beside "Draw").
		 */
		iconActions?: boolean;
		/**
		 * The title on its own line under the action row, so a row of player controls and the
		 * hamburger never squeeze it (Trevor, 2026-10-26: "move the script name down from the
		 * top of player view, still in header area, but lower").
		 */
		titleBelow?: boolean;
		/**
		 * With `titleBelow`: how many buttons the title's row keeps room for, shown or not, so a
		 * button that appears later never moves the title (oneRow).
		 */
		actionSlots?: number;
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
		/** Uses the whole window's width, with no page maximum (the Character Analyzer). */
		wide?: boolean;
		/**
		 * The content fills the rest of the window and scrolls inside itself, so the window
		 * never scrolls and no scrollbar runs down the screen's edge (Trevor, 2026-11-06: the
		 * Library's scrollbar belongs inside the Library).
		 */
		fill?: boolean;
		children: Snippet;
	}

	let {
		title,
		hideTitle = false,
		lead,
		actions,
		iconActions = false,
		titleBelow = false,
		actionSlots,
		subtitle,
		toolbar,
		side,
		sideFlow = false,
		columns = false,
		wide = false,
		fill = false,
		children
	}: Props = $props();

	// Before the title: the page's own `start`, else the hamburger while no sidebar shows
	// (phones, tablets, a closed sidebar), since there is no app header (2026-10-22).
	const showMenu = $derived(navDrawer.pageButton);
	let row = $state<HTMLElement>();
	// A byline with no words yet (the player screen's line kept free for the script's author)
	// stays under the band's line, so every page's band ends after its title or its byline
	// (Trevor, 2026-11-12: B).
	let blankSubtitle = $state(false);
	const watchBlank: Attachment<HTMLElement> = (node) => {
		const check = () => (blankSubtitle = !node.textContent?.trim());
		check();
		const observer = new MutationObserver(check);
		observer.observe(node, { childList: true, subtree: true, characterData: true });
		return () => observer.disconnect();
	};
	// A row of text buttons goes under the band on a phone; icon buttons stay on the title's row.
	const buttonsBelow = $derived(!titleBelow && !iconActions && !!actions);
</script>

<!--
	The frame of every page reached from the sidebar (Trevor, 2026-10-17): one width and gutter
	with no narrower variant, so About and Support match Roadmap and Changelog (Trevor, 2026-10-26);
	the title row with its actions at the end (under the title on a phone), then an optional
	toolbar, then the content.
	No Back button: the sidebar navigates. Overlays (dialogs, sheets) go beside it, not inside.
-->
{#snippet heading()}
	<h1>
		{#if lead}{@render lead()}{/if}<span class="title-text" {@attach fitWords(title)}>{title}</span>
	</h1>
{/snippet}
<main class="page" class:wide class:fill>
	<PageMenuButton />
	<div class="head" class:visually-hidden={hideTitle}>
		<header class="head-grid" class:buttons-below={buttonsBelow}>
			{#if !hideTitle}<span
					class="head-band"
					class:with-subtitle={!!subtitle && !blankSubtitle}
					aria-hidden="true"
				></span>{/if}
			{#if titleBelow}
				<!-- The title on the buttons' row when it fits there at full size, else under them
			     (Trevor, 2026-11-01); the byline under both, across the page. -->
				<div
					class="title-row"
					data-title-below=""
					bind:this={row}
					{@attach oneRow(
						{
							title: () => row?.querySelector('h1'),
							actions: () => row?.querySelector('.actions'),
							others: () => [row?.querySelector('.menu-room')],
							slots: actionSlots
						},
						title,
						showMenu
					)}
				>
					{#if showMenu && !hideTitle}<span class="menu-room" aria-hidden="true"></span>{/if}
					{@render heading()}
					{#if actions}<div class="actions" data-testid="page-actions">
							{@render actions()}
						</div>{/if}
				</div>
			{:else}
				<div class="title-row" data-icon-actions={iconActions ? '' : undefined}>
					{#if showMenu && !hideTitle}
						<div class="start">
							<span class="menu-room" aria-hidden="true"></span>
							{@render heading()}
						</div>
					{:else}
						{@render heading()}
					{/if}
					{#if actions}<div class="actions" data-testid="page-actions">
							{@render actions()}
						</div>{/if}
				</div>
			{/if}
			{#if subtitle}<p class="subtitle" {@attach watchBlank}>{@render subtitle()}</p>{/if}
		</header>
	</div>
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
		/* The title row starts level with the hamburger and the sidebar's name row. */
		padding: var(--menu-inset) var(--page-gutter) var(--space-6);
	}
	.page.wide {
		max-width: none;
	}
	/* The window's height under the status bar, the content taking what the title leaves. */
	.page.fill {
		display: flex;
		flex-direction: column;
		height: calc(100dvh - var(--app-top) - env(safe-area-inset-bottom));
		padding-bottom: var(--space-4);
	}
	.page.fill > .content {
		flex: 1;
		min-height: 0;
		grid-template-rows: minmax(0, 1fr);
		align-content: stretch;
	}
	/* Keeps the title clear of the hamburger, one spacing step after it. */
	.menu-room {
		flex: none;
		width: max(0rem, calc(var(--menu-inset) + var(--tap-target) - var(--page-gutter)));
	}
	.head {
		container: page-head / inline-size;
	}
	/*
	 * The head's parts on one grid, so the band can end after the title or its byline while a
	 * phone's row of text buttons sits under it. Each part names its row: the title's row,
	 * the byline, then (phones) the buttons.
	 */
	.head-grid {
		display: grid;
		grid-template-columns: [full-start] minmax(0, 1fr) [full-end];
	}
	.head-grid > * {
		grid-column: full;
	}
	.title-row {
		grid-row: 1;
	}
	.subtitle {
		grid-row: 2;
		margin: var(--space-1) 0 0;
		color: var(--on-surface-muted);
	}
	/*
	 * The page's title and byline on a raised band with a line along its foot, set apart from
	 * the content as the bottom tab bar is (Trevor, 2026-11-10: C2), the same on every page:
	 * buttons under the title and a byline with no words yet stay below the line (Trevor,
	 * 2026-11-12: B). The band reaches out over the page's top padding, its gutters and half the
	 * gap under it, so nothing moves; it scrolls away with the page. A plain box behind the
	 * parts, not a layer: no stacking context, so a full-screen stage or a menu inside the page
	 * still rises over the status bar's strip, and the hamburger sits over the band.
	 */
	.head-band {
		--band-foot: calc(0.5 * var(--space-4));
		grid-row: 1 / 2;
		align-self: stretch;
		margin: calc(-1 * var(--menu-inset)) calc(-1 * var(--page-gutter)) calc(-1 * var(--band-foot)); /* overlap-ok: the band takes the page's padding and half the gap under it */
		border-bottom: 1px solid var(--border); /* px-ok: a hairline, as the tab bar's */
		background: var(--surface-raised);
	}
	.head-band.with-subtitle {
		grid-row: 1 / 3;
	}
	/* Text buttons: their own row under the band on a phone, a full gap below the title. */
	.buttons-below > .title-row {
		display: contents;
	}
	.buttons-below > .title-row > :global(*) {
		grid-row: 1;
		grid-column: full;
	}
	.buttons-below > .title-row > .actions {
		grid-row: 3;
		margin-top: var(--space-4);
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
		/* As tall as the hamburger, so the two centre on one line. */
		min-height: var(--tap-target);
		margin: 0;
		font-size: var(--page-title-size);
	}
	/* A word never breaks in the middle (2026-10-23): the title shrinks until its longest word
	   fits (fitWords). Only below that, on the narrowest phone at the largest text, does a
	   word break, rather than push the page sideways. */
	.title-text {
		min-width: 0;
		font-size: calc(1em * var(--fit, 1));
		overflow-wrap: break-word;
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
	/* Icon buttons side by side, their tap targets touching: the icons keep the space between
	   them, so six still leave the title its line on a phone (the draw, Trevor 2026-11-06). */
	.title-row[data-icon-actions] .actions {
		gap: 0;
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
		.buttons-below {
			grid-template-columns:
				[full-start] minmax(calc(20 * var(--u)), 1fr)
				minmax(0, auto) [full-end];
			align-items: center;
			column-gap: var(--space-3);
		}
		.buttons-below > .title-row > :global(*) {
			grid-column: 1;
		}
		.buttons-below > .title-row > .actions {
			grid-row: 1;
			grid-column: 2;
			margin-top: 0;
		}
	}
	/*
	 * `titleBelow`: the buttons alone on the first row, level with the hamburger, with the title
	 * under them from the page's edge; or, when the title fits beside them at its full size,
	 * the title on that row too (oneRow sets data-one-row; Trevor, 2026-11-01). The byline under
	 * both, across the page.
	 */
	.title-row[data-title-below] {
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-areas:
			'. actions'
			'title title';
		align-items: center;
		row-gap: var(--space-1);
		column-gap: var(--space-3);
	}
	.title-row[data-title-below]:global([data-one-row]) {
		grid-template-areas: 'title actions';
	}
	/* Room for the hamburger before the title, when the title shares the buttons' row. Without
	   it the buttons have the whole first row, the hamburger floating over its empty start. */
	.title-row[data-title-below] > .menu-room {
		display: none;
	}
	.title-row[data-title-below]:global([data-one-row]) > .menu-room {
		display: block;
	}
	.title-row[data-title-below]:global([data-one-row]):has(> .menu-room) {
		grid-template-columns: auto minmax(0, 1fr) auto;
		grid-template-areas: 'room title actions';
	}
	.title-row[data-title-below] > .menu-room {
		grid-area: room;
	}
	.title-row[data-title-below] > h1 {
		grid-area: title;
	}
	.title-row[data-title-below] > .actions {
		grid-area: actions;
		flex-wrap: nowrap;
		justify-content: flex-end;
		min-height: var(--tap-target);
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
