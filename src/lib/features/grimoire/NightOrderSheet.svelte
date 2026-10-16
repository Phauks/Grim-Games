<script lang="ts">
	import { isSeatable, type Character, type NightMarker } from '#lib/core/data/index.ts';
	import {
		MARKER_TEXT,
		nightOrder,
		TRAVELLER_ALIGNMENT_STEP,
		withTravellerAlignmentStep,
		type Night,
		type NightStep
	} from '#lib/core/rules/index.ts';
	import type { Alignment } from '#lib/core/data/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import NightText from '#lib/features/reference/NightText.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Segmented from '#lib/ui/primitives/Segmented.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * The night order for this game: the characters in play that wake tonight, in order,
	 * with TPI's night text. Nothing is automatic: the Storyteller ticks steps off (or skips
	 * them) by hand, and can clear the ticks for the next night.
	 */
	interface Props {
		open: boolean;
		grimoire: Grimoire;
	}

	let { open = $bindable(), grimoire }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	let night = $state<Night>('first');

	const steps = $derived.by((): NightStep[] => {
		const data = officialData.current;
		if (!data || !open) return [];
		// Players wake by the token they hold (a Drunk wakes as their Townsfolk).
		const inPlay: Character[] = [];
		for (const id of [
			...game.seating.map((s) => game.seats[s].characterId),
			...game.ruleCharacters
		]) {
			const c = id ? characters.get(id) : undefined;
			if (c) inPlay.push(c);
		}
		const { steps } = nightOrder({
			night,
			sheet: data.nightSheet,
			inPlay,
			players: inPlay.filter((c) => isSeatable(c.type) && c.type !== 'traveller').length,
			customOrder: night === 'first' ? game.script.meta?.firstNight : game.script.meta?.otherNight,
			overrides: game.nightOrderOverrides
		});
		// A first step to choose any Traveller's alignment that is still unset.
		return withTravellerAlignmentStep(steps, game, characters);
	});

	function setAlignment(seatId: string, alignment: Alignment) {
		grimoire.run({ type: 'SetAlignment', seatId, alignment });
	}

	/** Who holds a step's character, for "Empath · Sam". */
	function holders(step: NightStep) {
		return game.seating.filter((s) => game.seats[s].characterId === step.character?.id);
	}
	const seatName = (seatId: string) =>
		game.seats[seatId].playerName ?? `Seat ${game.seating.indexOf(seatId) + 1}`;

	const done = $derived(grimoire.nightDone);
	const doneKey = (step: NightStep) => `${night}:${step.id}`;
</script>

<Dialog bind:open title="Night order" size="full">
	<div class="head">
		<Segmented
			label="Night"
			hideLabel
			value={night}
			options={[
				{ value: 'first', label: 'First night' },
				{ value: 'other', label: 'Other nights' }
			]}
			onChange={(n) => (night = n)}
		/>
		<Button variant="quiet" disabled={done.length === 0} onclick={() => grimoire.clearNight()}>
			Clear ticks
		</Button>
	</div>
	<ol class="steps">
		{#each steps as step (step.id)}
			{@const ticked = done.includes(doneKey(step))}
			<li class:ticked>
				<button
					type="button"
					class="tick"
					aria-pressed={ticked}
					aria-label={`Done: ${step.kind === 'marker' ? MARKER_TEXT[step.id as NightMarker].name : (step.title ?? step.character?.name ?? step.id)}`}
					onclick={() => grimoire.toggleNightStep(doneKey(step))}>{ticked ? '✓' : ''}</button
				>
				<div class="body">
					<p class="title">
						{#if step.id === TRAVELLER_ALIGNMENT_STEP}
							<strong>{step.title}</strong>
						{:else if step.kind === 'marker'}
							<strong>{MARKER_TEXT[step.id as NightMarker].name}</strong>
						{:else if step.character}
							{@const seats = holders(step)}
							{#if seats.length === 0}
								<CharacterBadge characterId={step.character.id} character={step.character} inline />
							{/if}
							{#each seats as seatId (seatId)}
								<CharacterBadge
									characterId={step.character.id}
									character={step.character}
									alignment={game.seats[seatId].alignment}
									playerName={seatName(seatId)}
									inline
								/>
							{/each}
						{:else}
							<strong>{step.title ?? step.id}</strong>
						{/if}
					</p>
					{#if step.id === TRAVELLER_ALIGNMENT_STEP}
						<ul class="travellers">
							{#each step.travellers ?? [] as seatId (seatId)}
								{@const id = game.seats[seatId]?.characterId}
								<li>
									{#if id}
										<CharacterBadge
											characterId={id}
											character={characters.get(id)}
											playerName={seatName(seatId)}
											inline
										/>
									{/if}
									<span class="spacer"></span>
									<Button variant="quiet" onclick={() => setAlignment(seatId, 'good')}>Good</Button>
									<Button variant="quiet" onclick={() => setAlignment(seatId, 'evil')}>Evil</Button>
								</li>
							{/each}
						</ul>
					{:else if step.reminder}
						<p class="text">
							{#if step.character}
								<NightText text={step.reminder} character={step.character} {night} />
							{:else}
								{step.reminder}
							{/if}
						</p>
					{/if}
				</div>
			</li>
		{:else}
			<li class="none">None</li>
		{/each}
	</ol>
</Dialog>

<style>
	.head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-2);
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--border);
	}
	.steps {
		flex: 1;
		min-height: 0;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		list-style: none;
	}
	li {
		display: grid;
		grid-template-columns: var(--tap-target) 1fr;
		gap: var(--space-2);
		align-items: start;
		padding: var(--space-1) 0;
		border-bottom: 1px solid var(--border);
	}
	li.ticked .body {
		opacity: 0.45;
	}
	.tick {
		width: var(--tap-target);
		height: var(--tap-target);
		border: 2px solid var(--border);
		border-radius: var(--radius-md);
		background: none;
		color: var(--accent);
		font: 700 1.2rem / 1 var(--font-control);
		cursor: pointer;
	}
	.tick:hover {
		background: var(--surface-selected);
	}
	.body p {
		margin: 0;
	}
	.title {
		line-height: 1.9;
	}
	.text {
		font-family: var(--font-ability);
		font-size: 0.95rem;
		line-height: 1.35;
	}
	.travellers {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.travellers li {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.spacer {
		flex: 1;
	}
	.none {
		display: block;
		color: var(--on-surface-muted);
	}
</style>
