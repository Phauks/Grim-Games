<script lang="ts" generics="T extends string">
	import { Tabs } from '@ark-ui/svelte/tabs';
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import type { IconSlot } from '#lib/ui/icons/catalogue.ts';
	import Button from './Button.svelte';
	import IconButton from './IconButton.svelte';
	import Popover from './Popover.svelte';
	import { fillToBottom } from './tabs-fill.ts';
	import { fitTabs } from './tabs-fit.ts';

	interface Props {
		value?: T;
		/** `icon` draws over the label in a bottom bar. */
		tabs: { value: T; label: string; icon?: IconSlot }[];
		/** Renders the panel for one tab. */
		panel: Snippet<[T]>;
		label?: string;
		/**
		 * Every panel takes the tallest one's height, so switching tabs never moves what is
		 * under or around them (Trevor's no-reflow rule; a dialog's tabs keep its size).
		 */
		steady?: boolean;
		/**
		 * `bottom`: the tabs sit in a bar along the bottom of the screen or dialog, an icon over
		 * each label, and stay there while the panel scrolls (Trevor, 2026-10-31: the player
		 * screen's tabs). The chosen tab's icon is filled, gold and a little larger, with no
		 * line or pill.
		 */
		placement?: 'top' | 'bottom';
	}

	let {
		value = $bindable(),
		tabs,
		panel,
		label,
		steady = false,
		placement = 'top'
	}: Props = $props();
	const bottom = $derived(placement === 'bottom');

	const selected = $derived(value ?? tabs[0]?.value);

	/*
	 * Tabs stay on one row. Those that don't fit move, whole, into a ⋯ menu at the end of
	 * the row (Trevor, 2026-10-20: the player screen's tabs wrapped onto a second line on his
	 * Pixel; "triple dot drop down"), so the list never wraps or scrolls sideways at large
	 * text sizes. The selected tab always stays on the row.
	 */
	let bar = $state<HTMLElement>();
	let measure = $state<HTMLElement>();
	let shown = $state(Infinity);
	$effect(() => {
		if (!bar || !measure) return;
		const row = bar;
		const sizes = measure;
		const refit = () => {
			const faces = [...sizes.querySelectorAll<HTMLElement>('[data-face]')];
			const more = sizes.querySelector<HTMLElement>('[data-more]');
			const gap = parseFloat(getComputedStyle(sizes).columnGap) || 0;
			shown = fitTabs(
				faces.map((face) => face.getBoundingClientRect().width),
				row.clientWidth,
				gap,
				more?.getBoundingClientRect().width ?? 0
			);
		};
		const observer = new ResizeObserver(refit);
		observer.observe(row);
		observer.observe(sizes);
		return () => observer.disconnect();
	});

	// A bottom bar starts at the bottom of the screen or dialog, however short the panel.
	$effect(() => {
		const root = bar?.parentElement;
		if (bottom && root) return fillToBottom(root);
	});

	const onRow = $derived.by(() => {
		if (shown >= tabs.length) return tabs;
		const first = tabs.slice(0, shown);
		if (first.some((tab) => tab.value === selected)) return first;
		const current = tabs.find((tab) => tab.value === selected);
		return current ? [...first.slice(0, Math.max(0, shown - 1)), current] : first;
	});
	const inMenu = $derived(tabs.filter((tab) => !onRow.includes(tab)));

	let menuOpen = $state(false);
	let moreButton = $state<HTMLButtonElement>();
</script>

{#snippet contents()}
	{#each tabs as tab (tab.value)}
		<Tabs.Content value={tab.value}>{@render panel(tab.value)}</Tabs.Content>
	{/each}
{/snippet}

<Tabs.Root
	class={bottom ? 'bottom' : undefined}
	value={selected}
	onValueChange={(details) => (value = details.value as T)}
	lazyMount={!steady}
>
	<div class="bar" bind:this={bar} data-bottom-bar={bottom ? '' : undefined}>
		<Tabs.List aria-label={label}>
			{#each onRow as tab (tab.value)}
				<Tabs.Trigger value={tab.value}>
					{#if bottom && tab.icon}
						<span class="tab-icon">
							<Icon name={tab.icon} weight={tab.value === selected ? 'fill' : undefined} />
						</span>
					{/if}<span>{tab.label}</span>
				</Tabs.Trigger>
			{/each}
			{#if !bottom}<Tabs.Indicator />{/if}
		</Tabs.List>
		{#if inMenu.length}
			<IconButton
				icon="more"
				label={t('common.moreTabs')}
				bind:ref={moreButton}
				aria-haspopup="dialog"
				aria-expanded={menuOpen}
				onclick={() => (menuOpen = !menuOpen)}
			/>
		{/if}
		<!-- The tabs' natural widths, unseen, to tell how many fit. -->
		<div class="sizes" aria-hidden="true">
			<div class="faces" bind:this={measure}>
				{#each tabs as tab (tab.value)}<span class="face" data-face
						>{#if bottom && tab.icon}<span class="tab-icon"><Icon name={tab.icon} /></span
							>{/if}{tab.label}</span
					>{/each}
				<span class="more" data-more></span>
			</div>
		</div>
	</div>
	{#if steady}
		<div class="steady">{@render contents()}</div>
	{:else}
		{@render contents()}
	{/if}
</Tabs.Root>

<Popover bind:open={menuOpen} title={t('common.moreTabs')} anchor={moreButton}>
	<div class="menu">
		{#each inMenu as tab (tab.value)}
			<Button
				variant="quiet"
				onclick={() => {
					value = tab.value;
					menuOpen = false;
				}}>{tab.label}</Button
			>
		{/each}
	</div>
</Popover>

<style>
	.bar {
		position: relative;
		display: flex;
		align-items: center;
		min-width: 0;
		border-bottom: 1px solid var(--border);
	}
	:global([data-scope='tabs'][data-part='list']) {
		position: relative;
		display: flex;
		flex: 1;
		min-width: 0;
		gap: 0 var(--space-1);
		overflow: hidden;
	}
	.faces {
		display: flex;
		gap: 0 var(--space-1);
		width: max-content;
	}
	/* Unseen and clipped, so it never widens the page. */
	.sizes {
		position: absolute;
		inset-inline: 0;
		top: 0;
		height: 0;
		overflow: hidden;
		visibility: hidden;
	}
	/* The tabs share the row equally, so four tabs are 25% each (Trevor, 2026-10-28: "Would
	   look more balanced"). A label wider than its share keeps its width, and tabs that don't
	   fit move into the ⋯ menu as before. */
	:global([data-scope='tabs'][data-part='trigger']) {
		flex: 1 1 0;
		min-width: max-content;
		justify-content: center;
		text-align: center;
	}
	:global([data-scope='tabs'][data-part='trigger']),
	.face {
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		white-space: nowrap;
		border: 0;
		background: none;
		color: var(--on-surface-muted);
		font-family: var(--font-control);
		font-weight: var(--font-control-weight);
	}
	.face {
		flex: none;
	}
	.more {
		flex: none;
		width: var(--tap-target);
	}
	:global([data-scope='tabs'][data-part='trigger'][data-selected]) {
		color: var(--heading);
	}
	:global([data-scope='tabs'][data-part='indicator']) {
		left: var(--left);
		top: calc(var(--top) + var(--height) - 0.1875 * var(--u));
		width: var(--width);
		height: calc(0.1875 * var(--u));
		background: var(--accent);
	}
	:global([data-scope='tabs'][data-part='content']) {
		padding-top: var(--space-4);
	}
	/* All panels in one cell: the hidden ones keep their room but can't be seen or reached. */
	.steady {
		display: grid;
	}
	.steady > :global([data-part='content']) {
		grid-area: 1 / 1;
	}
	.steady > :global([data-part='content'][hidden]) {
		display: block;
		visibility: hidden;
	}
	.menu {
		display: grid;
		justify-items: stretch;
	}

	/* The bottom bar: last on screen though first for screen readers, held to the bottom of
	   whatever scrolls (fillToBottom stretches a short panel so it starts there). */
	:global([data-scope='tabs'][data-part='root'].bottom) {
		display: flex;
		flex-direction: column;
	}
	:global(.bottom) > .bar {
		order: 1;
		position: sticky;
		bottom: 0;
		z-index: var(--z-raised);
		margin-top: auto;
		border-bottom: 0;
		background: var(--surface-raised);
		/* Clear of the phone's gesture bar. */
		padding-bottom: env(safe-area-inset-bottom);
		/* Room for a tab's focus ring under the clip below. */
		padding-top: var(--space-1);
		/* The bar's colour, and the line along its top, reach out through the page's gutter and
		   down past its bottom padding, so they meet the screen's edges; a dialog's scrolling
		   box clips them at its own. */
		box-shadow:
			0 0 0 100vmax var(--surface-raised),
			0 -1px 0 100vmax var(--border); /* px-ok: a hairline, as the top tabs' */
		clip-path: inset(-1px calc(-1 * var(--page-gutter)) -100vmax); /* px-ok: the hairline above */
	}
	:global(.bottom) :global([data-scope='tabs'][data-part='content']) {
		padding-top: 0;
	}
	:global(.bottom) :global([data-scope='tabs'][data-part='trigger']),
	:global(.bottom) .face {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		gap: calc(0.25 * var(--u));
		padding-block: var(--space-2);
		font-size: 0.85rem;
	}
	.tab-icon {
		display: inline-flex;
		font-size: 1.5em;
		transition: transform var(--duration-fast) var(--ease-out);
	}
	:global(.bottom) :global([data-scope='tabs'][data-part='trigger']:not([data-selected])) {
		opacity: 0.75;
	}
	:global(.bottom) :global([data-scope='tabs'][data-part='trigger'][data-selected] .tab-icon) {
		transform: scale(1.2);
	}
</style>
