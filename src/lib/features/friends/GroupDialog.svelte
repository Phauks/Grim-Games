<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import SharePanel from '#lib/ui/share/SharePanel.svelte';
	import { roomJoinPath } from '#lib/features/room/join-link.ts';
	import FriendRows from './FriendRows.svelte';
	import type { FriendAccount } from './friends-protocol.ts';
	import {
		formatGroupCode,
		groupLink,
		type GroupGame,
		type GroupSummary
	} from './groups-protocol.ts';
	import { groups } from './groups.svelte.ts';

	/**
	 * One group (plan F6): the games its Storytellers show in it now, each with Join, its
	 * join code to share, and for its owner the members, each with Remove. Leave, or the
	 * owner's Delete, ends it (Trevor, 2026-10-31: a cafe's group, quiet unless you look).
	 */
	let { open = $bindable(false), group }: { open?: boolean; group: GroupSummary | undefined } =
		$props();

	let members = $state<FriendAccount[]>();
	let busy = $state(false);
	let confirmOpen = $state(false);

	$effect(() => {
		members = undefined;
		if (!open || !group?.owner) return;
		const code = group.code;
		let current = true;
		groups
			.members(code)
			.then((list) => {
				if (current) members = list;
			})
			.catch(() => {});
		return () => {
			current = false;
		};
	});

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

	const nameOf = (other: FriendAccount) => other.username ?? t('friends.noUsername');
</script>

{#snippet gameLabel(game: GroupGame)}
	<span class="title">{game.title || t('friends.invites')}</span>
	<span class="from">{t('friends.groups.storyteller', { name: nameOf(game.storyteller) })}</span>
{/snippet}

{#snippet gameActions(game: GroupGame)}
	<Button variant="accent" href={roomJoinPath(game.room)}>{t('friends.invites.join')}</Button>
{/snippet}

{#snippet memberLabel(member: FriendAccount)}{nameOf(member)}{/snippet}

{#snippet memberActions(member: FriendAccount)}
	{#if group && member.id !== members?.[0]?.id}
		{@const code = group.code}
		<DeleteButton
			label={t('friends.groups.remove', { name: nameOf(member) })}
			disabled={busy}
			onclick={() =>
				change(async () => {
					members = await groups.remove(code, member.id);
					await groups.load();
				})}
		/>
	{/if}
{/snippet}

<Dialog bind:open title={group?.name ?? t('friends.groups')}>
	{#if group}
		<div class="parts">
			<PageSection title={t('friends.groups.games')} level={3}>
				<FriendRows
					items={group.games}
					key={(game) => game.room}
					testid="group-games"
					icon={(game) => game.storyteller.icon}
					label={gameLabel}
					actions={gameActions}
				/>
			</PageSection>
			<PageSection title={t('friends.groups.membersTitle')} level={3}>
				{#if group.owner}
					{#if members}
						<FriendRows
							items={members}
							key={(member) => member.id}
							testid="group-members"
							icon={(member) => member.icon}
							label={memberLabel}
							actions={memberActions}
						/>
					{:else}
						<p class="muted">{t('friends.loading')}</p>
					{/if}
				{:else}
					<p class="muted">{t('friends.groups.members', { count: group.members })}</p>
				{/if}
			</PageSection>
			<SharePanel
				url={groupLink(location.origin, group.code)}
				title={t('friends.groups.share')}
				qrLabel={t('friends.groups.qr')}
				pending={t('friends.loading')}
				code={{ label: t('friends.groups.code'), value: formatGroupCode(group.code) }}
			/>
		</div>
	{/if}
	{#snippet actions()}
		<Button variant="danger" disabled={busy || !group} onclick={() => (confirmOpen = true)}
			>{t(group?.owner ? 'friends.groups.delete' : 'friends.groups.leave')}</Button
		>
	{/snippet}
</Dialog>

{#if group}
	{@const { code, name, owner } = group}
	<ConfirmDialog
		bind:open={confirmOpen}
		danger
		title={t(owner ? 'friends.groups.confirmDelete.title' : 'friends.groups.confirmLeave.title', {
			name
		})}
		description={t(
			owner ? 'friends.groups.confirmDelete.text' : 'friends.groups.confirmLeave.text'
		)}
		disabled={busy}
		onConfirm={() =>
			void change(async () => {
				await groups.leave(code);
				open = false;
			})}
	/>
{/if}

<style>
	.parts {
		display: grid;
		gap: var(--space-4);
	}
	.title {
		display: block;
	}
	.from,
	.muted {
		display: block;
		margin: 0;
		color: var(--on-surface-muted);
		font-size: 0.85rem;
	}
</style>
