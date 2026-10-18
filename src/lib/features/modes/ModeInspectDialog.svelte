<script lang="ts">
	import { copyText } from '#lib/ui/clipboard.ts';
	import { MODE_PARTS, runsPart, type GameMode, type ModePart } from '#lib/core/modes/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { downloadFile, fileNameFor } from '#lib/ui/download.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ModeAbout from './ModeAbout.svelte';
	import ModeValue from './ModeValue.svelte';
	import { modeLabel } from './labels.ts';

	/**
	 * Inspect (Trevor, 2026-10-17: "allow transparency and inspection for each aspect"): every
	 * part of a mode, what it is set to, its source and whether the app runs it, then the whole
	 * mode file, which is also the format for writing a new mode.
	 */
	interface Props {
		open: boolean;
		mode: GameMode;
	}

	let { open = $bindable(), mode }: Props = $props();

	type Status = 'standard' | 'runs' | 'storyteller' | 'unconfirmed';
	function status(part: ModePart): Status {
		if (mode.unconfirmed?.includes(part)) return 'unconfirmed';
		if (mode.parts[part] === undefined) return 'standard';
		return runsPart(mode, part) ? 'runs' : 'storyteller';
	}
	const STATUS_LABEL = {
		standard: 'modes.status.standard',
		runs: 'modes.status.runs',
		storyteller: 'modes.status.storyteller',
		unconfirmed: 'modes.status.unconfirmed'
	} as const;
	const file = $derived(JSON.stringify(mode, null, '\t'));

	async function copy() {
		// Clipboard blocked: the file is still shown to select by hand.
		await copyText(file);
	}
</script>

<Dialog bind:open title={mode.name} size="full">
	<div class="inspect" data-testid="mode-inspect-scroll">
		<!-- Each group under its own heading, each part its own card (Trevor, 2026-10-18: "hard
			to tell what is associated with what"). -->
		<section class="group" aria-labelledby="inspect-about-title">
			<h3 id="inspect-about-title">{t('modes.about')}</h3>
			<ModeAbout {mode} />
		</section>

		<section class="group" aria-labelledby="inspect-parts-title">
			<h3 id="inspect-parts-title">{t('modes.parts')}</h3>
			<ul class="parts" role="list">
				{#each MODE_PARTS as part (part)}
					{@const s = status(part)}
					<li data-part={part} data-status={s}>
						<div class="head">
							<span class="name">{modeLabel('part', part)}</span>
							<span class="status">{t(STATUS_LABEL[s])}</span>
						</div>
						{#if mode.parts[part] !== undefined}
							<div class="value"><ModeValue field={part} value={mode.parts[part]} /></div>
						{/if}
					</li>
				{/each}
			</ul>
		</section>

		<!-- Starts closed: the file is for writing modes, rarely needed when inspecting (Trevor, 2026-10-18). -->
		<Collapsible title={t('modes.file')} level={3} startClosed>
			{#snippet aside()}
				<IconButton icon="copy" label={t('modes.copyFile')} onclick={copy} />
				<!-- Copy and Download side by side, as the builders' files (Trevor, 2026-10-18). -->
				<IconButton
					icon="download"
					label={t('modes.downloadFile')}
					onclick={() => downloadFile(fileNameFor(mode.name, mode.id), file)}
				/>
			{/snippet}
			<pre><code>{file}</code></pre>
		</Collapsible>
	</div>
</Dialog>

<style>
	/* A full dialog doesn't scroll itself: its content does (as the Library's script dialog). */
	.inspect {
		display: grid;
		flex: 1;
		min-height: 0;
		align-content: start;
		gap: var(--space-4);
		overflow-y: auto;
	}
	.group {
		display: grid;
		gap: var(--space-2);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	h3 {
		margin: 0;
		padding-bottom: var(--space-1);
		border-bottom: 2px solid var(--border);
		font-size: 1.05rem;
	}
	.parts {
		display: grid;
		gap: var(--space-2);
	}
	/* One card per part: its name and status in a band, what it sets underneath. */
	.parts li {
		overflow: hidden;
		border: var(--card-border);
		border-radius: var(--radius-sm);
	}
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-3);
		background: var(--surface-raised);
	}
	.value {
		padding: var(--space-1) var(--space-3);
		border-top: var(--card-border);
	}
	/* A part the mode leaves standard: just its band, quieter. */
	.parts li[data-status='standard'] {
		color: var(--on-surface-muted);
	}
	.parts li[data-status='standard'] .head {
		background: none;
	}
	.name {
		font-weight: 600;
	}
	.status {
		flex: none;
		color: var(--on-surface-muted);
		font-size: 0.9em;
	}
	li[data-status='unconfirmed'] .status {
		color: var(--evil);
	}
	/* The file runs at full length in the dialog's own scroll, never a small box of its own. */
	pre {
		margin: 0;
		font-size: 0.85rem;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
