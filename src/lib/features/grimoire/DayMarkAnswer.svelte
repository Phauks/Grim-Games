<script lang="ts">
	import { rulesIn } from '#lib/core/data/rules/index.ts';
	import type { NightStep } from '#lib/core/rules/index.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * Today's fact a step's character learns, not marked yet (the Demon voted for the
	 * Flowergirl, a Minion nominated for the Town Crier: `dayMark`): Yes or No marks it here,
	 * and the step's answer follows (Trevor, 2026-11-02: the Flowergirl's Yes/No wasn't filled
	 * in). Nothing for a step with no such fact.
	 */
	interface Props {
		grimoire: Grimoire;
		step: NightStep;
	}

	let { grimoire, step }: Props = $props();

	const mark = $derived(
		step.character
			? rulesIn(grimoire.game, step.character.id, grimoire.open.characters)?.dayMark?.mark
			: undefined
	);
</script>

{#if mark && !grimoire.open.viewOnly}
	{@const m = mark}
	<span class="marks" data-testid="day-mark-answer">
		<Button
			variant="quiet"
			onclick={() => grimoire.run({ type: 'SetDayMark', mark: m, value: true })}>Yes</Button
		>
		<Button
			variant="quiet"
			onclick={() => grimoire.run({ type: 'SetDayMark', mark: m, value: false })}>No</Button
		>
	</span>
{/if}

<style>
	.marks {
		display: inline-flex;
		gap: var(--space-2);
	}
</style>
