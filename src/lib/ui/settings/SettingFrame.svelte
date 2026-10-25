<script lang="ts">
	import { frameById, unlockedFrames, type FrameId } from '#lib/core/frames/index.ts';
	import FrameDrawing from '#lib/ui/seating/FrameDrawing.svelte';
	import SettingSelect from './SettingSelect.svelte';

	/**
	 * A frame picked from a drop-down, each choice drawn beside its name (L4): the Storyteller's
	 * Board default and the player's own frame. Offers only unlocked frames (all of them, until
	 * achievements, A1).
	 */
	interface Props {
		label: string;
		description?: string;
		value: FrameId;
		defaultValue: FrameId;
		onChange: (value: FrameId) => void;
		/** A choice before the frames, such as the player's "Storyteller's default". */
		lead?: { value: FrameId; label: string };
		testid?: string;
	}

	let { label, description, value, defaultValue, onChange, lead, testid }: Props = $props();

	const options = $derived([
		...(lead ? [lead] : []),
		...unlockedFrames().map((frame) => ({ value: frame.id, label: frame.name }))
	]);
</script>

{#snippet swatch(option: { value: FrameId; label: string })}
	{@const frame = frameById(option.value)}
	<span class="option">
		<span class="swatch">
			<span class="face"></span>
			{#if frame}<span class="drawn"><FrameDrawing {frame} /></span>{/if}
		</span>
		{option.label}
	</span>
{/snippet}

<div class="frame-setting" data-setting data-testid={testid}>
	<SettingSelect
		{label}
		{description}
		{value}
		{options}
		{defaultValue}
		{onChange}
		item={swatch}
		selected={swatch}
	/>
</div>

<style>
	.option {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.swatch {
		position: relative;
		flex: none;
		width: 1.75em;
		height: 1.75em;
	}
	/* A plain face, the size it is inside a frame. */
	.face {
		position: absolute;
		inset: 8%;
		border-radius: 50%;
		background: var(--token-face);
	}
	.drawn {
		position: absolute;
		inset: 0;
	}
</style>
