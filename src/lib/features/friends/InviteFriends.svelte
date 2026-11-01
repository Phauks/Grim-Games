<script lang="ts">
	import { account } from '#lib/features/account/account.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import FriendRows from './FriendRows.svelte';
	import GroupRoomToggles from './GroupRoomToggles.svelte';
	import type { FriendAccount } from './friends-protocol.ts';
	import { friends } from './friends.svelte.ts';

	/**
	 * Invite friends, on the Storyteller's Share (plan F4): friends as rows, each with Invite,
	 * as Send to a friend lists them for a script. Friends already in the room say so. The
	 * invite waits on their Friends page, with Join.
	 */
	let { code, title }: { code: string | undefined; title: string } = $props();

	let open = $state(false);
	let busy = $state(false);
	/** Friends invited while the sheet is open, and those already in the room. */
	let invited = $state<string[]>([]);
	let here = $state<string[]>([]);

	/**
	 * Friends of anyone in the room may join from their Friends page without an invite, when
	 * the Storyteller turns it on (plan F5; Trevor approved "per room", 2026-10-28).
	 */
	let friendsJoin = $state<boolean>();
	$effect(() => {
		friendsJoin = undefined;
		if (!code || account.status !== 'signed-in') return;
		let current = true;
		friends
			.friendRoom(code)
			.then((open) => {
				if (current) friendsJoin = open;
			})
			.catch(() => {
				// A room just made may not know its Storyteller's account yet: the switch starts
				// off, and turning it on says if the room still can't be reached.
				if (current) friendsJoin = false;
			});
		return () => {
			current = false;
		};
	});

	async function setFriendsJoin(open: boolean): Promise<void> {
		if (!code) return;
		busy = true;
		try {
			friendsJoin = await friends.friendRoom(code, open);
		} catch (e) {
			toast(t('friends.failed'), e instanceof Error ? e.message : String(e));
		} finally {
			busy = false;
		}
	}

	async function show(): Promise<void> {
		invited = [];
		here = [];
		open = true;
		if (!code) return;
		void friends.load();
		try {
			here = (await friends.invite({ code, title })).here;
		} catch {
			// The list still opens; Invite says if the room can't be reached.
		}
	}

	async function invite(friend: FriendAccount): Promise<void> {
		if (!code) return;
		busy = true;
		try {
			const answer = await friends.invite({ code, title, id: friend.id });
			here = answer.here;
			if (answer.outcome === 'sent') invited = [...invited, friend.id];
			else if (answer.outcome !== 'here') {
				toast(t('friends.failed'), t(`friends.invite.${answer.outcome ?? 'unavailable'}`));
			}
		} catch (e) {
			toast(t('friends.failed'), e instanceof Error ? e.message : String(e));
		} finally {
			busy = false;
		}
	}
</script>

{#if account.status === 'signed-in'}
	<div class="invite">
		<Toggle
			label={t('friends.room.open')}
			checked={friendsJoin ?? false}
			disabled={friendsJoin === undefined || busy}
			onChange={(open) => void setFriendsJoin(open)}
		/>
		<GroupRoomToggles {code} {title} />
		<Button icon="friends" variant="quiet" disabled={!code} onclick={() => void show()}
			>{t('friends.invite.title')}</Button
		>
	</div>
{/if}

{#snippet friendLabel(friend: FriendAccount)}{friend.username ?? t('friends.noUsername')}{/snippet}

{#snippet inviteAction(friend: FriendAccount)}
	{@const inRoom = here.includes(friend.id)}
	{@const done = invited.includes(friend.id)}
	<Button
		variant={done || inRoom ? 'quiet' : 'accent'}
		disabled={busy || done || inRoom}
		onclick={() => void invite(friend)}
		>{inRoom
			? t('friends.invite.inRoom')
			: done
				? t('friends.invite.invited')
				: t('friends.invite.one')}</Button
	>
{/snippet}

<Dialog bind:open title={t('friends.invite.title')}>
	{#if friends.data}
		<FriendRows
			items={friends.data.friends}
			key={(friend) => friend.id}
			testid="invite-friends"
			icon={(friend) => friend.icon}
			label={friendLabel}
			actions={inviteAction}
		/>
	{:else}
		<p class="muted">{friends.error || t('friends.loading')}</p>
	{/if}
</Dialog>

<style>
	.invite {
		display: grid;
		gap: var(--space-2);
		justify-items: start;
		margin-top: var(--space-3);
	}
	.invite > :global(*:not(:last-child)) {
		justify-self: stretch;
	}
	.muted {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
