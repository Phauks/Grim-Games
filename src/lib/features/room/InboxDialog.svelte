<script lang="ts">
	import { seatNumber, type Game } from '#lib/core/model/index.ts';
	import { roomImagePath } from '#lib/core/sync/room-images.ts';
	import type { PlayersPhase } from '#lib/core/rules/game-phase.ts';
	import { phaseText } from '#lib/features/grimoire/phase-text.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import { roomHost } from './host.svelte.ts';
	import { inboxDialog } from './inbox-dialog.svelte.ts';
	import type { InboxItem } from './inbox.svelte.ts';
	import { ALL_INBOX, filterInbox, inboxSenders, type InboxFilter } from './inbox-filter.ts';

	/**
	 * The Storyteller's Messages (Trevor, 2026-10-27: "Combine into a communication menu where
	 * notifications from players about bad images also goes"): players' messages and reported
	 * pictures, newest first, each in its own box (Trevor, 2026-10-28: "Each message should be
	 * a box"). Tapping a box opens it on its own; only then is a message read, and it can be
	 * marked unread again ("only marked as read when entered"). A reported picture is judged
	 * there: let it stand, or take that player's picture away until the next game.
	 */
	interface Props {
		/** The game on the board, for each sender's seat number. */
		game: Game;
	}

	let { game }: Props = $props();
	const host = roomHost();
	const inbox = host.inbox;

	/**
	 * Which boxes show (Trevor, 2026-10-28: "filters to message menu to sort by player and if
	 * requesting consultation and unread or read"); kept while the board is open.
	 */
	let filter = $state<InboxFilter>({ ...ALL_INBOX });
	const shown = $derived(filterInbox(inbox.items, filter));
	const playerOptions = $derived([
		{ value: 'all', label: t('room.inbox.allPlayers') },
		...inboxSenders(inbox.items).map((id) => ({ value: id, label: nameOf(id) }))
	]);

	/** The box opened on its own, by kind and id. */
	let openKey = $state<string>();
	const opened = $derived(inbox.items.find((i) => key(i) === openKey));
	let itemOpen = $state(false);
	$effect(() => {
		// A picture judged, or a game ended, takes its box away: its own view closes with it.
		if (itemOpen && !opened) itemOpen = false;
	});

	function key(item: InboxItem): string {
		return `${item.kind}:${item.id}`;
	}

	function open(item: InboxItem) {
		openKey = key(item);
		itemOpen = true;
		if (item.kind === 'message') inbox.markRead(item.id);
	}

	/** A message still to read, or a picture still to judge. */
	function isNew(item: InboxItem): boolean {
		return item.kind === 'picture' || !item.read;
	}

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

{#snippet who(item: InboxItem)}
	<span class="who">
		<PlayerBadge name={nameOf(item.memberId)} />
		{#if when(item)}<span class="when">{when(item)}</span>{/if}
	</span>
{/snippet}

{#snippet consultLine()}
	<span class="consult" data-testid="inbox-consult"
		><Icon name="messages" />{t('room.inbox.consult')}</span
	>
{/snippet}

<!-- `full`, so the header stays in place and the filters pinned under it while the boxes
     scroll (Trevor, 2026-10-28: "Pin top of message area with controls"). -->
<Dialog bind:open={inboxDialog.open} title={t('room.inbox.title')} size="full">
	<!-- Always in place, so nothing moves as messages come in or filters empty the list. -->
	<div class="filters" data-testid="inbox-filters">
		<Select
			label={t('room.inbox.player')}
			options={playerOptions}
			value={filter.player}
			onChange={(player) => (filter.player = player)}
		/>
		<!-- On/off chips, not a drop-down (Trevor, 2026-10-28: "buttons or something better than
		     a dropdown"); each shows its kind of box while on. -->
		<div class="chips" role="group" aria-label={t('room.inbox.show')}>
			<Chip pressed={filter.unread} onclick={() => (filter.unread = !filter.unread)}
				>{t('room.inbox.readUnread')}</Chip
			>
			<Chip pressed={filter.read} onclick={() => (filter.read = !filter.read)}
				>{t('room.inbox.readRead')}</Chip
			>
			<Chip pressed={filter.consult} onclick={() => (filter.consult = !filter.consult)}
				>{t('room.inbox.consultOnly')}</Chip
			>
		</div>
	</div>
	{#if shown.length === 0}
		<p class="none">{t('room.inbox.none')}</p>
	{:else}
		<ul class="items" data-testid="inbox">
			{#each shown as item (key(item))}
				<li>
					<button
						type="button"
						class="item"
						data-kind={item.kind}
						data-new={isNew(item) ? '' : undefined}
						data-testid="inbox-item"
						onclick={() => open(item)}
					>
						<span class="top">
							<!-- The dot's place is kept when it is off, so nothing shifts as boxes are read. -->
							<span class="dot" class:on={isNew(item)}>
								{#if isNew(item)}<span class="visually-hidden">{t('room.inbox.new')}</span>{/if}
							</span>
							{@render who(item)}
						</span>
						{#if item.kind === 'message'}
							{#if item.consult}{@render consultLine()}{/if}
							{#if item.text}<span class="preview">{item.text}</span>{/if}
						{:else}
							<span class="preview">{t('room.inbox.reported', { count: item.count })}</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</Dialog>

<!-- One message or reported picture on its own (Trevor, 2026-10-28: "allow ability to enter
     each individual message"). -->
<Dialog
	bind:open={itemOpen}
	title={opened?.kind === 'picture' ? t('room.inbox.picture') : t('room.inbox.message')}
>
	{#if opened}
		<div class="opened" data-testid="inbox-opened">
			{@render who(opened)}
			{#if opened.kind === 'message'}
				{#if opened.consult}{@render consultLine()}{/if}
				{#if opened.text}<p class="text">{opened.text}</p>{/if}
			{:else}
				{#if host.code}
					<img
						class="picture"
						src={roomImagePath(host.code, opened.hash)}
						alt={t('room.pictureReport.picture', { name: nameOf(opened.memberId) })}
					/>
				{/if}
				<p class="text">{t('room.inbox.reported', { count: opened.count })}</p>
			{/if}
		</div>
	{/if}
	{#snippet headActions()}
		<!-- Beside ✕ (Trevor, 2026-10-28: "make it an eyeball next to the x"). -->
		{#if opened?.kind === 'message'}
			{@const message = opened}
			<IconButton
				icon="markUnread"
				label={t('room.inbox.markUnread')}
				onclick={() => {
					inbox.markRead(message.id, false);
					itemOpen = false;
				}}
			/>
		{/if}
	{/snippet}
	{#snippet actions()}
		{#if opened?.kind === 'picture'}
			{@const picture = opened}
			<div class="actions">
				<Button onclick={() => inbox.judgePicture(picture.hash, true)}
					>{t('room.pictureReport.allow')}</Button
				>
				<DeleteButton
					label={t('room.pictureReport.removeNamed', { name: nameOf(picture.memberId) })}
					onclick={() => inbox.judgePicture(picture.hash, false)}
				/>
			</div>
		{/if}
	{/snippet}
</Dialog>

<style>
	.filters {
		position: sticky;
		top: 0;
		z-index: 1;
		padding-bottom: var(--space-2);
		background: var(--dialog-background);
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-2) var(--space-3);
		margin-bottom: var(--space-3);
	}
	.filters > :global(*) {
		flex: 1 1 calc(10 * var(--u));
		min-width: 0;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.items {
		display: grid;
		gap: var(--space-2);
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		display: grid;
	}
	/* Each message its own box (Trevor, 2026-10-28), as the notes' cards. */
	.item {
		display: grid;
		gap: var(--space-1);
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-2) var(--space-3);
		border: 0.0625rem solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--on-surface);
		font: inherit;
		text-align: left;
		cursor: pointer;
		touch-action: manipulation;
	}
	.item:hover {
		background: var(--surface-selected);
	}
	.item[data-new] {
		border-color: var(--accent);
	}
	.top {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}
	.dot {
		flex: none;
		width: 0.6em;
		height: 0.6em;
		border-radius: 50%;
	}
	.dot.on {
		background: var(--accent);
	}
	.who {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		min-width: 0;
	}
	.when {
		flex: none;
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
	/* Two lines at most in the list; the whole message shows when it is opened. */
	.preview {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		overflow-wrap: anywhere;
		color: var(--on-surface-muted);
	}
	/* A request to talk in private stands out from the words of the message. */
	.consult {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		font-weight: 600;
		color: var(--accent);
	}
	.opened {
		display: grid;
		gap: var(--space-2);
	}
	.text {
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.picture {
		justify-self: center;
		width: calc(8 * var(--u));
		aspect-ratio: 1;
		border-radius: 50%;
		object-fit: cover;
		background: var(--surface-raised);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--space-2);
	}
</style>
