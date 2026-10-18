<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		SCRATCH_COLOURS,
		SCRATCH_PAPERS,
		SIZE_STEPS,
		sizeWidth,
		type ScratchColour,
		type ScratchTool
	} from '#lib/core/scratch/scratch.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import HideContentsButton from '#lib/ui/primitives/HideContentsButton.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import ScratchCanvas from './ScratchCanvas.svelte';
	import { scratchSizes, setScratchSize } from './scratch-sizes.svelte.ts';
	import type { ScratchPadState } from './scratch-store.svelte.ts';

	interface Props {
		pad: ScratchPadState;
	}

	let { pad }: Props = $props();
	let tool = $state<ScratchTool>('pen');
	let colour = $state<ScratchColour>('ink');
	/** True while the size slider moves, and briefly after, so the ring shows on the pad. */
	let sizing = $state(false);
	let sizingTimer: ReturnType<typeof setTimeout> | undefined;

	const step = $derived(scratchSizes[tool]);
	let paperButton = $state<HTMLButtonElement>();
	let choosingPaper = $state(false);

	function resize(value: number) {
		setScratchSize(tool, value);
		sizing = true;
		clearTimeout(sizingTimer);
		sizingTimer = setTimeout(() => (sizing = false), 800);
	}
</script>

<div class="pad" data-scratch-paper={pad.paper}>
	<div class="details">
		<!-- The same title row as a note: the title, then the pad's switches. -->
		<TextField
			label={t('scratch.padTitle')}
			value={pad.title}
			placeholder={t('scratch.untitled')}
			oninput={(title) => pad.rename(title)}
		/>
		<span class="switches">
			<IconButton
				bind:ref={paperButton}
				icon="appearance"
				label={t('scratch.paper')}
				aria-haspopup="dialog"
				aria-expanded={choosingPaper}
				onclick={() => (choosingPaper = !choosingPaper)}
			/>
			<!-- Locked, a pad can stay open on the table without a stray hand marking it. -->
			<IconButton
				icon="lock"
				label={t('scratch.lock')}
				aria-pressed={pad.locked}
				data-testid="scratch-lock"
				onclick={() => pad.setLocked(!pad.locked)}
			/>
			<!-- Per pad, the same switch as each note's (Trevor, 2026-10-17, 2026-10-18). -->
			<HideContentsButton
				hidden={pad.hidden}
				onchange={(hidden) => pad.setHidden(hidden)}
				testid="scratch-hide"
			/>
		</span>
	</div>
	<!-- Locked, every tool stays in place but greyed out, so nothing moves. -->
	<div class="tools" role="toolbar" aria-label={t('scratch.tools')}>
		<button
			type="button"
			class="tool"
			disabled={pad.locked}
			aria-pressed={tool === 'pen'}
			aria-label={t('scratch.pen')}
			title={t('scratch.pen')}
			onclick={() => (tool = 'pen')}><Icon name="pen" /></button
		>
		<!-- eslint-disable-next-line grim/dropdown-choice -- drawing tools switch mid-stroke; a dropdown would cost a tap each time (asked Trevor) -->
		<button
			type="button"
			class="tool"
			disabled={pad.locked}
			aria-pressed={tool === 'eraser'}
			aria-label={t('scratch.eraser')}
			title={t('scratch.eraser')}
			onclick={() => (tool = 'eraser')}><Icon name="eraser" /></button
		>
		<span class="divider" aria-hidden="true"></span>
		{#each SCRATCH_COLOURS as c (c)}
			<!-- Picking a colour also picks the pen. -->
			<button
				type="button"
				class="tool swatch"
				data-colour={c}
				disabled={pad.locked}
				aria-pressed={tool === 'pen' && colour === c}
				aria-label={t(`scratch.colour.${c}`)}
				title={t(`scratch.colour.${c}`)}
				onclick={() => {
					colour = c;
					tool = 'pen';
				}}><span class="dot"></span></button
			>
		{/each}
		<!-- One slider for the chosen tool; each tool keeps its own size. -->
		<div class="size">
			<input
				type="range"
				aria-label={t(`scratch.size.${tool}`)}
				min="1"
				max={SIZE_STEPS}
				step="1"
				disabled={pad.locked}
				value={step}
				oninput={(event) => resize(Number(event.currentTarget.value))}
			/>
			<!-- Fixed width, so the number changing never moves the slider. -->
			<output aria-hidden="true">{step}</output>
		</div>
	</div>
	<ScratchCanvas {pad} {tool} {colour} size={sizeWidth(tool, step)} preview={sizing} />
</div>

<Popover bind:open={choosingPaper} title={t('scratch.paper')} anchor={paperButton}>
	<div class="papers">
		{#each SCRATCH_PAPERS as p (p)}
			<button
				type="button"
				class="paper"
				data-scratch-paper={p}
				aria-pressed={pad.paper === p}
				onclick={() => pad.setPaper(p)}
			>
				<span class="sheet" aria-hidden="true"><span class="ink"></span></span>
				{t(`scratch.paper.${p}`)}
			</button>
		{/each}
	</div>
</Popover>

<style>
	.pad {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		gap: var(--space-2);
	}
	/* The title row, as in a note: the switches line up with the field, under its label. */
	.details {
		display: flex;
		align-items: flex-end;
		gap: var(--space-2);
	}
	.details :global(.text-field) {
		flex: 1;
		min-width: 0;
	}
	.switches {
		display: flex;
		flex: none;
	}
	.papers {
		display: grid;
		gap: var(--space-1);
		margin-top: var(--space-2);
	}
	.paper {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2);
		border: 0;
		border-radius: var(--radius-md);
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
		touch-action: manipulation;
	}
	.paper[aria-pressed='true'] {
		background: var(--surface-selected);
		box-shadow: inset 0 0 0 2px var(--accent);
	}
	.sheet {
		display: grid;
		place-items: center;
		width: calc(2 * var(--u));
		height: calc(2 * var(--u));
		border-radius: var(--radius-sm);
		background: var(--scratch-paper);
		box-shadow: 0 0 0 1px var(--border);
	}
	.sheet .ink {
		width: 40%;
		height: 40%;
		border-radius: var(--radius-full);
		background: var(--scratch-ink);
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
	}
	.size {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex: 1 1 calc(12 * var(--u));
		max-width: calc(20 * var(--u));
	}
	.size input {
		flex: 1;
		min-width: 0;
		min-height: var(--tap-target);
		margin: 0;
		accent-color: var(--accent);
		cursor: pointer;
		touch-action: manipulation;
	}
	.size input:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.size output {
		flex: none;
		min-width: 2ch;
		text-align: end;
		font-variant-numeric: tabular-nums;
	}
	.divider {
		align-self: stretch;
		width: 1px;
		margin: var(--space-1) var(--space-1);
		background: var(--border);
	}
	.tool {
		display: grid;
		place-items: center;
		width: var(--tap-target);
		height: var(--tap-target);
		padding: 0;
		border: 0;
		border-radius: var(--radius-full);
		background: none;
		color: var(--on-surface);
		cursor: pointer;
		touch-action: manipulation;
	}
	.tool:disabled,
	.size input:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.tool[aria-pressed='true'] {
		background: var(--surface-selected);
		box-shadow: inset 0 0 0 2px var(--accent);
	}
	.dot {
		width: 55%;
		height: 55%;
		border-radius: var(--radius-full);
		box-shadow: 0 0 0 1px var(--border);
	}
	.swatch[data-colour='ink'] .dot {
		background: var(--scratch-ink);
	}
	.swatch[data-colour='good'] .dot {
		background: var(--scratch-good);
	}
	.swatch[data-colour='evil'] .dot {
		background: var(--scratch-evil);
	}
	.swatch[data-colour='highlight'] .dot {
		background: var(--scratch-highlight);
	}
</style>
