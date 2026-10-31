<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { account } from '#lib/features/account/account.svelte.ts';
	import ProfileAvatar from '#lib/features/player/ProfileAvatar.svelte';
	import UsernameDialog from '#lib/features/account/UsernameDialog.svelte';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Menu from '#lib/ui/primitives/Menu.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import SharePanel from '#lib/ui/share/SharePanel.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import type { PlayerName } from '#lib/core/data/index.ts';
	import AddFriendDialog from './AddFriendDialog.svelte';
	import SeatFriendButton from './SeatFriendButton.svelte';
	import FriendRows from './FriendRows.svelte';
	import { roomJoinPath } from '#lib/features/room/join-link.ts';
	import { profileHref, scriptOpenHref } from './friend-links.ts';
	import { friendScripts } from './friend-scripts.svelte.ts';
	import { type InboxScript, type PublishedScript } from './friend-scripts-protocol.ts';
	import { friends } from './friends.svelte.ts';
	import {
		friendLink,
		readFriendLink,
		type FriendAccount,
		type FriendAction,
		type FriendInvite,
		type RecentPlayer
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

	/** A friend link (`/friends#friend=…`) opens Add friend with its username in. */
	function openFriendLink(): void {
		const username = readFriendLink(location.hash);
		if (!username) return;
		history.replaceState(history.state, '', location.pathname);
		linked = username;
		adding = true;
	}

	onMount(() => {
		void friends.load();
		void friendScripts.load();
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

	/** A received or published script's change (plan F9, F10); a failure shows in a toast. */
	async function change(task: () => Promise<void>): Promise<void> {
		busy = true;
		try {
			await task();
		} catch (e) {
			toast(t('friends.failed'), e instanceof Error ? e.message : String(e));
		} finally {
			busy = false;
		}
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
	{#if other.username}
		<a class="name" href={profileHref(other.username)}>{other.username}</a>
	{:else}
		{nameOf(other)}
	{/if}
{/snippet}

{#snippet accounts(list: FriendAccount[], testid: string, actions: Snippet<[FriendAccount]>)}
	<FriendRows
		items={list}
		key={(other) => other.id}
		{testid}
		icon={(other) => other.icon}
		label={who}
		{actions}
	/>
{/snippet}

<!-- Recent players (plan F3): who they are, what they were called in your last game together
     and how many you've played. -->
{#snippet recentLabel(other: RecentPlayer)}
	{@render who(other)}
	<span class="from recent-line">
		{#if other.name}<PlayerBadge name={other.name as PlayerName} />{/if}
		<span>{t('friends.recent.games', { games: other.games })}</span>
	</span>
{/snippet}

{#snippet recentActions(other: RecentPlayer)}
	<SeatFriendButton open target={{ recent: other.id }} known={other.state} />
{/snippet}

{#snippet inviteLabel(invite: FriendInvite)}
	<span class="script">{invite.title || t('friends.invites')}</span>
	<span class="from">{t('friends.invites.from', { name: nameOf(invite.from) })}</span>
{/snippet}

{#snippet inviteActions(invite: FriendInvite)}
	<Button variant="accent" href={roomJoinPath(invite.code)}>{t('friends.invites.join')}</Button>
	<Button
		variant="quiet"
		disabled={busy}
		onclick={() => change(() => friends.dismissInvite(invite.id))}
		>{t('friends.invites.decline')}</Button
	>
{/snippet}

{#snippet inboxLabel(script: InboxScript)}
	<span class="script">{script.name}</span>
	<span class="from">{t('friends.scripts.from', { name: nameOf(script.from) })}</span>
{/snippet}

{#snippet inboxActions(script: InboxScript)}
	<Button variant="accent" href={scriptOpenHref(script.hash)}>{t('friends.scripts.open')}</Button>
	<Button
		variant="quiet"
		disabled={busy}
		onclick={() => change(() => friendScripts.dismiss(script.id))}
		>{t('friends.scripts.dismiss')}</Button
	>
{/snippet}

{#snippet publishedLabel(script: PublishedScript)}
	<span class="script">{script.name}</span>
{/snippet}

{#snippet publishedActions(script: PublishedScript)}
	<Button variant="quiet" href={scriptOpenHref(script.hash)}>{t('friends.scripts.open')}</Button>
	<DeleteButton
		label={t('friends.scripts.unpublish', { name: script.name })}
		disabled={busy}
		onclick={() => change(() => friendScripts.setPublished(script, false))}
	/>
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
			<PageSection title={t('friends.invites')}>
				{#if data}
					<FriendRows
						items={data.invites ?? []}
						key={(invite) => invite.id}
						testid="friend-invites"
						icon={(invite) => invite.from.icon}
						label={inviteLabel}
						actions={inviteActions}
					/>
				{:else}
					<p class="muted">{friends.error || t('friends.loading')}</p>
				{/if}
			</PageSection>

			<PageSection title={t('friends.requests')}>
				{#if data}{@render accounts(data.incoming, 'friend-incoming', incomingActions)}{/if}
			</PageSection>

			<PageSection title={t('friends.scripts.inbox')}>
				{#if friendScripts.data}
					<FriendRows
						items={friendScripts.data.inbox}
						key={(script) => script.id}
						testid="friend-scripts"
						icon={(script) => script.from.icon}
						label={inboxLabel}
						actions={inboxActions}
					/>
				{:else}
					<p class="muted">{t('friends.loading')}</p>
				{/if}
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
					{@render accounts(data.friends, 'friend-list', friendActions)}
				{:else}
					<p class="muted">{friends.error || t('friends.loading')}</p>
				{/if}
			</PageSection>

			<PageSection title={t('friends.recent')}>
				{#if data}
					<FriendRows
						items={data.recent ?? []}
						key={(other) => other.id}
						testid="friend-recent"
						icon={(other) => other.icon}
						label={recentLabel}
						actions={recentActions}
					/>
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
					<!-- The Profile's own avatar, as Settings' Profile button shows it (Trevor, 2026-10-30). -->
					{#snippet qrCenter()}<span class="qr-icon"><ProfileAvatar /></span>{/snippet}
				</SharePanel>
			</PageSection>

			<PageSection title={t('friends.profile')}>
				{#snippet aside()}
					<Button
						variant="quiet"
						href={account.user?.username ? profileHref(account.user.username) : undefined}
						disabled={!account.user?.username}>{t('friends.profile.open')}</Button
					>
				{/snippet}
				{#if friendScripts.data}
					<FriendRows
						items={friendScripts.data.published}
						key={(script) => script.hash}
						testid="profile-scripts"
						label={publishedLabel}
						actions={publishedActions}
					/>
				{:else}
					<p class="muted">{t('friends.loading')}</p>
				{/if}
			</PageSection>

			<PageSection title={t('friends.sent')}>
				{#if data}{@render accounts(data.outgoing, 'friend-outgoing', outgoingActions)}{/if}
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
				{#if data}{@render accounts(data.blocked, 'friend-blocked', blockedActions)}{/if}
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
	.name {
		color: inherit;
	}
	.script {
		display: block;
	}
	.from {
		display: block;
		color: var(--on-surface-muted);
		font-weight: normal;
		font-size: 0.85rem;
	}
	.recent-line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
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
