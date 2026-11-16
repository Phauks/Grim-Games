<script lang="ts">
	import type { Snippet } from 'svelte';
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
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import FrameDrawing from '#lib/ui/seating/FrameDrawing.svelte';

	/**
	 * A player's laurel (L4, A1): its form, then its colour and its motion, each a folding group
	 * of tiles showing every choice at once (Trevor, 2026-11-15, Profile option E "make it
	 * expandable"). Each group starts closed with its pick at the end of its header. A form tile
	 * draws the player's own face in that form, in the colour and motion picked; a colour shows
	 * as a plain dot, not the laurel drawn in it, which was hard to see (Trevor, 2026-10-28).
	 * Every fixed frame is a form too (2026-10-27) and any form takes any colour (2026-10-28).
	 * Colour and motion are there for None too, their tiles disabled, so nothing moves.
	 * Offers only unlocked forms (all of them while the app is in beta).
	 */
	interface Props {
		label: string;
		colourLabel: string;
		motionLabel: string;
		value: FrameId;
		defaultValue: FrameId;
		onChange: (value: FrameId) => void;
		/** What sits inside each tile's frame: the player's own avatar. */
		face: Snippet;
		testid?: string;
	}

	let { label, colourLabel, motionLabel, value, defaultValue, onChange, face, testid }: Props =
		$props();

	const current = $derived(frameById(value) ?? frameById(defaultValue));
	const styled = $derived(current?.form !== undefined);
	// The colour the form was drawn in before it took any; None shows the laurels' gold.
	const ownColour = $derived<LaurelColour>(
		FRAME_FORMS.find((form) => form.id === current?.form)?.colour ?? 'gold'
	);
	const colour = $derived(current?.colour ?? ownColour);
	const motion = $derived<FrameMotion>(current?.motion ?? 'none');
	// Every form in the picked colour and motion, so a new form keeps both.
	const forms = $derived(unlockedFrames(undefined, current?.colour, motion));
	const colours = Object.keys(LAUREL_COLOURS) as LaurelColour[];
	const restyled = (change: { colour?: LaurelColour; motion?: FrameMotion }) =>
		current ? restyleFrame(current, change).id : value;
</script>

{#snippet picked(text: string)}<span class="picked">{text}</span>{/snippet}

{#snippet tile(frameId: FrameId, text: string, on: boolean, disabled: boolean)}
	{@const frame = frameById(frameId)}
	<button
		type="button"
		class="tile"
		aria-pressed={on}
		{disabled}
		data-frame-id={frameId}
		onclick={() => onChange(frameId)}
	>
		<span class="swatch"
			><span class="disc">
				<span class="face">{@render face()}</span>
				{#if frame?.drawing.length}<span
						class="drawn"
						style:inset="calc((1 - {50 / (frame.faceRadius ?? FACE_RADIUS)}) * 50%)"
						><FrameDrawing {frame} /></span
					>{/if}
			</span></span
		>
		<span class="tile-label">{text}</span>
	</button>
{/snippet}

<div class="frame-setting" data-testid={testid}>
	<Collapsible title={label} level={3} startClosed>
		{#snippet aside()}{@render picked(current?.name ?? '')}{/snippet}
		<div class="tiles" role="group" aria-label={label} data-testid={testid && `${testid}-forms`}>
			{#each forms as frame (frame.id)}{@render tile(
					frame.id,
					frame.name,
					frame.id === current?.id,
					false
				)}{/each}
		</div>
	</Collapsible>
	<Collapsible title={colourLabel} level={3} startClosed>
		{#snippet aside()}{@render picked(LAUREL_COLOUR_NAMES[colour])}{/snippet}
		<div
			class="tiles colours"
			role="group"
			aria-label={colourLabel}
			data-testid={testid && `${testid}-colours`}
		>
			{#each colours as option (option)}
				<button
					type="button"
					class="tile"
					aria-pressed={styled && option === colour}
					disabled={!styled}
					onclick={() => onChange(restyled({ colour: option }))}
				>
					<span class="swatch"
						><span class="dot" style:background={LAUREL_COLOURS[option][0]}></span></span
					>
					<span class="tile-label">{LAUREL_COLOUR_NAMES[option]}</span>
				</button>
			{/each}
		</div>
	</Collapsible>
	<Collapsible title={motionLabel} level={3} startClosed>
		{#snippet aside()}{@render picked(FRAME_MOTION_NAMES[motion])}{/snippet}
		<div
			class="tiles"
			role="group"
			aria-label={motionLabel}
			data-testid={testid && `${testid}-motions`}
		>
			{#each FRAME_MOTIONS as option (option)}{@render tile(
					restyled({ motion: option }),
					FRAME_MOTION_NAMES[option],
					styled && option === motion,
					!styled
				)}{/each}
		</div>
	</Collapsible>
</div>

<style>
	.frame-setting {
		display: grid;
	}
	.picked {
		color: var(--on-surface-muted);
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(calc(5.5 * var(--u)), 1fr));
		gap: var(--space-2);
		padding-block: var(--space-2) var(--space-3);
	}
	.tiles.colours {
		grid-template-columns: repeat(auto-fill, minmax(calc(4.5 * var(--u)), 1fr));
	}
	.tile {
		display: grid;
		justify-items: center;
		align-content: start;
		gap: var(--space-1);
		min-height: var(--tap-target);
		padding: var(--space-2) var(--space-1);
		border: var(--control-border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: inherit;
		font: inherit;
		font-size: 0.85rem;
		cursor: pointer;
	}
	.tile[aria-pressed='true'] {
		border-color: var(--accent-edge);
		background: var(--surface-selected);
	}
	.tile:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.swatch {
		position: relative;
		width: calc(3.5 * var(--u));
		height: calc(3.5 * var(--u));
	}
	/* The face as on a seat, with room round it for the widest frame. */
	.disc {
		position: absolute;
		inset: 17%;
	}
	.face {
		position: absolute;
		inset: 0;
		overflow: hidden;
		border-radius: 50%;
		background: var(--token-face);
	}
	.drawn {
		position: absolute;
	}
	/* A colour on its own, the same size as a face so the tiles line up. */
	.dot {
		position: absolute;
		inset: 20%;
		border: var(--control-border);
		border-radius: 50%;
	}
	.tile-label {
		text-align: center;
		line-height: 1.2;
	}
</style>
