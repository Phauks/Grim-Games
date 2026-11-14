<script lang="ts">
	import { seatName } from '#lib/features/game/seat-label.ts';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { alignmentOf, type SeatId } from '#lib/core/model/index.ts';
	import { rulesFor } from '#lib/core/rules/rules-for.ts';
	import { passOnSeats } from '#lib/core/rules/abilities/becomes.ts';
	import { type NightStep } from '#lib/core/rules/night/night-order.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import ShowToPlayerButton from '#lib/features/show/ShowToPlayerButton.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';
	import SeatChooser from '#lib/features/grimoire/seats/SeatChooser.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';

	/**
	 * A step whose character passes on when its player dies (`passesOn`: the Farmer's alive
	 * good player, https://wiki.bloodontheclocktower.com/Farmer): the Storyteller chooses who
	 * becomes it, among the players `passOnSeats` offers, and can show them their new
	 * character. One change per step.
	 */
	interface Props {
		grimoire: Grimoire;
		step: NightStep;
		/** Show the new character to its player. */
		onShow: (characterId: CharacterId) => void;
	}

	let { grimoire, step, onShow }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const characterId = $derived(step.character?.id);
	const passes = $derived(
		characterId ? rulesFor(game, characterId, characters)?.passesOn !== undefined : false
	);
	const offered = $derived(new Set(characterId ? passOnSeats(game, characterId, characters) : []));

	let open = $state(false);
	let made = $state<SeatId>();
	$effect.pre(() => {
		void step.id;
		made = undefined;
	});

	function choose(seatId: SeatId) {
		open = false;
		if (!characterId) return;
		if (grimoire.run({ type: 'AssignCharacter', seatId, characterId })) made = seatId;
	}
</script>

{#if passes && characterId}
	<h3>New character</h3>
	<div class="row" data-testid="pass-on">
		{#if made !== undefined}
			<CharacterPiece
				template="badge"
				{characterId}
				character={characters.get(characterId)}
				alignment={alignmentOf(game, made)}
				playerName={seatName(game, made)}
			/>
			<ShowToPlayerButton onclick={() => onShow(characterId)} />
		{:else}
			<span class="none">{t('common.none')}</span>
			<Button variant="quiet" disabled={offered.size === 0} onclick={() => (open = true)}
				>Choose</Button
			>
		{/if}
	</div>
	<SeatChooser
		bind:open
		title="New character"
		{game}
		{characters}
		offer={(id) => offered.has(id)}
		onChoose={choose}
	/>
{/if}

<style>
	h3 {
		margin: var(--space-2) 0 var(--space-1);
		font-size: 1rem;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.none {
		flex: 1;
		color: var(--on-surface-muted);
	}
</style>
