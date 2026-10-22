<script lang="ts" module>
	export interface ContentsItem {
		id: string;
		label: string;
		/** Listed only beside the text on wide screens (e.g. Summary, which a phone opens on). */
		wideOnly?: boolean;
		/** How many things the item holds (a character's jinxes, tips), shown beside it. */
		count?: number;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { rise } from '#lib/ui/motion.ts';
	import BackButton from '#lib/ui/primitives/BackButton.svelte';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';

	interface Props {
		/** The contents list's accessible name. */
		label: string;
		items: readonly ContentsItem[];
		/** The item whose text is shown. */
		current: string | undefined;
		onSelect: (id: string) => void;
		/** Phone only: the home view (the list, under the pane when `paneAtHome`) is showing. */
		home: boolean;
		/** Phone only: show the pane above the list on the home view (character Summary). */
		paneAtHome?: boolean;
		backLabel: string;
		onBack: () => void;
		/** Shown above the list and kept in view, e.g. a search field. */
		navTop?: Snippet;
		hideNav?: boolean;
		children: Snippet;
	}

	let {
		label,
		items,
		current,
		onSelect,
		home,
		paneAtHome = true,
		backLabel,
		onBack,
		navTop,
		hideNav = false,
		children
	}: Props = $props();

	let width = $state(0);
	/** Two panes from 40rem of width (the container query below), so nothing slides there. */
	const slides = $derived(
		width > 0 && width < 40 * parseFloat(getComputedStyle(document.documentElement).fontSize)
	);
	let direction = $state(1);
	// Another item's text always starts at its top; the list keeps its own scroll (Trevor,
	// 2026-10-16). On a phone the whole layout scrolls, so it goes back to the top too.
	let layoutEl = $state<HTMLElement>();
	let paneEl = $state<HTMLElement>();
	$effect(() => {
		void current;
		void home;
		paneEl?.scrollTo({ top: 0 });
		if (layoutEl && getComputedStyle(layoutEl).overflowY !== 'hidden')
			layoutEl.scrollTo({ top: 0 });
	});
	function select(id: string) {
		direction = 1;
		onSelect(id);
	}
	function back() {
		direction = -1;
		onBack();
	}
</script>

<!--
	A dialog's contents list beside its text, like a document's table of contents (character
	details and the Glossary, Trevor 2026-10-16). From 40rem of width the list sits on the
	left and the text on the right, each scrolling on its own. On a phone the list is the home
	view and an item's text slides in over it, with a Back button.
-->
<div class="frame" bind:clientWidth={width}>
	<div
		class="layout"
		bind:this={layoutEl}
		data-home={home ? '' : undefined}
		data-pane-at-home={paneAtHome ? '' : undefined}
	>
		{#if !hideNav}
			<nav class="nav" aria-label={label}>
				{#if navTop}<div class="nav-top">{@render navTop()}</div>{/if}
				<ul>
					{#each items as item (item.id)}
						<li class:wide-only={item.wideOnly}>
							<button
								type="button"
								aria-current={current === item.id ? 'page' : undefined}
								onclick={() => select(item.id)}
								><span class="label">{item.label}</span><span class="end"
									>{#if item.count !== undefined}<CountBadge
											count={item.count}
											testid="contents-count"
										/>{/if}<span class="chevron"><Icon name="forward" /></span></span
								></button
							>
						</li>
					{:else}
						<li class="none">{t('common.none')}</li>
					{/each}
				</ul>
			</nav>
		{/if}
		<div class="pane" bind:this={paneEl}>
			{#key current}
				<div
					class="view"
					in:rise={{ x: `${direction * 3}rem`, y: 0, speed: slides ? 'normal' : 'none' }}
				>
					{#if !home}
						<BackButton class="back" label={backLabel} onclick={back} />
					{/if}
					{@render children()}
				</div>
			{/key}
		</div>
	</div>
</div>

<style>
	.frame {
		flex: 1;
		min-height: 0;
		container-type: inline-size;
	}
	/* Phone: the pane (if any) and the list scroll together; an item replaces both. */
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-areas: 'pane' 'nav';
		align-content: start;
		gap: var(--space-4);
		height: 100%;
		padding-top: var(--space-3);
		padding-inline-end: var(--scrollbar-room);
		overflow: hidden auto;
		overscroll-behavior: contain;
	}
	.pane {
		grid-area: pane;
		min-width: 0;
	}
	.nav {
		grid-area: nav;
	}
	.layout:not([data-home]) .nav,
	.layout[data-home]:not([data-pane-at-home]) .pane,
	.wide-only {
		display: none;
	}
	.nav-top {
		position: sticky;
		top: 0;
		z-index: 1;
		padding-bottom: var(--space-2);
		background: var(--dialog-background);
	}
	/* The items read as navigation, like a document's contents, not as buttons. */
	.nav ul {
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: var(--card-border);
	}
	.nav button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--tap-target);
		padding: 0 var(--space-2);
		border: 0;
		border-bottom: var(--card-border);
		border-inline-start: calc(0.2 * var(--u)) solid transparent;
		background: none;
		color: var(--on-surface);
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	.nav button:hover {
		background: var(--surface-selected);
	}
	.nav button[aria-current] {
		border-inline-start-color: var(--heading);
		color: var(--heading);
		font-weight: 700;
	}
	.none {
		padding: var(--space-2);
		color: var(--on-surface-muted);
	}
	.label {
		min-width: 0;
	}
	.end {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: var(--space-1);
	}
	.chevron {
		display: inline-flex;
		color: var(--on-surface-muted);
	}
	.view > :global(.back) {
		margin-bottom: var(--space-1);
	}
	@container (min-width: 40rem) {
		.layout:has(.nav) {
			grid-template-columns: minmax(0, 14rem) minmax(0, 1fr);
			grid-template-rows: 100%;
			grid-template-areas: 'nav pane';
			padding-inline-end: 0;
			overflow: hidden;
		}
		.layout:has(.nav) .nav,
		.layout:has(.nav) .pane {
			padding-inline-end: var(--scrollbar-room);
			overflow: hidden auto;
			overscroll-behavior: contain;
		}
		.layout:not([data-home]) .nav,
		.layout[data-home]:not([data-pane-at-home]) .pane,
		.wide-only {
			display: block;
		}
		/* A line between the list and the text, and between entries, as on a phone (Trevor,
		   2026-10-20). */
		.layout:has(.nav) .nav {
			border-inline-end: var(--card-border);
		}
		.chevron,
		.view > :global(.back) {
			display: none;
		}
	}
</style>
