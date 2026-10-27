<script lang="ts">
	import { untrack } from 'svelte';
	import { seatNumber, type Game } from '#lib/core/model/index.ts';
	import { roomImagePath } from '#lib/core/sync/room-images.ts';
	import type { PlayersPhase } from '#lib/core/rules/game-phase.ts';
	import { phaseText } from '#lib/features/grimoire/phase-text.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { roomHost } from './host.svelte.ts';
	import { inboxDialog } from './inbox-dialog.svelte.ts';
	import type { InboxItem } from './inbox.svelte.ts';

	/**
	 * The Storyteller's Messages (Trevor, 2026-10-27: "Combine into a communication menu where
	 * notifications from players about bad images also goes"): players' messages and reported
	 * pictures, newest first, one row each with a line between. A reported picture is judged in
	 * its row: let it stand, or take that player's picture away until the next game. What was
	 * new when it opened keeps its dot until it closes; opening it reads every message.
	 */
	interface Props {
		/** The game on the board, for each sender's seat number. */
		game: Game;
	}

	let { game }: Props = $props();
	const host = roomHost();
	const inbox = host.inbox;
	/** What was new when Messages opened, so its dots stay while it is open. */
	let fresh = $state<ReadonlySet<string>>(new Set());

	$effect(() => {
		if (!inboxDialog.open) return;
		untrack(() => {
			fresh = new Set(inbox.items.flatMap((i) => (i.kind === 'picture' || !i.read ? [i.id] : [])));
			inbox.readAll();
		});
	});
	// A message that comes in while Messages is open is read there and then, and keeps its dot.
	$effect(() => {
		if (!inboxDialog.open) return;
		const unread = inbox.messages.filter((m) => !m.read).map((m) => m.id);
		if (unread.length === 0) return;
		untrack(() => {
			fresh = new Set([...fresh, ...unread]);
			inbox.readAll();
		});
	});

	function nameOf(memberId: string): string {
		return (
			host.members.find((m) => m.memberId === memberId)?.name ?? t('room.pictureReport.someone')
		);
	}

	/** "Seat 4 · Day 2", or as much of it as is known. */
	function when(item: InboxItem): string {
		const seatId = host.members.find((m) => m.memberId === item.memberId)?.seatId;
		const number = seatId ? seatNumber(game, seatId) : undefined;
		const seat = number === undefined ? '' : t('common.seat', { number });
		const phase = item.kind === 'message' && item.phase ? phaseName(item.phase) : '';
		return seat && phase ? t('room.inbox.when', { seat, phase }) : seat || phase;
	}

	function phaseName(phase: PlayersPhase): string {
		if (phase.kind === 'setup') return phaseText(phase);
		return phaseText({ kind: phase.kind === 'night' ? 'night' : 'day', number: phase.number });
	}
</script>

<Dialog bind:open={inboxDialog.open} title={t('room.inbox.title')}>
	{#if inbox.items.length === 0}
		<p class="none">{t('room.inbox.none')}</p>
	{:else}
		<ul class="items" data-testid="inbox">
			{#each inbox.items as item (item.kind + item.id)}
				<li class="item" data-kind={item.kind} data-testid="inbox-item">
					<span class="dot" class:on={fresh.has(item.id)}>
						{#if fresh.has(item.id)}<span class="visually-hidden">{t('room.inbox.new')}</span>{/if}
					</span>
					{#if item.kind === 'picture' && host.code}
						<img
							class="picture"
							src={roomImagePath(host.code, item.hash)}
							alt={t('room.pictureReport.picture', { name: nameOf(item.memberId) })}
						/>
					{/if}
					<div class="body">
						<div class="who">
							<PlayerBadge name={nameOf(item.memberId)} />
							{#if when(item)}<span class="when">{when(item)}</span>{/if}
						</div>
						{#if item.kind === 'message'}
							<p class="text">{item.text}</p>
						{:else}
							<p class="text">{t('room.inbox.reported', { count: item.count })}</p>
							<div class="judge">
								<Button onclick={() => inbox.judgePicture(item.hash, true)}
									>{t('room.pictureReport.allow')}</Button
								>
								<DeleteButton
									label={t('room.pictureReport.removeNamed', { name: nameOf(item.memberId) })}
									onclick={() => inbox.judgePicture(item.hash, false)}
								/>
							</div>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</Dialog>

<style>
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.items {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.item {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		padding: var(--space-3) 0;
	}
	.item + .item {
		border-top: 0.0625rem solid var(--border);
	}
	/* The dot's place is kept when it is off, so rows never shift as they are read. */
	.dot {
		flex: none;
		width: 0.6em;
		height: 0.6em;
		margin-top: 0.5em;
		border-radius: 50%;
	}
	.dot.on {
		background: var(--accent);
	}
	.picture {
		flex: none;
		width: calc(3 * var(--u));
		aspect-ratio: 1;
		border-radius: 50%;
		object-fit: cover;
		background: var(--surface-raised);
	}
	.body {
		flex: 1;
		min-width: 0;
		display: grid;
		gap: var(--space-1);
	}
	.who {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}
	.when {
		flex: none;
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
	.text {
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.judge {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--space-2);
	}
</style>
