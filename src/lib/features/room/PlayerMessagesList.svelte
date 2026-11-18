<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { roomHost } from './host.svelte.ts';
	import PlayerInbox from './PlayerInbox.svelte';
	import { tablePlayers, tableSpectators } from './table-entries.ts';

	/**
	 * Every player's and spectator's messages, one section each for those who sent any, for a
	 * Messages view of its own under Players (Trevor, 2026-11-18: "separate notes and messages
	 * from players").
	 */
	interface Props {
		game: OpenGame;
	}

	let { game }: Props = $props();

	const host = roomHost();
	const count = (memberId: string) =>
		host.inbox.items.filter((i) => i.memberId === memberId).length;
	const senders = $derived(
		[...tablePlayers(game, host), ...tableSpectators(host)].filter(
			(e) => e.inboxId && count(e.inboxId) > 0
		)
	);
</script>

{#if senders.length === 0}
	<p class="none">{t('common.none')}</p>
{:else}
	<div class="messages" data-testid="player-messages-list">
		{#each senders as entry (entry.key)}
			{@const memberId = entry.inboxId!}
			<Collapsible title={entry.name} level={3} pinned={false} count={count(memberId)} countOpen>
				{#snippet label()}<PlayerBadge name={entry.name} />{/snippet}
				<PlayerInbox {memberId} name={entry.name} />
			</Collapsible>
		{/each}
	</div>
{/if}

<style>
	.messages {
		display: grid;
	}
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
