<script lang="ts">
	import type { Character, PlayerName } from '#lib/core/data/index.ts';
	import type { Seat, SpokeHow } from '#lib/core/model/index.ts';
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
		/** A rule deals a seat that no one plays (The Ballad of Seat 7). */
		noPlayerRule: boolean;
		/** This is that seat. */
		noPlayer: boolean;
		/** The ways the rule lets the Storyteller speak for it, and those not used yet. */
		speakWays: ('once' | SpokeHow)[];
		speakLeft: ('once' | SpokeHow)[];
		onNoPlayer: (on: boolean) => void;
		onSpeak: (how: 'once' | SpokeHow) => void;
		/** The rule lets the seat vote once a day (Seats Rise Up), and it still may today. */
		votes: boolean;
		mayVote: boolean;
		onVote: () => void;
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
		noPlayerRule,
		noPlayer,
		speakWays,
		speakLeft,
		onNoPlayer,
		onSpeak,
		votes,
		mayVote,
		onVote,
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

	const SPEAK_LABELS: Record<'once' | SpokeHow, string> = {
		once: 'Spoke for this seat',
		private: 'Spoke privately for this seat',
		public: 'Spoke publicly for this seat'
	};

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
		{#if noPlayerRule}
			<!-- Any seat may be the one no one plays (Trevor, 2026-11-12). -->
			<Button
				variant="quiet"
				icon="swap"
				data-testid="seat-no-player"
				onclick={() => fromMenu(() => onNoPlayer(!noPlayer))}
			>
				{noPlayer ? 'Give this seat a player' : 'No player for this seat'}
			</Button>
			<!-- Always drawn under the rule, so the menu doesn't change shape; used ones disable. -->
			{#each speakWays as how (how)}
				<Button
					variant="quiet"
					icon="notes"
					disabled={!noPlayer || !speakLeft.includes(how)}
					onclick={() => fromMenu(() => onSpeak(how))}
				>
					{SPEAK_LABELS[how]}
				</Button>
			{/each}
			{#if votes}
				<Button variant="quiet" icon="vote" disabled={!mayVote} onclick={() => fromMenu(onVote)}>
					Voted with this seat today
				</Button>
			{/if}
		{/if}
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
