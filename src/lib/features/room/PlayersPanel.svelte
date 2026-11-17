<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { seatsInOrder, type SeatId } from '#lib/core/model/index.ts';
	import type { RoomMember } from '#lib/core/sync/room.ts';
	import { roomImagePath } from '#lib/core/sync/room-images.ts';
	import type { PlayerName } from '#lib/core/data/index.ts';
	import type { Command } from '#lib/core/engine/index.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import NoteList from '#lib/ui/notes/NoteList.svelte';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import SeatAvatarButton from '#lib/features/player/SeatAvatarButton.svelte';
	import { wordsOf } from '#lib/core/sync/room-look.ts';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { roomHost } from './host.svelte.ts';
	import { removeFromRoom } from './host-seating.ts';
	import PlayerDisc, { type Phone } from './PlayerDisc.svelte';
	import PlayerInbox from './PlayerInbox.svelte';
	import { playersDialog } from './players-dialog.svelte.ts';
	import RemovedPlayers from './RemovedPlayers.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import GiveSeatDialog from './GiveSeatDialog.svelte';
	import GrimViewSwitch from './GrimViewSwitch.svelte';
	import FeedbackSummary from './FeedbackSummary.svelte';
	import { gameFeedback } from './game-feedback.svelte.ts';
	import ShowRolesButton from './ShowRolesButton.svelte';

	/**
	 * Players (Trevor, 2026-10-29: "player management shouldn't be under share"): every seat,
	 * phone or not, then the phones with no seat. One line each (Trevor, 2026-11-01, "D"): the
	 * seat and phone in one disc, name and character, how many notes, and what waits from them.
	 * One column of pill sections, as the rest of the pane (Trevor, 2026-11-17, "A"): Players,
	 * with Show's eye on its pill; the player tapped, under the list, with their messages, then
	 * their notes (Trevor, 2026-11-01: "place messages on top of notes") and Block; Spectators;
	 * and Player feedback, which opens once the game is over (Trevor, 2026-11-16: "keeps review
	 * separate from the game"). Share is shown to players, so nothing here is on it.
	 */
	interface Props {
		game: OpenGame;
		/** How a note is saved: the board's, with its toasts, or the game's own. */
		run?: (command: Command) => boolean;
		/** The game is over, so players' feedback can be read. */
		ended?: boolean;
	}

	let { game, run = (command) => game.run(command).ok, ended = false }: Props = $props();

	const host = roomHost();
	$effect(() => host.attach(game));

	const seats = $derived(seatsInOrder(game.game));
	/** 1-based seat number, or none. */
	const seatIndex = (seatId?: SeatId) => seats.findIndex((s) => s.seatId === seatId) + 1;

	/** A player at the table: a seat, with the phone sitting there if any, or a phone with no seat. */
	interface Entry {
		key: string;
		seatId?: SeatId;
		name: PlayerName;
		member?: RoomMember;
		/** Whose messages are theirs: the phone's member id. */
		inboxId?: string;
	}
	// Every seat is a player, phone or not (Trevor, 2026-10-29: "every player has a seat. and it
	// would still be player management for the non-phone users"), in seat order; then the phones
	// with no seat from this game, which stay listed while they sleep (earlier games' are left out).
	const players = $derived<Entry[]>(
		seats.map((seat) => {
			const member = host.members.find((m) => m.seatId === seat.seatId);
			const name = seatName(game.game, seat.seatId);
			return { key: seat.seatId, seatId: seat.seatId, name, member, inboxId: member?.memberId };
		})
	);
	// Spectators, in their own section (Trevor, 2026-11-03): the phones with no seat.
	const spectators = $derived<Entry[]>(
		host.unseatedInGame.flatMap((m) =>
			m.name ? [{ key: m.memberId, name: m.name, member: m, inboxId: m.memberId }] : []
		)
	);
	const entries = $derived([...players, ...spectators]);

	const phoneOf = (entry: Entry): Phone =>
		!entry.member ? 'none' : host.isHere(entry.member.memberId) ? 'here' : 'away';
	const PHONE_TEXT = {
		here: 'room.players.here',
		away: 'room.players.away',
		none: 'room.players.noPhone'
	} as const;

	function where(entry: Entry): string {
		const n = seatIndex(entry.seatId);
		const seat = n ? t('common.seat', { number: n }) : t('room.noSeat');
		return t('room.players.where', { seat, state: t(PHONE_TEXT[phoneOf(entry)]) });
	}

	/** What waits from this player (the seat's mark on the board shows the same). */
	const waiting = (memberId: string) => host.inbox.waitingFrom(memberId);
	const inboxCount = (memberId: string) =>
		host.inbox.items.filter((i) => i.memberId === memberId).length;

	const pictureOf = (m: RoomMember) =>
		m.picture && host.code ? roomImagePath(host.code, m.picture) : undefined;

	// ── The player shown beside the list: the one tapped, else the first. ──
	let chosenKey = $state<string>();
	const chosen = $derived(entries.find((e) => e.key === chosenKey) ?? entries[0]);
	/** The list, to bring a chosen player's line into view. */
	let list = $state<HTMLElement>();
	// A seat's pen mark or its ⋯ Notes opens Players at that player. Two frames on, once Players
	// is laid out.
	$effect(() => {
		const seatId = playersDialog.seat;
		if (seatId === undefined) return;
		playersDialog.seat = undefined;
		chosenKey = seatId;
		requestAnimationFrame(() =>
			requestAnimationFrame(() =>
				list
					?.querySelector(`[data-seat="${CSS.escape(seatId)}"]`)
					?.scrollIntoView({ block: 'nearest' })
			)
		);
	});

	/** The chosen player's seat, or that they have none. */
	const seatText = (entry: Entry) => {
		const n = seatIndex(entry.seatId);
		return n ? t('common.seat', { number: n }) : t('room.noSeat');
	};

	// ── Players' feedback, saved with the game on this device (Trevor, 2026-10-25) ──
	const feedback = $derived(ended ? gameFeedback.read(game.game.gameId) : []);
	const seatOf = (seatId: string) => seatIndex(seatId as SeatId) || undefined;

	// ── Give a seat: the spectator being seated, while its seat list is open ──
	let giving = $state<{ member: RoomMember; name: PlayerName }>();

	// ── Block (plan J37): this game only, and the Blocked list can let them back ──
	let removing = $state<{ memberId: string; name: PlayerName }>();
	let confirmRemove = $state(false);
	function remove() {
		if (!removing) return;
		removeFromRoom(host, game, removing.memberId);
	}

	// ── Each player's notes, the same notes as before ──
	const viewOnly = $derived(game.viewOnly);
	const seatNotes = (seatId: SeatId | undefined) =>
		(seatId && game.game.seats[seatId]?.notes) || [];
	type Written = { noteId?: string; title: string; text: string; hidden: boolean };
	function saveNote(seatId: SeatId, note: Written) {
		if (viewOnly) return;
		run({ type: 'SetSeatNote', seatId, ...note });
	}
	function deleteNote(seatId: SeatId, noteId: string) {
		if (viewOnly) return;
		run({ type: 'DeleteSeatNote', seatId, noteId });
	}
</script>

{#snippet nameAndCharacter(entry: Entry)}
	{@const seat = entry.seatId && game.game.seats[entry.seatId]}
	{#if seat && seat.characterId}<CharacterPiece
			template="badge"
			characterId={seat.characterId}
			character={game.characters.get(seat.characterId)}
			alignment={seat.alignment}
			playerName={entry.name}
			interactive={false}
		/>{:else}<PlayerBadge name={entry.name} />{/if}
{/snippet}

{#snippet disc(entry: Entry)}
	<PlayerDisc
		name={entry.name}
		seat={seatIndex(entry.seatId) || undefined}
		phone={phoneOf(entry)}
		avatar={entry.member?.avatar}
		picture={entry.member && pictureOf(entry.member)}
	/>
{/snippet}

{#snippet line(entry: Entry)}
	{@const wait = entry.inboxId ? waiting(entry.inboxId) : { count: 0, urgent: false }}
	{@const notes = seatNotes(entry.seatId).length}
	<li data-testid="room-player" data-seat={entry.seatId}>
		<button
			type="button"
			class="line"
			aria-current={chosen?.key === entry.key ? 'true' : undefined}
			onclick={() => (chosenKey = entry.key)}
		>
			{@render disc(entry)}
			<span class="who">
				{@render nameAndCharacter(entry)}
				{#if !entry.seatId}<span class="muted">{t('room.noSeat')}</span>{/if}
			</span>
			<!-- Two fixed slots, so rows line up and never shift as notes and messages come and go. -->
			<span class="slot notes" data-testid="room-player-notes"
				>{#if notes}<Icon name="notes" label={t('room.players.notes', { count: notes })} /><small
						aria-hidden="true">{notes}</small
					>{/if}</span
			>
			<span class="slot waiting">
				{#if wait.count}<CountBadge
						count={wait.count}
						warn={wait.urgent}
						testid="room-player-waiting"
					/>{/if}
			</span>
		</button>
	</li>
{/snippet}

{#snippet show()}<ShowRolesButton {game} />{/snippet}

<div class="players-room" data-testid="players-room">
	<!-- Pill sections, as the rest of the pane (Trevor, 2026-11-17); a closed one counts what
	     it holds (Trevor, 2026-11-01). -->
	<Collapsible
		title={t('room.players.title')}
		storageKey="players-list"
		band="fill"
		pinned={false}
		count={players.length}
		aside={show}
	>
		{#if players.length === 0}
			<p class="none">{t('common.none')}</p>
		{:else}
			<ul class="list" aria-label={t('room.players.title')} bind:this={list}>
				{#each players as entry (entry.key)}{@render line(entry)}{/each}
			</ul>
		{/if}
	</Collapsible>
	{#if chosen}
		{@const who = chosen}
		<!-- Their seat and name badge (names always show as badges). -->
		<Collapsible title={seatText(who)} storageKey="players-chosen" band="fill" pinned={false}>
			{#snippet label()}<span class="chosen-label"
					>{#if who.name !== seatText(who)}{seatText(who)}{/if}<PlayerBadge name={who.name} /></span
				>{/snippet}
			{@render details(who)}
		</Collapsible>
	{/if}
	<!-- Spectators (Trevor, 2026-11-03): phones with no seat. Whether they may message is in
	     Game settings (Trevor, 2026-11-16). -->
	<Collapsible
		title={t('room.spectators')}
		storageKey="players-spectators"
		band="fill"
		pinned={false}
		count={spectators.length}
	>
		<div data-testid="room-spectators">
			{#if spectators.length === 0}
				<p class="none">{t('common.none')}</p>
			{:else}
				<ul class="list" aria-label={t('room.spectators')}>
					{#each spectators as entry (entry.key)}{@render line(entry)}{/each}
				</ul>
			{/if}
		</div>
	</Collapsible>
	<!-- Kept in place, closed, until the game is over, so nothing moves when it ends. -->
	<Collapsible
		title={t('room.feedback.view')}
		storageKey="players-feedback"
		band="fill"
		pinned={false}
		disabled={!ended}
		count={feedback.length}
		empty={feedback.length === 0}
	>
		<FeedbackSummary entries={feedback} {seatOf} />
	</Collapsible>
	{#if host.code}<RemovedPlayers />{/if}
</div>

<!-- The chosen player: who and where, then their messages and notes. -->
{#snippet details(entry: Entry)}
	{#key entry.key}
		<div class="details" data-testid="room-player-sheet" data-seat={entry.seatId}>
			<header class="head">
				{#if entry.member}<SeatAvatarButton
						name={entry.name}
						avatar={entry.member.avatar ?? 'initials'}
						picture={pictureOf(entry.member)}
						frame={entry.member.frame}
						words={wordsOf(entry.member)}
						friend={host.code && entry.seatId
							? { code: host.code, seatId: entry.seatId }
							: undefined}
					/>{:else}{@render disc(entry)}{/if}
				<span class="head-text">
					<span class="name">{@render nameAndCharacter(entry)}</span>
					<span class="muted" data-testid="room-player-where">{where(entry)}</span>
				</span>
				<!-- A red trash, asking first (Trevor's UI rules). -->
				{#if entry.member && host.code && !viewOnly}
					{@const memberId = entry.member.memberId}
					{@const name = entry.name}
					<DeleteButton
						label={t('room.players.remove')}
						data-testid="room-player-remove"
						onclick={() => {
							removing = { memberId, name };
							confirmRemove = true;
						}}
					/>
				{/if}
			</header>
			<!-- A spectator is seated from here, in any phase (Trevor, 2026-11-06, "Give a seat"). -->
			{#if entry.member && !entry.seatId && host.code && !viewOnly}
				{@const member = entry.member}
				{@const name = entry.name}
				<Button icon="arrange" data-testid="give-seat" onclick={() => (giving = { member, name })}
					>{t('room.giveSeat')}</Button
				>
			{/if}
			<!-- Grim view, under Give a seat (Trevor, 2026-11-16, option A). -->
			{#if entry.member && host.code}<GrimViewSwitch
					memberId={entry.member.memberId}
					name={entry.name}
					disabled={viewOnly}
				/>{/if}
			{#if entry.inboxId}
				{@const count = inboxCount(entry.inboxId)}
				<Collapsible
					title={t('room.inbox.title')}
					level={3}
					storageKey="players-messages"
					pinned={false}
					{count}
					countOpen
				>
					<PlayerInbox memberId={entry.inboxId} name={entry.name} />
				</Collapsible>
			{/if}
			{#if entry.seatId}
				{@const seatId = entry.seatId}
				<Collapsible
					title={t('room.players.notesHeading')}
					level={3}
					storageKey="players-notes"
					pinned={false}
					count={seatNotes(seatId).length}
					countOpen
				>
					<NoteList
						notes={seatNotes(seatId)}
						readonly={viewOnly}
						onSave={(note) => saveNote(seatId, note)}
						onDelete={(noteId) => deleteNote(seatId, noteId)}
						hideable={false}
					/>
				</Collapsible>
			{/if}
		</div>
	{/key}
{/snippet}

{#if giving}<GiveSeatDialog
		bind:open={
			() => !!giving,
			(on) => {
				if (!on) giving = undefined;
			}
		}
		{game}
		member={giving.member}
		name={giving.name}
		{run}
	/>{/if}

<ConfirmDialog
	bind:open={confirmRemove}
	title={t('room.players.removeConfirm')}
	danger
	onConfirm={remove}
>
	{#if removing}<PlayerBadge name={removing.name} />{/if}
	<p>{t('room.players.removeBody')}</p>
</ConfirmDialog>

<style>
	/* One column that scrolls as a whole, its sections one under another (Trevor, 2026-11-17). */
	.players-room {
		display: grid;
		flex: 1;
		gap: var(--space-3);
		align-content: start;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		/* The pane's side inset inside this scroll box, so its scrollbar is flush (the pane's). */
		padding: 0 var(--pane-gutter, 0rem) var(--space-3);
	}
	.chosen-label {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}
	.none,
	.muted {
		margin: 0;
		color: var(--on-surface-muted);
		font-size: 0.95rem;
		white-space: nowrap;
	}
	.list {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Rows with dividers, not cards (Trevor). */
	.list > li {
		border-bottom: 1px solid var(--border);
	}
	.line {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--tap-target);
		padding: calc(0.25 * var(--u)) var(--space-1);
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.line[aria-current] {
		border-radius: var(--radius-md);
		background: var(--surface);
		box-shadow: inset 0 0 0 1px var(--border);
	}
	.who {
		display: flex;
		flex: 1;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}
	.slot {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 1.9em;
		color: var(--on-surface-muted);
	}
	.slot small {
		font-size: 0.8rem;
	}
	.details {
		display: grid;
		gap: var(--space-2);
		align-content: start;
	}
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.head-text {
		display: grid;
		flex: 1;
		gap: calc(0.25 * var(--u));
		justify-items: start;
		min-width: 0;
	}
	.name {
		display: flex;
		max-width: 100%;
		min-width: 0;
	}
</style>
