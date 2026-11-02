<script lang="ts">
	import { onMount } from 'svelte';
	import { account } from '#lib/features/account/account.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import FriendRows from './FriendRows.svelte';
	import type { GroupGame } from './groups-protocol.ts';
	import { groups } from './groups.svelte.ts';

	/**
	 * Games in your groups, on Join game under the code (plan F6; Trevor, 2026-10-31: "when
	 * starting a game, players just look to that, instead of having to find the associated
	 * code"). Signed in with a group game on, each is a row with Join; otherwise nothing shows,
	 * and as nothing is below it, nothing moves.
	 */
	let { onJoin }: { onJoin: (room: string) => void } = $props();

	onMount(() => void groups.load());

	type Listed = GroupGame & { group: string };
	const games = $derived<Listed[]>(
		(groups.data ?? []).flatMap((group) =>
			group.games.map((game) => ({ ...game, group: group.name }))
		)
	);
</script>

{#snippet label(game: Listed)}
	<span class="title">{game.title || t('friends.invites')}</span>
	<span class="from"
		>{t('friends.groups.storyteller', {
			name: game.storyteller.username ?? t('friends.noUsername')
		})} · {game.group}</span
	>
{/snippet}

{#snippet actions(game: Listed)}
	<Button variant="accent" onclick={() => onJoin(game.room)}>{t('friends.invites.join')}</Button>
{/snippet}

{#if account.status === 'signed-in' && games.length}
	<PageSection title={t('friends.groups.gamesOn')}>
		<FriendRows
			items={games}
			key={(game) => `${game.group}:${game.room}`}
			testid="join-group-games"
			icon={(game) => game.storyteller.icon}
			{label}
			{actions}
		/>
	</PageSection>
{/if}

<style>
	.title {
		display: block;
	}
	.from {
		display: block;
		color: var(--on-surface-muted);
		font-weight: normal;
		font-size: 0.85rem;
	}
</style>
