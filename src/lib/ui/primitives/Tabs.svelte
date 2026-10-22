<script lang="ts" generics="T extends string">
	import { Tabs } from '@ark-ui/svelte/tabs';
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from './Button.svelte';
	import IconButton from './IconButton.svelte';
	import Popover from './Popover.svelte';
	import { fitTabs } from './tabs-fit.ts';

	interface Props {
		value?: T;
		tabs: { value: T; label: string }[];
		/** Renders the panel for one tab. */
		panel: Snippet<[T]>;
		label?: string;
	}

	let { value = $bindable(), tabs, panel, label }: Props = $props();

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

<Tabs.Root value={selected} onValueChange={(details) => (value = details.value as T)} lazyMount>
	<div class="bar" bind:this={bar}>
		<Tabs.List aria-label={label}>
			{#each onRow as tab (tab.value)}
				<Tabs.Trigger value={tab.value}>{tab.label}</Tabs.Trigger>
			{/each}
			<Tabs.Indicator />
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
				{#each tabs as tab (tab.value)}<span class="face" data-face>{tab.label}</span>{/each}
				<span class="more" data-more></span>
			</div>
		</div>
	</div>
	{#each tabs as tab (tab.value)}
		<Tabs.Content value={tab.value}>{@render panel(tab.value)}</Tabs.Content>
	{/each}
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
	:global([data-scope='tabs'][data-part='trigger']),
	.face {
		flex: none;
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		white-space: nowrap;
		border: 0;
		background: none;
		color: var(--on-surface-muted);
		font-family: var(--font-control);
		font-weight: var(--font-control-weight);
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
	.menu {
		display: grid;
		justify-items: stretch;
	}
</style>
