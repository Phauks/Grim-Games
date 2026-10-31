<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { NightStep } from '#lib/core/rules/index.ts';
	import { shownToSeats } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { seatName } from './night-steps.ts';

	/**
	 * Who this step wakes to show its character's token (`shownTo` in its rules block): the
	 * player carrying the Widow's Know, or every Minion for the Damsel. Shown with one tap,
	 * as the step's other Valid Information is; "None" until anyone qualifies.
	 */
	interface Props {
		grimoire: Grimoire;
		step: NightStep;
		onShow: (characterId: CharacterId) => void;
	}

	let { grimoire, step, onShow }: Props = $props();
	const headingId = $props.id();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const seats = $derived(
		step.character ? shownToSeats(game, step.character.id, characters) : undefined
	);
</script>

{#if step.character && seats}
	<section aria-labelledby={headingId} data-testid="night-shown-to">
		<h3 id={headingId}>{t('show.shownTo.heading')}</h3>
		<p class="row">
			{#each seats as seatId, n (seatId)}{n ? ', ' : ''}<PlayerBadge
					name={seatName(game, seatId)}
				/>{:else}{t('common.none')}{/each}
			<span class="see">{t('show.shownTo.sees')}</span>
			<CharacterBadge
				characterId={step.character.id}
				character={step.character}
				interactive={false}
			/>
		</p>
		<Button variant="quiet" icon="showToPlayer" onclick={() => onShow(step.character!.id)}
			>{t('show.toPlayer')}</Button
		>
	</section>
{/if}

<style>
	/* The same heading as the step's other Valid Information (NightSuggested). */
	h3 {
		margin: var(--space-2) 0 var(--space-1);
		font-size: 1rem;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		margin: 0 0 var(--space-1);
	}
	.see {
		color: var(--on-surface-muted);
	}
</style>
