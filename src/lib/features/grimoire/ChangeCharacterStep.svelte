<script lang="ts">
	import { seatName } from '#lib/features/game/seat-label.ts';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { rulesOf } from '#lib/core/data/rules/index.ts';
	import { alignmentOf, trueCharacter, type SeatId } from '#lib/core/model/index.ts';
	import { changeableSeats, characterChanger, type NightStep } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import CharacterPicker from './CharacterPicker.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import SeatChooser from './SeatChooser.svelte';

	/**
	 * A step whose character changes a chosen player's character tonight (`changesCharacter`:
	 * the Pit-Hag, the Summoner's Night 3, the Huntsman's Damsel; Trevor 2026-10-27 and
	 * 2026-10-29): the Storyteller picks the player it pointed at, then the character. The
	 * character list shows nothing of the grimoire, so the device can be handed to the player
	 * to point at one (https://wiki.bloodontheclocktower.com/Summoner: "a Demon icon on the
	 * character sheet"). Show to player follows.
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
	const rule = $derived(
		step.character ? rulesOf(step.character.id, characters)?.changesCharacter : undefined
	);
	const changer = $derived(
		step.character ? characterChanger(game, step.character.id, characters) : undefined
	);
	const onlyDemons = $derived(rule?.types.length === 1 && rule.types[0] === 'demon');
	const offered = $derived(
		step.character ? new Set(changeableSeats(game, step.character.id, characters)) : new Set()
	);
	// Characters someone plays are left out when only not-in-play ones may be picked.
	const inPlay = $derived(
		rule?.notInPlay ? game.seating.flatMap((id) => trueCharacter(game, id, characters) ?? []) : []
	);

	let seatOpen = $state(false);
	let characterOpen = $state(false);
	let chosen = $state<SeatId>();
	let made = $state<{ seatId: SeatId; characterId: CharacterId }>();
	$effect.pre(() => {
		void step.id;
		made = undefined;
	});

	function chooseSeat(seatId: SeatId) {
		seatOpen = false;
		chosen = seatId;
		characterOpen = true;
	}
	function chooseCharacter(characterId: CharacterId) {
		characterOpen = false;
		const seatId = chosen;
		chosen = undefined;
		if (!seatId) return;
		const command = {
			type: 'AssignCharacter' as const,
			seatId,
			characterId,
			...(rule?.alignment ? { alignment: rule.alignment } : {})
		};
		if (grimoire.run(command)) made = { seatId, characterId };
	}
	const playerName = (seatId: SeatId) => seatName(game, seatId);
</script>

{#if rule && (changer || made)}
	<h3>{onlyDemons ? 'New Demon' : 'New character'}</h3>
	<div class="row" data-testid="change-character">
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
	<SeatChooser
		bind:open={seatOpen}
		title={onlyDemons ? 'Becomes the Demon' : 'Changes character'}
		{game}
		{characters}
		offer={(id) => offered.has(id)}
		onChoose={chooseSeat}
	/>
	<CharacterPicker
		bind:open={characterOpen}
		title={onlyDemons ? 'Choose a Demon' : 'Choose a character'}
		{characters}
		script={game.script}
		types={rule.types}
		exclude={inPlay}
		onPick={chooseCharacter}
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
