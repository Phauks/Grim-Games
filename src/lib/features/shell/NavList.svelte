<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { MessageKey } from '#lib/i18n/catalog.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { ACCOUNT_ITEM, isCurrent, NAV_ITEMS } from './nav.ts';
	import { openSettings } from './shell.ts';

	interface Props {
		/** Icons only, names as tooltips (the collapsed sidebar). */
		compact?: boolean;
		/** Adds Settings and Account, for places without the header (drawer, game screens). */
		withAccount?: boolean;
		/** Called after a choice, e.g. to close the drawer. */
		onChoose?: () => void;
	}

	let { compact = false, withAccount = false, onChoose }: Props = $props();

	const items = $derived(withAccount ? [...NAV_ITEMS, ACCOUNT_ITEM] : NAV_ITEMS);
	const label = (key: MessageKey): string => (t as (key: MessageKey) => string)(key);
</script>

<!-- Plain links: a screen that must confirm leaving catches them in the root layout. -->
<ul class="nav-list" class:compact>
	{#each items as item (item.id)}
		<li>
			<a
				href={resolve(item.path)}
				aria-current={isCurrent(item, page.url.pathname) ? 'page' : undefined}
				aria-label={compact ? label(item.label) : undefined}
				title={compact ? label(item.label) : undefined}
				onclick={() => onChoose?.()}
			>
				<Icon name={item.icon} />
				{#if !compact}<span>{label(item.label)}</span>{/if}
			</a>
		</li>
	{/each}
	{#if withAccount}
		<li>
			<button
				type="button"
				onclick={() => {
					onChoose?.();
					openSettings();
				}}
			>
				<Icon name="settings" />
				<span>{t('shell.settings')}</span>
			</button>
		</li>
	{/if}
</ul>

<style>
	.nav-list {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	a,
	button {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-md);
		background: none;
		color: var(--on-surface);
		font: inherit;
		font-family: var(--font-control);
		font-weight: var(--font-control-weight);
		text-align: start;
		text-decoration: none;
		cursor: pointer;
	}
	.compact a {
		justify-content: center;
		padding: 0;
	}
	a[aria-current='page'] {
		background: var(--surface-raised);
		color: var(--heading);
		box-shadow: inset 3px 0 0 var(--accent);
	}
	@media (hover: hover) and (pointer: fine) {
		a:not([aria-current='page']):hover,
		button:hover {
			background: var(--surface-hover);
		}
	}
</style>
