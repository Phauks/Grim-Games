<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { reminderCopies, tokenRows } from '#lib/features/board/reminders.ts';
	import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';
	import StepReminderRow from '#lib/features/grimoire/night/StepReminderRow.svelte';
	import ReminderMoveConfirm from '#lib/features/grimoire/reminders/ReminderMoveConfirm.svelte';
	import type { PaneToken, PaneTokenAt, PaneTokenDrag } from './pane-tokens.ts';

	/**
	 * A day row's reminder tokens (Trevor, 2026-11-16: the Virgin's day row "more unified with
	 * how we treat things at night"): each copy with where it is, Place or Move, and the trash,
	 * as a night step lists them, and dragged onto the board beside the pane.
	 */
	interface Props {
		grimoire: Grimoire;
		characterId: CharacterId;
		/** The token in hand, to tap a seat on the board with (as a night step's Place). */
		onPlace: (token: PaneToken, at?: PaneTokenAt) => void;
		onDrag?: PaneTokenDrag;
	}

	let { grimoire, characterId, onPlace, onDrag }: Props = $props();
	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const character = $derived(characters.get(characterId));
	const rows = $derived(
		character
			? tokenRows(
					game,
					character,
					reminderCopies(game, characters, grimoire.copies, grimoire.bankCopies)
				)
			: []
	);
	let moveConfirm = $state<ReturnType<typeof ReminderMoveConfirm>>();
</script>

{#if rows.length > 0}
	<ul class="tokens" data-testid="day-tokens">
		{#each rows as { label, at, key } (key)}
			<li>
				<StepReminderRow
					{game}
					{characters}
					{character}
					{label}
					{at}
					onchoose={() => onPlace({ characterId, label }, at)}
					onreturn={(id) => moveConfirm?.requestReturn(id)}
					ondrag={onDrag && ((x, y, end) => onDrag({ characterId, label }, at, x, y, end))}
				/>
			</li>
		{/each}
	</ul>
	<ReminderMoveConfirm bind:this={moveConfirm} {grimoire} />
{/if}

<style>
	.tokens {
		display: grid;
		gap: var(--space-2);
		margin: var(--space-2) 0 0;
		padding: 0;
		list-style: none;
	}
</style>
