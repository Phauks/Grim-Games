<script lang="ts">
	import { untrack } from 'svelte';
	import type { SeatId } from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterEntry from '#lib/features/characters/CharacterEntry.svelte';
	import { seatLabel } from '#lib/features/game/seat-label.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * Every note in the game on one screen (Trevor, 2026-10-19): the game's general notes,
	 * then each player's note, headed by their character, seat and name. Player notes live
	 * here, not in the seat sheet; a seat's pen mark or its ⋯ Notes opens just that note's
	 * editor (`edit`). Never shown to players.
	 */
	interface Props {
		open: boolean;
		grimoire: Grimoire;
	}

	let { open = $bindable(), grimoire }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const viewOnly = $derived(grimoire.open.viewOnly);

	// ── Editing one note: 'game' for the general notes, or a seat ──
	let editOpen = $state(false);
	let draft = $state('');
	let editing = $state<'game' | SeatId>();

	/** Opens one note's editor; also used straight from a seat's ⋯ menu, without the sheet. */
	export function edit(target: 'game' | SeatId) {
		editing = target;
		draft = (target === 'game' ? game.notes : game.seats[target]?.note) ?? '';
		editOpen = true;
	}

	/**
	 * Saved as it closes, however it closes, as the seat note always was (Trevor, 2026-10-17:
	 * no Save or Cancel; a swipe down keeps it). One History entry per edit; also saved if the
	 * app is put away mid-edit.
	 */
	function save() {
		const on = editing;
		if (!on || viewOnly) return;
		const before = (on === 'game' ? game.notes : game.seats[on]?.note) ?? '';
		if (draft.trim() === before.trim()) return;
		if (on === 'game') grimoire.run({ type: 'SetGameNotes', notes: draft });
		else grimoire.run({ type: 'SetSeatNote', seatId: on, note: draft });
	}
	$effect(() => {
		if (editOpen) return;
		untrack(() => {
			save();
			editing = undefined;
		});
	});

	const editTitle = $derived(
		editing === undefined
			? ''
			: editing === 'game'
				? 'Game notes'
				: `Note: ${game.seats[editing]?.playerName ?? `Seat ${game.seating.indexOf(editing) + 1}`}`
	);
</script>

<svelte:document
	onvisibilitychange={() => {
		if (document.visibilityState === 'hidden' && editOpen) save();
	}}
/>

<BottomSheet bind:open title="Notes">
	<div class="notes" data-testid="notes-sheet">
		<section aria-labelledby="notes-game">
			<h3 id="notes-game">Game</h3>
			<button
				type="button"
				class="note"
				aria-label={game.notes ? `Game notes: ${game.notes}` : 'Game notes: None'}
				onclick={() => edit('game')}>{game.notes ?? 'None'}</button
			>
		</section>
		<section aria-labelledby="notes-players">
			<h3 id="notes-players">Players</h3>
			<ul>
				{#each game.seating as seatId (seatId)}
					{@const seat = game.seats[seatId]}
					{@const label = seatLabel(game, seatId)}
					<li data-seat={seatId}>
						<!-- Character, seat and name above the note (Trevor, 2026-10-19). -->
						<CharacterEntry
							characterId={seat.characterId}
							alignment={seat.alignment}
							playerName={label}
							{label}
						>
							<button
								type="button"
								class="note"
								aria-label={seat.note
									? `Notes for ${label}: ${seat.note}`
									: `Notes for ${label}: None`}
								onclick={() => edit(seatId)}>{seat.note ?? 'None'}</button
							>
						</CharacterEntry>
					</li>
				{/each}
			</ul>
		</section>
	</div>
</BottomSheet>

{#snippet seatCharacter()}
	<!-- "Note: Ana", then her character on its own line (Trevor, 2026-10-19). -->
	{@const seat = editing && editing !== 'game' ? game.seats[editing] : undefined}
	{#if seat?.characterId}
		<CharacterBadge
			characterId={seat.characterId}
			character={characters.get(seat.characterId)}
			alignment={seat.alignment}
		/>
	{:else}
		None
	{/if}
{/snippet}

<Dialog
	bind:open={editOpen}
	title={editTitle}
	subtitle={editing === undefined || editing === 'game' ? undefined : seatCharacter}
>
	<!-- Several lines: Enter starts a new line, and the field grows with them. Kept on
	     close. Never shown to players. -->
	<div class="editor">
		<TextField
			label={editTitle}
			hideLabel
			multiline
			rows={5}
			bind:value={draft}
			disabled={viewOnly}
			testid="note-editor"
			autogrow
		/>
	</div>
</Dialog>

<style>
	/* Room between the character badge above and the field (Trevor, 2026-10-19). */
	.editor {
		padding-top: var(--space-3);
	}
	.notes {
		display: grid;
		gap: var(--space-4);
	}
	h3 {
		margin: 0 0 var(--space-1);
		font-size: 1rem;
	}
	ul {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* The note as it reads in its editor: the sheet's own text, every line kept. */
	.note {
		display: block;
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: start;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		cursor: pointer;
	}
</style>
