<script lang="ts">
	import {
		FACE_RADIUS,
		FRAME_FORMS,
		FRAME_MOTION_NAMES,
		FRAME_MOTIONS,
		frameById,
		restyleFrame,
		unlockedFrames,
		type FrameId,
		type FrameMotion
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
	 * then its colour and its motion. Every fixed frame is a form too (Trevor, 2026-10-27: frames
	 * and laurels combined), and any form takes any colour (2026-10-28). Each colour shows as a
	 * plain dot of that colour, not the laurel drawn in it, which was hard to see (Trevor,
	 * 2026-10-28). The colour and motion rows are always there, disabled for None, so picking a
	 * form never moves the rows below.
	 * Offers only unlocked forms (all of them while the app is in beta).
	 */
	interface Props {
		label: string;
		colourLabel: string;
		motionLabel: string;
		description?: string;
		value: FrameId;
		defaultValue: FrameId;
		onChange: (value: FrameId) => void;
		testid?: string;
		/** Locked, as a player's look is during a game (room-look.ts). */
		disabled?: boolean;
	}

	let {
		label,
		colourLabel,
		motionLabel,
		description,
		value,
		defaultValue,
		onChange,
		testid,
		disabled = false
	}: Props = $props();

	const current = $derived(frameById(value) ?? frameById(defaultValue));
	const styled = $derived(current?.form !== undefined);
	const colour = $derived(current?.colour);
	// The colour the form was drawn in before it took any; None shows the laurels' gold.
	const ownColour = $derived<LaurelColour>(
		FRAME_FORMS.find((form) => form.id === current?.form)?.colour ?? 'gold'
	);
	const motion = $derived<FrameMotion>(current?.motion ?? 'none');
	// Every form in the picked colour and motion, so a new form keeps both.
	const options = $derived(
		unlockedFrames(undefined, colour, motion).map((frame) => ({
			value: frame.id,
			label: frame.name
		}))
	);
	const colours = Object.keys(LAUREL_COLOURS) as LaurelColour[];
	const colourOptions = colours.map((value) => ({ value, label: LAUREL_COLOUR_NAMES[value] }));
	const motionOptions = FRAME_MOTIONS.map((value) => ({ value, label: FRAME_MOTION_NAMES[value] }));
	const restyled = (change: { colour?: LaurelColour; motion?: FrameMotion }) =>
		current ? restyleFrame(current, change).id : value;
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
	<span class="option">
		<span class="swatch">
			<span class="dot" style:background={LAUREL_COLOURS[option.value][0]}></span>
		</span>
		{option.label}
	</span>
{/snippet}

{#snippet moving(option: { value: FrameMotion; label: string })}
	{@render drawn(restyled({ motion: option.value }), option.label)}
{/snippet}

<div class="frame-setting" data-setting data-testid={testid}>
	<SettingSelect
		{label}
		{description}
		value={current?.id ?? value}
		{options}
		{defaultValue}
		{onChange}
		{disabled}
		item={form}
		selected={form}
	/>
</div>
<div class="frame-setting" data-setting>
	<SettingSelect
		label={colourLabel}
		value={colour ?? ownColour}
		options={colourOptions}
		defaultValue={ownColour}
		disabled={disabled || !styled}
		onChange={(next) => onChange(restyled({ colour: next }))}
		item={tint}
		selected={tint}
	/>
</div>
<div class="frame-setting" data-setting>
	<SettingSelect
		label={motionLabel}
		value={motion}
		options={motionOptions}
		defaultValue="none"
		disabled={disabled || !styled}
		onChange={(next) => onChange(restyled({ motion: next }))}
		item={moving}
		selected={moving}
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
	/* A colour on its own, in the same box as a drawn laurel so the rows line up. */
	.dot {
		position: absolute;
		inset: 12%;
		border: 0.0625rem solid var(--border);
		border-radius: 50%;
	}
</style>
