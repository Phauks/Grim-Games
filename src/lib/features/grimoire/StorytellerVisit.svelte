<script lang="ts">
	import type { Command } from '#lib/core/engine/index.ts';
	import type { CharacterLookup, Game, SeatId } from '#lib/core/model/index.ts';
	import { storytellerName, storytellerVisit, twoStorytellersBy } from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import StorytellersDialog from './StorytellersDialog.svelte';

	/**
	 * Which of two Storytellers a player went to for their information (a `twoStorytellers`
	 * rule character in play: the Knaves, https://wiki.bloodontheclocktower.com/Knaves), one
	 * tap each, the liar marked; a tap on the chosen one clears it. The info below then offers
	 * false information only for the liar (a warning, never a lock). Nothing while no such
	 * character is in play. The gear opens the names, who lies and the switch.
	 */
	interface Props {
		game: Game;
		characters: CharacterLookup;
		seatId: SeatId;
		/** The seat's name, for the accessible label. */
		seatLabel: string;
		run: (command: Command) => void;
	}

	let { game, characters, seatId, seatLabel, run }: Props = $props();

	const by = $derived(twoStorytellersBy(game, characters));
	const visit = $derived(storytellerVisit(game, seatId, characters));
	const pair = $derived(game.storytellerPair);
	let settingsOpen = $state(false);

	const label = (i: 0 | 1) =>
		storytellerName(pair, i) ?? t('storytellers.default', { number: i + 1 });

	function choose(i: 0 | 1) {
		run({
			type: 'SetStorytellerVisit',
			seatId,
			...(visit?.storyteller === i ? {} : { storyteller: i })
		});
	}
</script>

{#if by}
	<div class="visit" role="group" aria-label={t('storytellers.wentToLabel', { seat: seatLabel })}>
		<span class="label">{t('storytellers.wentTo')}</span>
		{#each [0, 1] as const as i (i)}
			<Chip
				pressed={visit?.storyteller === i}
				data-testid="storyteller-visit"
				onclick={() => choose(i)}
				>{label(i)}{#if pair?.liar === i}<span class="lies">{t('storytellers.lies')}</span
					>{/if}</Chip
			>
		{/each}
		<IconButton
			icon="settings"
			label={t('storytellers.title')}
			onclick={() => (settingsOpen = true)}
		/>
	</div>
	<!-- One line kept for it, so nothing moves when the choice changes. -->
	<p class="what" data-testid="storyteller-what">
		{visit?.lies === true
			? t('storytellers.liarFalse')
			: visit?.lies === false
				? t('storytellers.truthTrue')
				: ''}
	</p>
	<StorytellersDialog bind:open={settingsOpen} {game} {run} />
{/if}

<style>
	.visit {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.label {
		color: var(--on-surface-muted);
	}
	.lies {
		font-size: 0.8em;
		opacity: 0.8;
	}
	.what {
		min-height: 1.4em;
		margin: var(--space-1) 0 var(--space-2);
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
</style>
