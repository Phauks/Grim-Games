<script lang="ts">
	import { dayTallyOf, tallyKills, type NightStep } from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * A step whose character kills by a day tally (`dayTally.kills`, the Yaggababble:
	 * https://wiki.bloodontheclocktower.com/Yaggababble): the count the Storyteller kept on the
	 * day row and how many may still die tonight. At night the day log is still the day just
	 * ended, so this reads that day's count. One line, always there: "None" when nothing counts.
	 */
	interface Props {
		grimoire: Grimoire;
		step: NightStep;
	}

	let { grimoire, step }: Props = $props();

	const characters = $derived(grimoire.open.characters);
	const character = $derived(step.character);
	const rule = $derived(character ? dayTallyOf(character.id, characters) : undefined);
	const kills = $derived(
		character && rule?.kills ? tallyKills(grimoire.game, character.id, characters) : undefined
	);
</script>

{#if rule && kills}
	<p class="tally" data-testid="tally-kills">
		{kills.count === 0
			? t('day.tallyKillsNone', { label: rule.label })
			: t('day.tallyKills', { label: rule.label, count: kills.count, left: kills.left })}
	</p>
{/if}

<style>
	.tally {
		margin: var(--space-2) 0;
	}
</style>
