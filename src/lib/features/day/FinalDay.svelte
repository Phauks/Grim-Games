<script lang="ts" module>
	import type { CharacterId } from '#lib/core/data/types.ts';
	import type { Game } from '#lib/core/model/index.ts';
	import type { CharacterLookup } from '#lib/core/model/characters.ts';
	import { rulesFor } from '#lib/core/rules/rules-for.ts';

	/**
	 * Whether this rule character's row gets Final day: one in play whose rules give dead
	 * players their vote token back on the final day (`voting.deadRegainToken`, the Ferryman,
	 * https://wiki.bloodontheclocktower.com/Ferryman).
	 */
	export function hasFinalDay(
		game: Game,
		characterId: CharacterId | undefined,
		characters: CharacterLookup
	): boolean {
		return (
			characterId !== undefined &&
			game.ruleCharacters.includes(characterId) &&
			rulesFor(game, characterId, characters)?.voting?.deadRegainToken !== undefined
		);
	}
</script>

<script lang="ts">
	import { ghostVotesRestored } from '#lib/core/rules/day/voting-table.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import type { DayPort } from './day-port.ts';

	/**
	 * Final day: the Storyteller says which day is the final one, as the wiki has them declare
	 * it, so the app never guesses (Trevor, 2026-11-14: option A). Confirming gives every dead
	 * player who used their vote token it back, as one step. Off while nobody has one to get
	 * back.
	 */
	interface Props {
		game: DayPort;
	}

	let { game }: Props = $props();

	const regaining = $derived(ghostVotesRestored(game.game, game.characters, true));
	let open = $state(false);
</script>

<Chip data-testid="final-day" disabled={regaining.length === 0} onclick={() => (open = true)}
	>{t('day.finalDay')}</Chip
>

<ConfirmDialog
	bind:open
	title={t('day.finalDay')}
	onConfirm={() => game.run({ type: 'RegainGhostVotes' })}
>
	{#snippet heading()}{t('day.finalDayTitle')}{/snippet}
	<p class="state">
		<span class="state-label">{t('day.now')}</span><span class="badges"
			>{#each regaining as seatId (seatId)}<PlayerBadge name={game.seatName(seatId)} />{/each}</span
		>
		{t('day.finalDayNow')}
	</p>
	<p class="state">
		<span class="state-label">{t('day.after')}</span>{t('day.finalDayAfter')}
	</p>
</ConfirmDialog>

<style>
	/* As DayPanel's confirmations lay out Now and After. */
	.state {
		margin: 0 0 var(--space-2);
	}
	.state-label {
		display: inline-block;
		min-width: calc(4 * var(--u));
		margin-right: var(--space-2);
		font-weight: 700;
	}
	.badges {
		display: inline-flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		vertical-align: middle;
	}
</style>
