<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { account } from '#lib/features/account/account.svelte.ts';
	import ProfileIcon from '#lib/features/account/ProfileIcon.svelte';
	import UsernameDialog from '#lib/features/account/UsernameDialog.svelte';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Menu from '#lib/ui/primitives/Menu.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import SharePanel from '#lib/ui/share/SharePanel.svelte';
	import AddFriendDialog from './AddFriendDialog.svelte';
	import { friends } from './friends.svelte.ts';
	import {
		friendLink,
		readFriendLink,
		type FriendAccount,
		type FriendAction
	} from './friends-protocol.ts';

	/**
	 * Friends (plan F1): requests to answer, friends, requests sent and blocked accounts, each
	 * a list of rows. Another account is shown by its username and profile icon, never its email.
	 */

	let adding = $state(false);
	let editUsername = $state(false);
	let busy = $state(false);
	/** A Block or Remove waiting for its confirmation. */
	let confirming = $state<{ action: 'block' | 'remove'; other: FriendAccount } | undefined>();
	let confirmOpen = $state(false);

	/** A username from a scanned friend code's link, filled into Add friend. */
	let linked = $state('');

	/** A friend link (`/friends#add=…`) opens Add friend with its username in. */
	function openFriendLink(): void {
		const username = readFriendLink(location.hash);
		if (!username) return;
		history.replaceState(history.state, '', location.pathname);
		linked = username;
		adding = true;
	}

	onMount(() => {
		void friends.load();
		openFriendLink();
		window.addEventListener('hashchange', openFriendLink);
		return () => window.removeEventListener('hashchange', openFriendLink);
	});

	/**
	 * This account's own friend code (Trevor, 2026-10-29): a link others scan to add it, with
	 * its profile icon in the middle. None without a username, or while it can't be found.
	 */
	const ownLink = $derived(
		account.user?.username && friends.data?.findable
			? friendLink(location.origin, account.user.username)
			: undefined
	);
	// Signing in on this page loads the list too (friends.svelte.ts listens for it).

	const nameOf = (other: FriendAccount) => other.username ?? t('friends.noUsername');

	async function act(action: FriendAction, other: FriendAccount): Promise<void> {
		busy = true;
		try {
			await friends.act(action, other.id);
		} catch (e) {
			toast(t('friends.failed'), e instanceof Error ? e.message : String(e));
		} finally {
			busy = false;
		}
	}

	function ask(action: 'block' | 'remove', other: FriendAccount): void {
		confirming = { action, other };
		confirmOpen = true;
	}

	async function setFindable(findable: boolean): Promise<void> {
		busy = true;
		try {
			await friends.setFindable(findable);
		} catch (e) {
			toast(t('friends.failed'), e instanceof Error ? e.message : String(e));
		} finally {
			busy = false;
		}
	}
</script>

{#snippet who(other: FriendAccount)}
	<span class="icon"><ProfileIcon icon={other.icon} /></span>
	<span class="name">{nameOf(other)}</span>
{/snippet}

{#snippet rows(list: FriendAccount[], testid: string, actions: Snippet<[FriendAccount]>)}
	{#if list.length === 0}
		<p class="muted" data-testid="{testid}-none">{t('common.none')}</p>
	{:else}
		<ul class="rows" data-testid={testid}>
			{#each list as other (other.id)}
				<li>{@render who(other)}<span class="actions">{@render actions(other)}</span></li>
			{/each}
		</ul>
	{/if}
{/snippet}

{#snippet incomingActions(other: FriendAccount)}
	<Button variant="accent" disabled={busy} onclick={() => act('accept', other)}
		>{t('friends.accept')}</Button
	>
	<Button variant="quiet" disabled={busy} onclick={() => act('decline', other)}
		>{t('friends.decline')}</Button
	>
	<Menu
		label={t('friends.actionsFor', { name: nameOf(other) })}
		items={[{ value: 'block', label: t('friends.block'), onSelect: () => ask('block', other) }]}
	/>
{/snippet}

{#snippet friendActions(other: FriendAccount)}
	<Menu
		label={t('friends.actionsFor', { name: nameOf(other) })}
		items={[
			{ value: 'remove', label: t('friends.remove'), onSelect: () => ask('remove', other) },
			{ value: 'block', label: t('friends.block'), onSelect: () => ask('block', other) }
		]}
	/>
{/snippet}

{#snippet outgoingActions(other: FriendAccount)}
	<Button variant="quiet" disabled={busy} onclick={() => act('cancel', other)}
		>{t('friends.cancel')}</Button
	>
{/snippet}

{#snippet blockedActions(other: FriendAccount)}
	<Button variant="quiet" disabled={busy} onclick={() => act('unblock', other)}
		>{t('friends.unblock')}</Button
	>
{/snippet}

<Page title={t('friends.title')} columns>
	<ErrorBoundary area="friends">
		{#if account.status === 'signed-in' && account.user}
			{@const data = friends.data}
			<PageSection title={t('friends.requests')}>
				{#if data}{@render rows(data.incoming, 'friend-incoming', incomingActions)}{/if}
			</PageSection>

			<PageSection title={t('friends.list')}>
				{#snippet aside()}
					<Button
						icon="add"
						variant="quiet"
						onclick={() => {
							linked = '';
							adding = true;
						}}>{t('friends.add')}</Button
					>
				{/snippet}
				{#if data}
					{@render rows(data.friends, 'friend-list', friendActions)}
				{:else}
					<p class="muted">{friends.error || t('friends.loading')}</p>
				{/if}
			</PageSection>

			<PageSection title={t('friends.code')}>
				<SharePanel
					url={ownLink}
					title={t('friends.code.share')}
					qrLabel={t('friends.code.qr')}
					pending={!account.user.username
						? t('friends.code.noUsername')
						: data && !data.findable
							? t('friends.code.hidden')
							: t('friends.loading')}
					qrCenterShape="square"
				>
					{#snippet qrCenter()}<span class="qr-icon"><ProfileIcon icon={account.user?.icon} /></span
						>{/snippet}
				</SharePanel>
			</PageSection>

			<PageSection title={t('friends.sent')}>
				{#if data}{@render rows(data.outgoing, 'friend-outgoing', outgoingActions)}{/if}
			</PageSection>

			<PageSection title={t('friends.privacy')}>
				<dl class="you">
					<dt>{t('friends.yourUsername')}</dt>
					<dd data-testid="friends-username">{account.user.username ?? t('common.none')}</dd>
					<IconButton
						icon="edit"
						label={t('account.username.title')}
						onclick={() => (editUsername = true)}
					/>
				</dl>
				<SettingToggle
					label={t('friends.findable')}
					checked={data?.findable ?? true}
					disabled={!data || busy}
					onChange={(findable) => void setFindable(findable)}
				/>
			</PageSection>

			<PageSection title={t('friends.blocked')}>
				{#if data}{@render rows(data.blocked, 'friend-blocked', blockedActions)}{/if}
			</PageSection>
		{:else}
			<section class="card" aria-labelledby="friends-sign-in">
				<h2 id="friends-sign-in">{t('friends.signIn')}</h2>
				<p class="muted">{t('friends.signedOut')}</p>
				<Button variant="accent" href={resolve('/account')}>{t('friends.signIn')}</Button>
			</section>
		{/if}
	</ErrorBoundary>
</Page>

<AddFriendDialog bind:open={adding} initial={linked} />
<UsernameDialog bind:open={editUsername} />

{#if confirming}
	{@const { action, other } = confirming}
	<ConfirmDialog
		bind:open={confirmOpen}
		danger
		title={t(action === 'block' ? 'friends.confirmBlock.title' : 'friends.confirmRemove.title', {
			name: nameOf(other)
		})}
		description={t(action === 'block' ? 'friends.confirmBlock.text' : 'friends.confirmRemove.text')}
		disabled={busy}
		onConfirm={() => void act(action, other)}
	/>
{/if}

<style>
	.muted {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.rows {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Rows with dividers, not cards (Trevor's UI rules). */
	.rows li {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: var(--tap-target);
		padding-block: var(--space-2);
		border-bottom: var(--card-border);
	}
	.rows li:last-child {
		border-bottom: 0;
	}
	.icon {
		display: grid;
		flex: none;
		width: calc(2.5 * var(--icon-size));
		height: calc(2.5 * var(--icon-size));
	}
	.name {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
		font-weight: var(--font-control-weight);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--space-2);
	}
	.you {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		margin: 0;
	}
	.you dt {
		color: var(--on-surface-muted);
	}
	.you dd {
		margin: 0;
	}
	.qr-icon {
		display: grid;
		width: 100%;
		height: 100%;
	}
	.card {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-4);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
		justify-items: start;
	}
	.card h2 {
		margin: 0;
	}
</style>
