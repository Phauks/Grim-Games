<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { dayTallyOf, tallyCount } from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import NumberSelect from '#lib/ui/primitives/NumberSelect.svelte';
	import type { DayPort } from './day-port.ts';

	/**
	 * Today's count for a character's `dayTally` (the Yaggababble's phrase said aloud), on its
	 * day row beside the phrase (M17c). It starts at none each day. Going past it with deaths
	 * warns through the day's toasts; nothing is locked.
	 */
	interface Props {
		game: DayPort;
		characterId: CharacterId;
	}

	let { game, characterId }: Props = $props();

	const rule = $derived(dayTallyOf(characterId, game.characters));
	const count = $derived(tallyCount(game.game.today, characterId));
	// One per player at most, and never fewer than the count already set.
	const max = $derived(Math.max(count, game.game.seating.length));
</script>

{#if rule}
	<NumberSelect
		value={count}
		label={rule.label}
		{max}
		format={(n) => t('day.tallyTimes', { count: n })}
		testid="day-tally"
		onchange={(n) => game.run({ type: 'SetDayTally', characterId, count: n })}
	/>
{/if}
