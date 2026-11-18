<script lang="ts">
	import type { Night } from '#lib/core/model/overrides.ts';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import StepFocusSetting from './StepFocusSetting.svelte';

	/**
	 * The top of the pane's night step: the night's name, which step it is beside it, and Show
	 * to player at the far end (Trevor, 2026-11-16). No Info tokens: the toolbar has it. On
	 * tonight's walk-through, the strip's Character reminders (⋯) and ✕ that stops it.
	 */
	interface Props {
		night: Night;
		/** The open step's place in the night, from 0; -1 for a step not in it. */
		index: number;
		count: number;
		/** No character to show for this step. */
		noShow: boolean;
		onShow: () => void;
		onStop?: () => void;
	}

	let { night, index, count, noShow, onShow, onStop }: Props = $props();
	let focusOpen = $state(false);
	let focusButton = $state<HTMLElement>();
</script>

<header class="head">
	<h2>{night === 'first' ? 'First night' : 'Other nights'}</h2>
	{#if count > 0 && index >= 0}<CountBadge
			count={index + 1}
			total={count}
			testid="step-count"
		/>{/if}
	<span class="end">
		<IconButton icon="showToPlayer" label="Show to player" disabled={noShow} onclick={onShow} />
		{#if onStop}<span bind:this={focusButton}
				><IconButton
					icon="more"
					label="Character reminders"
					onclick={() => (focusOpen = !focusOpen)}
				/></span
			><IconButton icon="close" label="Stop the walk-through" onclick={onStop} />{/if}
	</span>
</header>

<Popover bind:open={focusOpen} title="Character reminders" anchor={focusButton}>
	<StepFocusSetting />
</Popover>

<style>
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		/* The pane's side inset (StorytellerPane). */
		margin-inline: var(--pane-gutter, 0rem);
	}
	h2 {
		margin: 0;
		color: var(--heading);
		font-family: var(--font-heading);
		font-size: 1.1rem;
	}
	.end {
		display: flex;
		margin-inline-start: auto;
	}
</style>
