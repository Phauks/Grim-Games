<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { MessageKey } from '#lib/i18n/catalog.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { ACCOUNT_ITEM, HOME_ITEM, isCurrent, NAV_SECTIONS, type NavItem } from './nav.ts';
	import { openSettings } from './shell.ts';

	interface Props {
		/** Adds "You" (Account and Settings), for places without the header's buttons (drawer). */
		withAccount?: boolean;
		/** Called after a choice, e.g. to close the drawer. */
		onChoose?: () => void;
	}

	let { withAccount = false, onChoose }: Props = $props();

	const label = (key: MessageKey): string => (t as (key: MessageKey) => string)(key);
	const listId = $props.id();
</script>

{#snippet link(item: NavItem)}
	<li>
		<a
			href={resolve(item.path)}
			aria-current={isCurrent(item, page.url.pathname) ? 'page' : undefined}
			onclick={() => onChoose?.()}
		>
			<Icon name={item.icon} />
			<span>{label(item.label)}</span>
		</a>
	</li>
{/snippet}

<!-- Plain links in labelled sections: a screen that must confirm leaving catches them in the root layout. -->
<div class="nav-list">
	<ul class="top">{@render link(HOME_ITEM)}</ul>
	{#each NAV_SECTIONS as section (section.id)}
		<h3 id="{listId}-{section.id}">{label(section.label)}</h3>
		<ul aria-labelledby="{listId}-{section.id}">
			{#each section.items as item (item.id)}{@render link(item)}{/each}
		</ul>
	{/each}
	{#if withAccount}
		<h3 id="{listId}-you">{t('shell.navSectionYou')}</h3>
		<ul aria-labelledby="{listId}-you">
			{@render link(ACCOUNT_ITEM)}
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
		</ul>
	{/if}
</div>

<style>
	ul {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	h3 {
		margin: var(--space-4) 0 var(--space-1);
		padding: 0 var(--space-3);
		font-family: var(--font-control);
		font-size: 0.75rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--on-surface-muted);
	}
	h3:first-child {
		margin-top: 0;
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
