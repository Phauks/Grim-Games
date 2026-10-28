<script lang="ts">
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { seatNumber, type SeatId } from '#lib/core/model/index.ts';
	import type { InfoPicker, NightStep } from '#lib/core/rules/index.ts';
	import { yesNoAnswers, yesNoSeats } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { seatLabel } from '#lib/features/game/seat-label.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import NightReasonTag from './NightReasonTag.svelte';
	import { seatName } from './night-steps.ts';

	/**
	 * The answer a "yes or no" step gives (Fortune Teller, Seamstress; Trevor, 2026-10-28:
	 * info characters with no options yet): the Storyteller picks the two players chosen and
	 * the valid answers follow, from core's `yesNoAnswers`. Too many pairs to list them all.
	 */
	interface Props {
		grimoire: Grimoire;
		step: NightStep;
		/** Show the Yes/No info token with this answer (Trevor, 2026-10-28). */
		onShowAnswer?: (yes: boolean) => void;
	}

	let { grimoire, step, onShowAnswer }: Props = $props();
	const headingId = $props.id();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const name = (seatId: SeatId) => seatName(game, seatId);
	const pickers = $derived(
		preferences.current.assistance.infoSuggestions && step.info?.kind === 'picker'
			? step.info.pickers.filter((p) => p.kind === 'yes-no')
			: []
	);

	/** The players picked for each waking player, by their seat, in order. */
	let chosen = $state<Record<SeatId, (SeatId | undefined)[]>>({});
	const picked = (p: InfoPicker) => chosen[p.seatId] ?? [];
	function choose(p: InfoPicker, n: number, seatId: SeatId) {
		const next = [...picked(p)];
		next[n] = seatId;
		chosen = { ...chosen, [p.seatId]: next };
	}
	const answers = (p: InfoPicker) => {
		const seats = picked(p).filter((s): s is SeatId => s !== undefined);
		return new Set(seats).size === p.seatCount ? yesNoAnswers(game, p, seats) : [];
	};
</script>

<!-- A seat in the list as the seat chooser gives it (Trevor, 2026-10-28: names were cut to
     "Se…"): its number, its character, the player. -->
{#snippet seatOption(seatId: SeatId)}
	{@const seat = game.seats[seatId]}
	{@const character = seat?.characterId ? characters.get(seat.characterId) : undefined}
	<span class="seat"
		><span class="number">{seatNumber(game, seatId)}</span>{#if character}<CharacterBadge
				characterId={character.id}
				{character}
				alignment={seat?.alignment}
				interactive={false}
			/>{/if}<PlayerBadge name={name(seatId)} /></span
	>
{/snippet}

{#if pickers.length > 0}
	<section aria-labelledby={headingId} data-testid="night-yes-no">
		<h3 id={headingId}>Valid Information</h3>
		<ul>
			{#each pickers as p (p.seatId)}
				{@const options = yesNoSeats(game, p).map((s) => ({
					value: s,
					// The typeahead text; each option shows as the seat (the option snippet).
					label: seatLabel(game, s)
				}))}
				<li>
					{#if pickers.length > 1}<span class="whose"><PlayerBadge name={name(p.seatId)} />:</span
						>{/if}
					<span class="chosen">
						{#each Array.from({ length: p.seatCount }, (_, n) => n) as n (n)}
							<Select
								label={n === 0 ? 'First player chosen' : 'Second player chosen'}
								hideLabel
								placeholder="Chosen"
								attention={picked(p)[n] === undefined}
								value={picked(p)[n]}
								{options}
								listFitsTrigger={false}
								onChange={(s) => choose(p, n, s)}
							>
								{#snippet item(option)}{@render seatOption(option.value)}{/snippet}
								{#snippet selected(option)}<PlayerBadge name={name(option.value)} />{/snippet}
							</Select>
						{/each}
					</span>
					<ul class="valid" aria-label="Valid information">
						{#each answers(p) as a (a.yes)}
							<li data-reason={a.reason}>
								<strong>{a.yes ? 'Yes' : 'No'}</strong>
								<NightReasonTag {grimoire} reason={a.reason} registered={a.registered} />
								{#if onShowAnswer}
									<Button variant="quiet" onclick={() => onShowAnswer(a.yes)}>Show to player</Button
									>
								{/if}
							</li>
						{/each}
					</ul>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	/* The same heading and lists as the step's other Valid Information (NightSuggested). */
	h3 {
		margin: var(--space-2) 0 var(--space-1);
		font-size: 1rem;
	}
	ul {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
	}
	.whose {
		color: var(--on-surface-muted);
	}
	.seat {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		white-space: nowrap;
	}
	.number {
		min-width: 1.5em;
		color: var(--on-surface-muted);
		font-variant-numeric: tabular-nums;
	}
	.chosen {
		display: inline-flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	/* Room for both answers, so picking players never moves what follows. */
	.valid {
		width: 100%;
		gap: var(--space-1);
		min-height: calc(2 * 1.8em + var(--space-1));
	}
	.valid > li + li {
		padding-top: var(--space-1);
		border-top: 1px solid var(--border);
	}
</style>
