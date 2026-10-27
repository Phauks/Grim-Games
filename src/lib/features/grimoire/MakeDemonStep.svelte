<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { alignmentOf, type SeatId } from '#lib/core/model/index.ts';
	import { demonMaker, type NightStep } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import CharacterPicker from './CharacterPicker.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import SeatChooser from './SeatChooser.svelte';

	/**
	 * A step whose character makes a Demon tonight (`makesDemon`: the Summoner's Night 3,
	 * Trevor 2026-10-27): the Storyteller picks the player it pointed at, then the Demon. The
	 * Demon list shows nothing of the grimoire, so the device can be handed to the player to
	 * point at one (https://wiki.bloodontheclocktower.com/Summoner: "a Demon icon on the
	 * character sheet"). The chosen player becomes that Demon, evil; Show to player follows.
	 */
	interface Props {
		grimoire: Grimoire;
		step: NightStep;
		/** Show the new Demon to its player. */
		onShow: (characterId: CharacterId) => void;
	}

	let { grimoire, step, onShow }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const maker = $derived(
		step.character ? demonMaker(game, step.character.id, characters) : undefined
	);

	let seatOpen = $state(false);
	let demonOpen = $state(false);
	let chosen = $state<SeatId>();
	let made = $state<{ seatId: SeatId; characterId: CharacterId }>();
	$effect.pre(() => {
		void step.id;
		made = undefined;
	});

	function chooseSeat(seatId: SeatId) {
		seatOpen = false;
		chosen = seatId;
		demonOpen = true;
	}
	function chooseDemon(characterId: CharacterId) {
		demonOpen = false;
		const seatId = chosen;
		chosen = undefined;
		if (!seatId) return;
		if (grimoire.run({ type: 'AssignCharacter', seatId, characterId, alignment: 'evil' }))
			made = { seatId, characterId };
	}
	const playerName = (seatId: SeatId) =>
		game.seats[seatId]?.playerName ?? `Seat ${game.seating.indexOf(seatId) + 1}`;
</script>

{#if maker || made}
	<h3>New Demon</h3>
	<div class="row" data-testid="make-demon">
		{#if made}
			<CharacterBadge
				characterId={made.characterId}
				character={characters.get(made.characterId)}
				alignment={alignmentOf(game, made.seatId)}
				playerName={playerName(made.seatId)}
			/>
			<Button variant="quiet" onclick={() => made && onShow(made.characterId)}
				>Show to player</Button
			>
		{:else}
			<span class="none">None</span>
			<Button variant="quiet" onclick={() => (seatOpen = true)}>Choose</Button>
		{/if}
	</div>
{/if}

<SeatChooser
	bind:open={seatOpen}
	title="Becomes the Demon"
	{game}
	{characters}
	onChoose={chooseSeat}
/>

<CharacterPicker
	bind:open={demonOpen}
	title="Choose a Demon"
	{characters}
	script={game.script}
	types={['demon']}
	onPick={chooseDemon}
/>

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
