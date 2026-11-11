<script lang="ts">
	import type { Character, PlayerName } from '#lib/core/data/index.ts';
	import type { Seat } from '#lib/core/model/index.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import { seatCharacterLine } from '#lib/features/game/seat-label.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { CLAIM_KEYS, type NoteClaim } from '#lib/features/day/day-port.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	/** A seat's less frequent actions (its ⋯), in an overlay so the seat sheet stays short. */
	interface Props {
		open: boolean;
		/** The player's name, or "Seat N": the dialog's accessible name. */
		title: string;
		/** The same name as the board's pill, drawn as the second half of the character's badge. */
		playerName: PlayerName | undefined;
		number: number;
		seat: Seat | undefined;
		character: Character | undefined;
		/** The seat's character gains an ability by a swap (the Apprentice, `swapsForAbility`). */
		gainsAbility: boolean;
		/** Another character gives this player an ability without a token (the Boffin, `givesAbility`). */
		holdsAbility: boolean;
		/** The Savant's information generator is offered for this seat. */
		savant: boolean;
		/** The player's claim in town, as on their day row. */
		claim: NoteClaim | undefined;
		/** The seat has a character history to show. */
		hasChanges: boolean;
		onChangeCharacter: () => void;
		onGain: () => void;
		onHeld: () => void;
		/** Gain ability: an ability besides their character's, for any player (M34). */
		onGive: () => void;
		onSavant: () => void;
		onClaim: () => void;
		onAlignment: () => void;
		onNotes: () => void;
		onHistory: () => void;
		onRemove: () => void;
	}

	let {
		open = $bindable(),
		title,
		playerName,
		number,
		seat,
		character,
		gainsAbility,
		holdsAbility,
		savant,
		claim,
		hasChanges,
		onChangeCharacter,
		onGain,
		onHeld,
		onGive,
		onSavant,
		onClaim,
		onAlignment,
		onNotes,
		onHistory,
		onRemove
	}: Props = $props();

	/** Runs a menu action after closing the menu. */
	function fromMenu(action: () => void) {
		open = false;
		action();
	}
</script>

<!-- Type, alignment and seat, as under the name in the seat sheet (Trevor, 2026-10-30). The
     character and its player are the standard badge with player, not a badge beside plain text
     (Trevor, 2026-11-06). -->
<Dialog bind:open {title} description={seatCharacterLine(character?.type, seat?.alignment, number)}>
	{#snippet heading()}
		{#if seat?.characterId && playerName}<CharacterPiece
				template="badge"
				characterId={seat.characterId}
				{character}
				alignment={seat?.alignment}
				{playerName}
			/>{:else if playerName}<PlayerBadge name={playerName} />{:else}{title}{/if}
	{/snippet}
	<div class="menu">
		<Button variant="quiet" icon="swap" onclick={() => fromMenu(onChangeCharacter)}>
			{character ? 'Change character' : 'Choose character'}
		</Button>
		{#if gainsAbility}
			<Button variant="quiet" icon="swap" onclick={() => fromMenu(onGain)}>Gained ability…</Button>
		{/if}
		{#if holdsAbility}
			<Button variant="quiet" icon="swap" onclick={() => fromMenu(onHeld)}>Held ability…</Button>
		{/if}
		<!-- Any player, without changing their character (Trevor, 2026-11-03). -->
		<Button variant="quiet" icon="add" disabled={!seat} onclick={() => fromMenu(onGive)}
			>Gain ability…</Button
		>
		{#if savant}
			<Button variant="quiet" icon="random" onclick={() => fromMenu(onSavant)}>
				Savant information…
			</Button>
		{/if}
		{#if claim}
			<Button variant="quiet" icon="notes" onclick={() => fromMenu(onClaim)}>
				{t(CLAIM_KEYS[claim].name)}…
			</Button>
		{/if}
		<Button
			variant="quiet"
			icon="alignment"
			disabled={!character}
			onclick={() => fromMenu(onAlignment)}
		>
			Change alignment
		</Button>
		<!-- The same notes as in ⋯ Notes on the board (Trevor, 2026-10-19). -->
		<Button variant="quiet" icon="notes" onclick={() => fromMenu(onNotes)}>Notes</Button>
		<!-- Rarely needed, so in here rather than a row of its own (Trevor, 2026-10-18). -->
		<Button
			variant="quiet"
			icon="history"
			disabled={!hasChanges}
			onclick={() => fromMenu(onHistory)}
		>
			Character history
		</Button>
	</div>
	{#snippet headActions()}
		<!-- Beside the close X, as on every sheet (Trevor, 2026-10-17). Removing the character
		     is "None" in Change character. -->
		<DeleteButton label="Remove seat" onclick={() => fromMenu(onRemove)} />
	{/snippet}
</Dialog>

<style>
	.menu {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
</style>
