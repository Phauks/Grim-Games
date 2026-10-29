<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { MessageKey } from '#lib/i18n/catalog.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import { account } from '#lib/features/account/account.svelte.ts';
	import ProfileIcon from '#lib/features/account/ProfileIcon.svelte';
	import { friends } from '#lib/features/friends/friends.svelte.ts';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import {
		ACCOUNT_ITEM,
		APP_ITEMS,
		FRIENDS_ITEM,
		HISTORY_ITEM,
		HOME_ITEM,
		isCurrent,
		NAV_SECTIONS,
		REPORTS_ITEM,
		LIVE_GAMES_ITEM,
		type NavItem
	} from './nav.ts';
	import { openSettings } from './shell.ts';
	import BuildLine from '#lib/features/about/BuildLine.svelte';
	import { buildInfo } from '#lib/build-info.ts';
	import { buildSwitch } from '#lib/features/about/build-switch.ts';
	import { reportWithDiagnostics } from '#lib/features/errors/report-with-diagnostics.ts';

	interface Props {
		/** Called after a choice, e.g. to close the drawer. */
		onChoose?: () => void;
	}

	let { onChoose }: Props = $props();

	const label = (key: MessageKey): string => (t as (key: MessageKey) => string)(key);
	const otherBuild = $derived(buildSwitch(buildInfo, page.url));
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
			<!-- Friend requests waiting for an answer (plan F1). -->
			{#if item === FRIENDS_ITEM && friends.waiting > 0}<CountBadge
					count={friends.waiting}
					testid="friend-requests-count"
				/>{/if}
		</a>
	</li>
{/snippet}

<!-- Opens and closes from its heading, remembered on this device; the sidebar and the drawer
     share the choice (Trevor, 2026-10-29: "items in the left sidebar should be collapsible"). -->
{#snippet section(id: string, title: string, count: number, items: Snippet)}
	<Collapsible {title} level={3} storageKey="nav-{id}" {count}>
		<ul aria-label={title}>{@render items()}</ul>
	</Collapsible>
{/snippet}

<!-- Plain links in labelled sections: a screen that must confirm leaving catches them in the root layout. -->
<div class="nav-list">
	<ul class="top">{@render link(HOME_ITEM)}</ul>
	<div class="sections">
		{#each NAV_SECTIONS as navSection (navSection.id)}
			{#snippet items()}
				{#each navSection.items as item (item.id)}{@render link(item)}{/each}
			{/snippet}
			{@render section(navSection.id, label(navSection.label), navSection.items.length, items)}
		{/each}
		{#if account.admin}
			{#snippet adminItems()}
				{@render link(REPORTS_ITEM)}{@render link(LIVE_GAMES_ITEM)}
			{/snippet}
			{@render section('admin', t('shell.navSectionAdmin'), 2, adminItems)}
		{/if}
		<!-- Account, Friends, History and Settings, last in the sidebar and the drawer alike (2026-10-22). -->
		{#snippet youItems()}
			{@render link(ACCOUNT_ITEM)}
			{@render link(FRIENDS_ITEM)}
			{@render link(HISTORY_ITEM)}
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
		{/snippet}
		{@render section('you', t('shell.navSectionYou'), 4, youItems)}
		<!-- The app's own pages, where the footer had them (2026-10-23). -->
		{#snippet appItems()}
			{#each APP_ITEMS as item (item.id)}{@render link(item)}{/each}
		{/snippet}
		{@render section('app', t('shell.navSectionApp'), APP_ITEMS.length, appItems)}
	</div>
	<!-- Report an issue and the switch to the other build do something rather than go somewhere,
	     so they are buttons, not menu rows (Trevor, 2026-10-29). -->
	<div class="actions">
		<Button
			icon="report"
			onclick={() => {
				onChoose?.();
				void reportWithDiagnostics();
			}}>{t('shell.reportIssue')}</Button
		>
		{#if otherBuild}
			<!-- Each build is its own origin, so its device data is separate (2026-10-19); it opens
			     in place, on the other build's host. -->
			<Button
				icon="switchBuild"
				title={t('shell.switchBuildTitle')}
				data-testid="switch-build"
				onclick={() => {
					onChoose?.();
					location.assign(otherBuild.href);
				}}
				>{otherBuild.to === 'beta'
					? t('shell.switchToBeta')
					: t('shell.switchToProduction')}</Button
			>
		{/if}
	</div>
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
	/* Section headings keep the menu's small capitals; the links under them don't. */
	.sections {
		--section-title-size: 0.75rem;
		--collapsible-heading: var(--on-surface-muted);
		margin-top: var(--space-2);
		font-family: var(--font-control);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.sections ul {
		letter-spacing: normal;
		text-transform: none;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-2);
		padding: 0 var(--space-3);
	}
	.profile {
		display: grid;
		flex: none;
		width: var(--icon-size);
		height: var(--icon-size);
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
	@media (hover: hover) and (pointer: fine) {
		a:not([aria-current='page']):hover,
		button:hover {
			background: var(--surface-hover);
		}
	}
</style>
