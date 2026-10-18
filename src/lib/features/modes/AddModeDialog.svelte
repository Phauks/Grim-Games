<script lang="ts">
	import type { GameMode } from '#lib/core/modes/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import { customModes } from './custom-modes.svelte.ts';

	/**
	 * Adds a mode file someone wrote, pasted or uploaded. Every problem is listed with its
	 * path (parseGameMode), so a file can be fixed in one go. Copy a built-in mode's file from
	 * Inspect to start from it.
	 */
	interface Props {
		open?: boolean;
		onadded: (mode: GameMode) => void;
	}

	let { open = $bindable(false), onadded }: Props = $props();

	let text = $state('');
	let issues = $state<string[]>([]);
	let fileInput = $state<HTMLInputElement>();

	$effect(() => {
		if (!open) {
			text = '';
			issues = [];
		}
	});

	async function save() {
		const data = await loadOfficialData();
		const result = customModes.add(text, new Set(data.characters.map((c) => c.id)));
		if (!result.ok) {
			issues = result.issues;
			return;
		}
		open = false;
		onadded(result.mode);
	}

	async function onFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		text = await file.text();
		issues = [];
	}
</script>

<Dialog bind:open title={t('modes.add.title')}>
	<label class="field">
		<span>{t('modes.add.label')}</span>
		<textarea
			bind:value={text}
			rows="10"
			spellcheck="false"
			autocomplete="off"
			data-testid="mode-file"
			oninput={() => (issues = [])}></textarea>
	</label>
	<!-- Room for the problems is reserved, so they never move the buttons. -->
	<div class="issues" role="status">
		{#if issues.length > 0}
			<ul>
				{#each issues as issue (issue)}<li>{issue}</li>{/each}
			</ul>
		{/if}
	</div>
	{#snippet actions()}
		<ModalActions
			onCancel={() => (open = false)}
			onConfirm={() => void save()}
			disabled={text.trim() === ''}
		>
			{#snippet start()}
				<Button variant="quiet" icon="uploadFile" onclick={() => fileInput?.click()}>
					{t('modes.add.upload')}
				</Button>
			{/snippet}
		</ModalActions>
	{/snippet}
</Dialog>

<input
	bind:this={fileInput}
	class="file"
	type="file"
	accept=".json,application/json,text/plain"
	aria-label={t('modes.add.upload')}
	onchange={onFile}
/>

<style>
	.file {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}
	.field {
		display: grid;
		gap: var(--space-1);
	}
	textarea {
		width: 100%;
		box-sizing: border-box;
		padding: var(--space-2);
		border: var(--card-border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		/* The browser's own monospace font for a textarea, like Inspect's mode file. */
		font-size: max(0.9rem, 16px); /* px-ok: iOS zooms into fields under 16px */
		line-height: 1.4;
		resize: vertical;
	}
	.issues {
		min-height: 4lh;
		max-height: 30vh;
		overflow-y: auto;
		color: var(--evil);
	}
	ul {
		margin: var(--space-2) 0 0;
		padding-inline-start: var(--space-4);
	}
</style>
