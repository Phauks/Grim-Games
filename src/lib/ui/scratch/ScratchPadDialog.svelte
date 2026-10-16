<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		isBlank,
		SCRATCH_COLOURS,
		SIZE_STEPS,
		sizeWidth,
		type ScratchColour,
		type ScratchTool
	} from '#lib/core/scratch/scratch.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ScratchCanvas from './ScratchCanvas.svelte';
	import { scratchSizes, setScratchSize } from './scratch-sizes.svelte.ts';
	import type { ScratchPadState } from './scratch-store.svelte.ts';

	interface Props {
		open?: boolean;
		pad: ScratchPadState;
	}

	let { open = $bindable(false), pad }: Props = $props();
	let tool = $state<ScratchTool>('pen');
	let colour = $state<ScratchColour>('ink');
	let confirming = $state(false);
	/** True while the size slider moves, and briefly after, so the ring shows on the pad. */
	let sizing = $state(false);
	let sizingTimer: ReturnType<typeof setTimeout> | undefined;

	const step = $derived(scratchSizes[tool]);

	function resize(value: number) {
		setScratchSize(tool, value);
		sizing = true;
		clearTimeout(sizingTimer);
		sizingTimer = setTimeout(() => (sizing = false), 800);
	}

	const canUndo = $derived(pad.history.strokes.length > 0);
	const canRedo = $derived(pad.history.undone.length > 0);

	// Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, and Cmd on a Mac, while the pad is open.
	function keydown(event: KeyboardEvent) {
		if (!open || confirming || !(event.ctrlKey || event.metaKey)) return;
		const key = event.key.toLowerCase();
		if (key === 'z' && !event.shiftKey) pad.undo();
		else if ((key === 'z' && event.shiftKey) || key === 'y') pad.redo();
		else return;
		event.preventDefault();
	}
</script>

<svelte:window onkeydown={keydown} />

<Dialog bind:open title={t('scratch.title')} size="full">
	{#snippet headActions()}
		<IconButton
			icon="undo"
			label={t('scratch.undo')}
			disabled={!canUndo}
			onclick={() => pad.undo()}
		/>
		<IconButton
			icon="redo"
			label={t('scratch.redo')}
			disabled={!canRedo}
			onclick={() => pad.redo()}
		/>
		<span class="danger">
			<IconButton
				icon="remove"
				label={t('scratch.clear')}
				disabled={isBlank(pad.strokes)}
				onclick={() => (confirming = true)}
			/>
		</span>
	{/snippet}
	<div class="pad">
		<div class="tools" role="toolbar" aria-label={t('scratch.tools')}>
			<button
				type="button"
				class="tool"
				aria-pressed={tool === 'pen'}
				aria-label={t('scratch.pen')}
				title={t('scratch.pen')}
				onclick={() => (tool = 'pen')}><Icon name="pen" /></button
			>
			<button
				type="button"
				class="tool"
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
					aria-pressed={tool === 'pen' && colour === c}
					aria-label={t(`scratch.colour.${c}`)}
					title={t(`scratch.colour.${c}`)}
					onclick={() => {
						colour = c;
						tool = 'pen';
					}}><span class="dot"></span></button
				>
			{/each}
		</div>
		<!-- One slider for the chosen tool; each tool keeps its own size. -->
		<div class="size">
			<input
				type="range"
				aria-label={t(`scratch.size.${tool}`)}
				min="1"
				max={SIZE_STEPS}
				step="1"
				value={step}
				oninput={(event) => resize(Number(event.currentTarget.value))}
			/>
			<!-- Fixed width, so the number changing never moves the slider. -->
			<output aria-hidden="true">{step}</output>
		</div>
		<ScratchCanvas {pad} {tool} {colour} size={sizeWidth(tool, step)} preview={sizing} />
	</div>
</Dialog>

<ConfirmDialog
	bind:open={confirming}
	title={t('scratch.clearConfirm')}
	danger
	onConfirm={() => pad.clear()}
>
	<p>{t('scratch.clearBody')}</p>
</ConfirmDialog>

<style>
	.pad {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		gap: var(--space-2);
		margin-top: var(--space-2);
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
		align-self: center;
		gap: var(--space-3);
		width: min(100%, calc(20 * var(--u)));
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
		background: var(--on-surface);
	}
	.swatch[data-colour='good'] .dot {
		background: var(--good);
	}
	.swatch[data-colour='evil'] .dot {
		background: var(--evil);
	}
	.swatch[data-colour='highlight'] .dot {
		background: var(--heading);
	}
	.danger :global(.icon-button:not(:disabled)) {
		color: var(--evil);
	}
</style>
