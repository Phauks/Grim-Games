<script lang="ts">
	import { seatName } from '#lib/features/game/seat-label.ts';
	import type { Alignment, CharacterId } from '#lib/core/data/index.ts';
	import { rulesIn } from '#lib/core/data/rules/index.ts';
	import { alignmentOf, trueCharacter, typeOf, type SeatId } from '#lib/core/model/index.ts';
	import {
		changeableSeats,
		characterChanger,
		neighbourAlignments,
		swappableSeats,
		type NightStep
	} from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import AlignmentPill from './AlignmentPill.svelte';
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
	 *
	 * A step that swaps two players' characters (`swapsCharacters`: the Barber's haircuts,
	 * https://wiki.bloodontheclocktower.com/Barber) picks the two players instead; each keeps
	 * their alignment, and each is shown their new character. The Hatter's tea party
	 * (`sameType`, https://wiki.bloodontheclocktower.com/Hatter) lets each Minion and Demon
	 * player change in turn, each into another character of their own type. The Cult Leader
	 * (`takesNeighbourAlignment`, https://wiki.bloodontheclocktower.com/Cult_Leader) shows its
	 * alignment and offers each living neighbour's that differs. On the first night the Kazali
	 * (`upTo: 'minions'`, https://wiki.bloodontheclocktower.com/Kazali) makes evil Minions, one
	 * player after another, until the usual number are in play.
	 */
	interface Props {
		grimoire: Grimoire;
		step: NightStep;
		/** Show the new character to its player. */
		onShow: (characterId: CharacterId) => void;
		/** The characters made tonight on this step, the latest last, for its "You are" card. */
		onChanges?: (characterIds: readonly CharacterId[]) => void;
	}

	let { grimoire, step, onShow, onChanges }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const rule = $derived(
		step.character ? rulesIn(game, step.character.id, characters)?.changesCharacter : undefined
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

	const swaps = $derived(
		step.character ? rulesIn(game, step.character.id, characters)?.swapsCharacters : undefined
	);
	// Any player with a character may be picked; the rule's left-out types are faded, as the
	// Storyteller may still override.
	const swappable = $derived(
		step.character ? new Set(swappableSeats(game, step.character.id, characters)) : new Set()
	);
	const swapMisfits = $derived(
		new Set(game.seating.filter((id) => game.seats[id].characterId && !swappable.has(id)))
	);
	// The Cult Leader's living neighbours' alignments, one of which it takes tonight.
	const neighbours = $derived(
		step.character ? neighbourAlignments(game, step.character.id, characters) : undefined
	);
	const takeAlignment = (seatId: SeatId, alignment: Alignment) =>
		grimoire.run({ type: 'SetAlignment', seatId, alignment });

	let firstOpen = $state(false);
	let secondOpen = $state(false);
	let first = $state<SeatId>();
	let swapped = $state<readonly SeatId[]>();

	function chooseFirst(seatId: SeatId) {
		firstOpen = false;
		first = seatId;
		secondOpen = true;
	}
	function chooseSecond(seatId: SeatId) {
		secondOpen = false;
		const seatA = first;
		first = undefined;
		if (!seatA) return;
		const command = {
			type: 'SwapCharacters' as const,
			seatId: seatA,
			withSeatId: seatId,
			keepAlignments: true as const
		};
		if (grimoire.run(command)) {
			swapped = [seatA, seatId];
			const ids = swapped.flatMap((s) => game.seats[s]?.characterId ?? []);
			onChanges?.(ids);
		}
	}

	let seatOpen = $state(false);
	let characterOpen = $state(false);
	let chosen = $state<SeatId>();
	// Each change made tonight; the Hatter's Minions and Demon may each change (`sameType`), and
	// the Kazali makes Minions until there are as many as usual (`upTo`).
	let made = $state<{ seatId: SeatId; characterId: CharacterId }[]>([]);
	$effect.pre(() => {
		void step.id;
		made = [];
		swapped = undefined;
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
		if (grimoire.run(command)) {
			made = [...made.filter((m) => m.seatId !== seatId), { seatId, characterId }];
			onChanges?.(made.map((m) => m.characterId));
		}
	}
	// With `sameType`, the chosen player picks from their own type, not their own character;
	// with `anyType` too (the Hatter's optional rule), from any of the rule's types.
	const chosenType = $derived(chosen ? typeOf(game, chosen, characters) : undefined);
	const pickTypes = $derived(
		rule?.sameType && !rule.anyType && chosenType ? [chosenType] : (rule?.types ?? [])
	);
	const chosenOwn = $derived(chosen ? trueCharacter(game, chosen, characters) : undefined);
	const left = $derived(rule?.sameType && chosenOwn ? [...inPlay, chosenOwn] : inPlay);
	const playerName = (seatId: SeatId) => seatName(game, seatId);
</script>

{#snippet newCharacter(seatId: SeatId, characterId: CharacterId | undefined)}
	{#if characterId}
		<CharacterBadge
			{characterId}
			character={characters.get(characterId)}
			alignment={alignmentOf(game, seatId)}
			playerName={playerName(seatId)}
		/>
		<Button variant="quiet" onclick={() => onShow(characterId)}>Show to player</Button>
	{/if}
{/snippet}

{#if neighbours}
	{@const now = alignmentOf(game, neighbours.seatId)}
	<h3>Alignment</h3>
	<div class="row" data-testid="neighbour-alignment">
		{#if now}<AlignmentPill alignment={now} />{/if}
		<span class="none"></span>
		{#each neighbours.alignments.filter((a) => a !== now) as alignment (alignment)}
			<Button variant="quiet" onclick={() => takeAlignment(neighbours.seatId, alignment)}
				>Make {alignment}</Button
			>
		{/each}
	</div>
{/if}

{#if swaps && (swappable.size >= 2 || swapped)}
	<h3>Swapped characters</h3>
	<div class="row" data-testid="swap-characters">
		{#if swapped}
			{#each swapped as seatId (seatId)}
				{@render newCharacter(seatId, game.seats[seatId]?.characterId)}
			{/each}
		{:else}
			<span class="none">None</span>
			<Button variant="quiet" onclick={() => (firstOpen = true)}>Choose</Button>
		{/if}
	</div>
	<SeatChooser
		bind:open={firstOpen}
		title="Swaps character"
		{game}
		{characters}
		offer={(id) => !!game.seats[id].characterId}
		misfits={swapMisfits}
		onChoose={chooseFirst}
	/>
	<SeatChooser
		bind:open={secondOpen}
		title="Swaps with"
		{game}
		{characters}
		exclude={first}
		offer={(id) => !!game.seats[id].characterId}
		misfits={swapMisfits}
		onChoose={chooseSecond}
	/>
{/if}

{#if rule && (changer || made.length)}
	<h3>{onlyDemons ? 'New Demon' : 'New character'}</h3>
	<div class="row" data-testid="change-character">
		{#each made as change (change.seatId)}
			{@render newCharacter(change.seatId, change.characterId)}
		{:else}
			<span class="none">None</span>
		{/each}
		{#if !made.length || ((rule.sameType || rule.upTo) && changer)}
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
		types={pickTypes}
		exclude={left}
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
