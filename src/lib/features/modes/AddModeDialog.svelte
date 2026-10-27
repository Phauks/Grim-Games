<script lang="ts">
	import type { GameMode, SpecialRule } from '#lib/core/modes/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import ModeFormatGuide from './ModeFormatGuide.svelte';
	import { customModes } from './custom-modes.svelte.ts';
	import { customRules } from './custom-rules.svelte.ts';

	/**
	 * Adds a mode file someone wrote, pasted or uploaded. Every problem is listed with its
	 * path (parseGameMode), so a file can be fixed in one go. Copy a built-in mode's file from
	 * Inspect to start from it. A file with "kind": "special-rule" is a special rule, filed with
	 * the rules (Trevor, 2026-10-18: custom game modes and custom rules both).
	 */
	interface Props {
		open?: boolean;
		onadded: (mode: GameMode) => void;
		onaddedrule?: (rule: SpecialRule) => void;
	}

	let { open = $bindable(false), onadded, onaddedrule }: Props = $props();

	let text = $state('');
	let issues = $state<string[]>([]);
	let fileInput = $state<HTMLInputElement>();
	let guide = $state(false);

	$effect(() => {
		if (!open) {
			text = '';
			issues = [];
		}
	});

	async function save() {
		const data = await loadOfficialData();
		const known = new Set(data.characters.map((c) => c.id));
		let value: unknown;
		try {
			value = JSON.parse(text);
		} catch {
			value = undefined;
		}
		if (
			typeof value === 'object' &&
			value !== null &&
			'kind' in value &&
			value.kind === 'special-rule'
		) {
			const result = customRules.add(value, known);
			if (!result.ok) {
				issues = result.issues;
				return;
			}
			open = false;
			onaddedrule?.(result.rule);
			return;
		}
		const result = customModes.add(text, known);
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
	{#snippet headActions()}
		<!-- Upload beside the guide in the header, so Cancel and Confirm share one row below
			(Trevor, 2026-10-18: the three buttons took too much room). -->
		<IconButton
			icon="uploadFile"
			label={t('modes.add.upload')}
			onclick={() => fileInput?.click()}
		/>
		<IconButton icon="about" label={t('modes.guide.open')} onclick={() => (guide = true)} />
	{/snippet}
	<TextField
		label={t('modes.add.label')}
		bind:value={text}
		multiline
		rows={10}
		spellcheck={false}
		autocomplete="off"
		testid="mode-file"
		oninput={() => (issues = [])}
	/>
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
		/>
	{/snippet}
</Dialog>

<ModeFormatGuide bind:open={guide} />

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
	.issues {
		min-height: 4lh;
		max-height: 30vh;
		overflow-y: auto;
		color: var(--evil-text);
	}
	ul {
		margin: var(--space-2) 0 0;
		padding-inline-start: var(--space-4);
	}
</style>
