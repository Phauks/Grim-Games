<script lang="ts">
	import { MODE_PARTS, runsPart, type GameMode, type ModePart } from '#lib/core/modes/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
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
		try {
			await navigator.clipboard.writeText(file);
		} catch {
			// Clipboard blocked: the file is still shown to select by hand.
		}
	}
</script>

<Dialog bind:open title={mode.name} size="full">
	<div class="inspect" data-testid="mode-inspect-scroll">
		<dl class="facts">
			<dt>{t('modes.about')}</dt>
			<dd data-testid="inspect-about">{mode.about ?? t('common.none')}</dd>
			{#if mode.aliases?.length}
				<dt>{t('modes.aliases')}</dt>
				<dd>{mode.aliases.join(', ')}</dd>
			{/if}
			<dt>{t('modes.sources')}</dt>
			<dd>
				<ul role="list">
					{#each mode.sources as source (source.url)}
						<li><ModeValue field="source" value={source} /></li>
					{/each}
				</ul>
			</dd>
			<dt>{t('modes.credits')}</dt>
			<dd>{mode.credits?.length ? mode.credits.join(', ') : t('common.none')}</dd>
		</dl>

		<h3>{t('modes.parts')}</h3>
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

		<Collapsible title={t('modes.file')} level={3} storageKey="mode-file">
			{#snippet aside()}
				<IconButton icon="copy" label={t('modes.copyFile')} onclick={copy} />
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
		gap: var(--space-3);
		overflow-y: auto;
	}
	.facts {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: var(--space-1) var(--space-3);
		margin: 0;
	}
	.facts dt {
		color: var(--on-surface-muted);
	}
	.facts dd {
		margin: 0;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	h3 {
		margin: 0;
		font-size: 1.05rem;
	}
	.parts {
		display: grid;
		gap: var(--space-2);
	}
	.parts li {
		display: grid;
		gap: var(--space-1);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--card-border);
		border-radius: var(--radius-sm);
	}
	.parts li[data-status='standard'] {
		color: var(--on-surface-muted);
	}
	.head {
		display: flex;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.name {
		font-weight: 600;
	}
	.status {
		color: var(--on-surface-muted);
		font-size: 0.9em;
	}
	li[data-status='unconfirmed'] .status {
		color: var(--evil);
	}
	pre {
		max-height: 60vh;
		margin: 0;
		overflow: auto;
		font-size: 0.85rem;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
