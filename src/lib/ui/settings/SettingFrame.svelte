<script lang="ts">
	import {
		DEFAULT_LAUREL_COLOUR,
		FACE_RADIUS,
		frameById,
		laurelFrame,
		unlockedFrames,
		type FrameId
	} from '#lib/core/frames/index.ts';
	import {
		LAUREL_COLOUR_NAMES,
		LAUREL_COLOURS,
		type LaurelColour
	} from '#lib/core/achievements/index.ts';
	import FrameDrawing from '#lib/ui/seating/FrameDrawing.svelte';
	import SettingSelect from './SettingSelect.svelte';

	/**
	 * A player's laurel (L4, A1): its form picked from a drop-down, each drawn beside its name,
	 * and its colour beneath. Every fixed frame is a form too (Trevor, 2026-10-27: frames and
	 * laurels combined). The colour row is always there, disabled while the form has fixed
	 * colours, so picking a form never moves the rows below. Offers only unlocked forms (all of
	 * them while the app is in beta).
	 */
	interface Props {
		label: string;
		colourLabel: string;
		description?: string;
		value: FrameId;
		defaultValue: FrameId;
		onChange: (value: FrameId) => void;
		testid?: string;
	}

	let { label, colourLabel, description, value, defaultValue, onChange, testid }: Props = $props();

	const current = $derived(frameById(value));
	const colour = $derived(current?.laurel?.colour ?? DEFAULT_LAUREL_COLOUR);
	const options = $derived(
		unlockedFrames(undefined, colour).map((frame) => ({ value: frame.id, label: frame.name }))
	);
	const colours = Object.keys(LAUREL_COLOURS) as LaurelColour[];
	const colourOptions = colours.map((value) => ({ value, label: LAUREL_COLOUR_NAMES[value] }));
</script>

{#snippet drawn(frameId: FrameId | undefined, text: string)}
	{@const frame = frameById(frameId)}
	<span class="option">
		<span class="swatch">
			<span class="face" style:inset="{50 - (frame?.faceRadius ?? FACE_RADIUS)}%"></span>
			{#if frame}<span class="drawn"><FrameDrawing {frame} /></span>{/if}
		</span>
		{text}
	</span>
{/snippet}

{#snippet form(option: { value: FrameId; label: string })}
	{@render drawn(option.value, option.label)}
{/snippet}

{#snippet tint(option: { value: LaurelColour; label: string })}
	{@render drawn(laurelFrame(current?.laurel?.form ?? 'laurel', option.value).id, option.label)}
{/snippet}

<div class="frame-setting" data-setting data-testid={testid}>
	<SettingSelect
		{label}
		{description}
		{value}
		{options}
		{defaultValue}
		{onChange}
		item={form}
		selected={form}
	/>
</div>
<div class="frame-setting" data-setting>
	<SettingSelect
		label={colourLabel}
		value={colour}
		options={colourOptions}
		defaultValue={DEFAULT_LAUREL_COLOUR}
		disabled={!current?.laurel}
		onChange={(next) => current?.laurel && onChange(laurelFrame(current.laurel.form, next).id)}
		item={tint}
		selected={tint}
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
	/* A plain face, the size it is inside this frame. */
	.face {
		position: absolute;
		border-radius: 50%;
		background: var(--token-face);
	}
	.drawn {
		position: absolute;
		inset: 0;
	}
</style>
