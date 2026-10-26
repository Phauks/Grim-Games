<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { MessageKey } from '#lib/i18n/catalog.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { account } from '#lib/features/account/account.svelte.ts';
	import ProfileIcon from '#lib/features/account/ProfileIcon.svelte';
	import {
		ACCOUNT_ITEM,
		APP_ITEMS,
		HOME_ITEM,
		isCurrent,
		NAV_SECTIONS,
		REPORTS_ITEM,
		LIVE_GAMES_ITEM,
		type NavItem
	} from './nav.ts';
	import { openSettings } from './shell.ts';
	import BuildLine from '#lib/features/about/BuildLine.svelte';
	import { reportWithDiagnostics } from '#lib/features/errors/report-with-diagnostics.ts';

	interface Props {
		/** Called after a choice, e.g. to close the drawer. */
		onChoose?: () => void;
	}

	let { onChoose }: Props = $props();

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
			{#if item === ACCOUNT_ITEM}
				<!-- The signed-in account's profile icon, as the header's button had (2026-10-22). -->
				<span class="profile" data-signed-in={account.status === 'signed-in'}
					><ProfileIcon
						icon={account.status === 'signed-in' ? account.user?.icon : undefined}
					/></span
				>
			{:else}
				<Icon name={item.icon} />
			{/if}
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
	{#if account.admin}
		<h3 id="{listId}-admin">{t('shell.navSectionAdmin')}</h3>
		<ul aria-labelledby="{listId}-admin">
			{@render link(REPORTS_ITEM)}{@render link(LIVE_GAMES_ITEM)}
		</ul>
	{/if}
	<!-- Account and Settings, last in the sidebar and the drawer alike (2026-10-22). -->
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
	<!-- The app's own pages, where the footer had them (2026-10-23). -->
	<h3 id="{listId}-app">{t('shell.navSectionApp')}</h3>
	<ul aria-labelledby="{listId}-app">
		{#each APP_ITEMS as item (item.id)}{@render link(item)}{/each}
	</ul>
	<!-- Report an issue opens a form, not a page, so it reads as small text like the build line
	     under it rather than as a link in the menu (Trevor, 2026-10-23). -->
	<p class="report">
		<button
			type="button"
			onclick={() => {
				onChoose?.();
				void reportWithDiagnostics();
			}}>{t('shell.reportIssue')}</button
		>
	</p>
	<BuildLine />
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
	.profile {
		display: grid;
		flex: none;
		width: var(--icon-size);
		height: var(--icon-size);
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
		box-shadow: inset 3px 0 0 var(--accent-edge);
	}
	/* As BuildLine's text: small, muted and underlined. */
	.report {
		margin: var(--space-2) 0 0;
		padding: 0 var(--space-3);
		font-size: 0.8rem;
	}
	.report button {
		display: inline-flex;
		width: auto;
		padding: 0;
		color: var(--on-surface-muted);
		font-family: inherit;
		font-weight: inherit;
		text-decoration: underline;
	}
	.report button:hover {
		background: none;
	}
	@media (hover: hover) and (pointer: fine) {
		a:not([aria-current='page']):hover,
		button:hover {
			background: var(--surface-hover);
		}
	}
</style>
