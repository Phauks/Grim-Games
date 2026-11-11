<script module lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { CharacterLookup } from '#lib/core/model/index.ts';
	import { dayTallyOf } from '#lib/core/rules/day/day-tally.ts';
	import { makesWish } from '#lib/core/rules/abilities/wishes.ts';

	/** Whether a character's rules give its day row a wish or a count (RuleDayControl). */
	export function hasRuleDayControl(characterId: CharacterId, characters: CharacterLookup) {
		return makesWish(characterId, characters) || dayTallyOf(characterId, characters) !== undefined;
	}
</script>

<script lang="ts">
	import type { SeatId } from '#lib/core/model/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import DayTallyField from './DayTallyField.svelte';
	import WishDialog from './WishDialog.svelte';
	import type { DayPort } from './day-port.ts';

	/**
	 * The day row's control for a character whose rules give it one beyond Used: Wish, opening
	 * the Wish dialog (`wish`, the Wizard's, M17b), or today's count beside the phrase
	 * (`dayTally`, the Yaggababble's, M17c).
	 */
	interface Props {
		game: DayPort;
		characterId: CharacterId;
		seatId: SeatId;
		/** The row's accessible name, character and player. */
		who: string;
	}

	let { game, characterId, seatId, who }: Props = $props();

	let wishDialog = $state<WishDialog>();
</script>

{#if makesWish(characterId, game.characters)}
	<Chip
		marked={game.game.today.entries.some((e) => e.kind === 'wish' && e.seatId === seatId)}
		data-testid="wish"
		aria-label={t('day.wishLabel', { who })}
		onclick={() => wishDialog?.ask(seatId, characterId)}>{t('day.wish')}</Chip
	>
	<WishDialog bind:this={wishDialog} {game} />
{:else}
	<DayTallyField {game} {characterId} />
{/if}
