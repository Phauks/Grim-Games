<script lang="ts">
	import type { SeatId } from '#lib/core/model/index.ts';
	import { survivorsLackDemon } from '#lib/core/rules/index.ts';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import CharacterRow from '#lib/features/characters/CharacterRow.svelte';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import SeatChooser from './SeatChooser.svelte';

	/**
	 * An executed player's character explodes (the Boomdandy,
	 * https://wiki.bloodontheclocktower.com/Boomdandy; `explosionOf` in core): first who lives,
	 * the Storyteller switching on the survivors (3 for the Boomdandy; nobody to start with), and
	 * Confirm kills every other living player, the character as the cause. Then who was pointed
	 * at most after the countdown, among the survivors, or None for a tie. A different number of
	 * survivors, or none of them the Demon, is a note, never a lock.
	 */
	interface Props {
		grimoire: Grimoire;
	}

	let { grimoire }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const ask = $derived(grimoire.explosionAsk);
	const character = $derived(ask && characters.get(ask.characterId));
	const living = $derived(game.seating.filter((s) => !game.seats[s].dead));

	let livesOpen = $state(false);
	let pointedOpen = $state(false);
	let lives = $state<SeatId[]>([]);
	let survivors = $state<SeatId[]>([]);
	$effect(() => {
		if (!ask) return;
		lives = [];
		livesOpen = true;
	});

	function explode() {
		if (!ask) return;
		survivors = lives.filter((s) => !game.seats[s].dead);
		for (const seatId of living)
			if (!lives.includes(seatId))
				grimoire.run({ type: 'SetDead', seatId, dead: true, cause: ask.characterId });
		pointedOpen = true;
	}

	function pointedAt(seatId: SeatId | undefined) {
		const cause = ask?.characterId;
		pointedOpen = false;
		grimoire.explosionAsk = undefined;
		if (seatId && cause) grimoire.run({ type: 'SetDead', seatId, dead: true, cause });
	}

	/* eslint-disable grim/names-as-badges -- dialog titles are plain text; the badge is in the body */
	const livesTitle = $derived(`${character?.name ?? ''}: who lives?`);
	/* eslint-enable grim/names-as-badges */
	const lacksDemon = $derived(lives.length > 0 && survivorsLackDemon(game, lives, characters));
</script>

<ConfirmDialog
	bind:open={livesOpen}
	title={livesTitle}
	danger
	onConfirm={explode}
	onCancel={() => (grimoire.explosionAsk = undefined)}
>
	{#if ask && character}
		<CharacterRow {character} info>
			{#snippet ability()}<GlossaryText
					text={character.ability}
					names={[character.name]}
				/>{/snippet}
		</CharacterRow>
		<ul class="rows" data-testid="explosion-lives">
			{#each living as seatId (seatId)}
				<li>
					<PlayerBadge name={seatName(game, seatId)} />
					<!-- eslint-disable grim/names-as-badges -- hidden label (accessible name) only -->
					<Toggle
						hideLabel
						label={`Lives: ${seatName(game, seatId)}`}
						checked={lives.includes(seatId)}
						onChange={(on) =>
							(lives = on ? [...lives, seatId] : lives.filter((id) => id !== seatId))}
					/>
					<!-- eslint-enable grim/names-as-badges -->
				</li>
			{/each}
		</ul>
		<!-- Always there, so a note never moves the buttons (no reflow). -->
		<p class="note" data-testid="explosion-note">
			{lives.length} of {ask.survivors} live{#if lacksDemon}; the Demon is not among them{/if}
		</p>
	{/if}
</ConfirmDialog>

<SeatChooser
	bind:open={() => pointedOpen, (open) => !open && pointedOpen && pointedAt(undefined)}
	title="Who was pointed at most?"
	{game}
	{characters}
	offer={(seatId) => survivors.includes(seatId)}
	onNone={() => pointedAt(undefined)}
	onChoose={(seatId) => pointedAt(seatId)}
/>

<style>
	.rows {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.rows li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding-block: var(--space-2);
	}
	.rows li + li {
		border-top: var(--card-border);
	}
	.note {
		margin: var(--space-2) 0 0;
		color: var(--on-surface-muted);
	}
</style>
