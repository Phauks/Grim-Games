<script lang="ts">
	import { onMount } from 'svelte';
	import { account } from '#lib/features/account/account.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import FriendRows from './FriendRows.svelte';
	import { friendScripts } from './friend-scripts.svelte.ts';
	import type { FriendScript } from './friend-scripts-protocol.ts';
	import type { FriendAccount } from './friends-protocol.ts';
	import { friends } from './friends.svelte.ts';

	/**
	 * A script's Share screen, signed in (plan F9, F10): Send to a friend, which lands under
	 * "Scripts from friends" on their Friends page, and Show on my profile. Trevor, 2026-10-30:
	 * "hey, use this script to a friend. Or ... just point at their profile".
	 */
	let { name, hash }: { name: string; hash: string | undefined } = $props();

	const script = $derived<FriendScript | undefined>(hash ? { name, hash } : undefined);
	let choosing = $state(false);
	let busy = $state(false);
	/** Friends this script went to while the screen is open. */
	let sent = $state<string[]>([]);

	onMount(() => {
		void friends.load();
		void friendScripts.load();
	});

	async function send(friend: FriendAccount): Promise<void> {
		if (!script) return;
		busy = true;
		try {
			const answer = await friendScripts.send(friend.id, script);
			if (answer.ok) sent = [...sent, friend.id];
			else toast(t('friends.failed'), t('friends.scripts.notFriends'));
		} catch (e) {
			toast(t('friends.failed'), e instanceof Error ? e.message : String(e));
		} finally {
			busy = false;
		}
	}

	async function publish(on: boolean): Promise<void> {
		if (!script) return;
		busy = true;
		try {
			await friendScripts.setPublished(script, on);
		} catch (e) {
			toast(t('friends.failed'), e instanceof Error ? e.message : String(e));
		} finally {
			busy = false;
		}
	}
</script>

{#if account.status === 'signed-in'}
	<div class="friends" data-testid="share-friends">
		<Toggle
			label={t('friends.scripts.publish')}
			checked={!!hash && friendScripts.isPublished(hash)}
			disabled={!script || !friendScripts.data || busy || !account.user?.username}
			onChange={(on) => void publish(on)}
		/>
		<Button
			icon="friends"
			variant="quiet"
			disabled={!script}
			onclick={() => {
				sent = [];
				choosing = true;
			}}>{t('friends.scripts.send')}</Button
		>
	</div>
{/if}

{#snippet friendLabel(friend: FriendAccount)}{friend.username ?? t('friends.noUsername')}{/snippet}

{#snippet sendAction(friend: FriendAccount)}
	{@const done = sent.includes(friend.id)}
	<Button
		variant={done ? 'quiet' : 'accent'}
		disabled={busy || done}
		onclick={() => void send(friend)}
		>{done ? t('friends.scripts.sent') : t('friends.scripts.sendOne')}</Button
	>
{/snippet}

<Dialog bind:open={choosing} title={t('friends.scripts.send')}>
	{#if friends.data}
		<FriendRows
			items={friends.data.friends}
			key={(friend) => friend.id}
			testid="send-script-friends"
			icon={(friend) => friend.icon}
			label={friendLabel}
			actions={sendAction}
		/>
	{:else}
		<p class="muted">{friends.error || t('friends.loading')}</p>
	{/if}
</Dialog>

<style>
	.friends {
		display: grid;
		gap: var(--space-2);
		justify-items: start;
		margin-top: var(--space-3);
	}
	.friends > :global(*:first-child) {
		justify-self: stretch;
	}
	.muted {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
