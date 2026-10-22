<script lang="ts">
	import {
		clearBackground,
		saveBackground,
		shrinkImage,
		PRESETS,
		type BackgroundChoice,
		type PresetId
	} from '#lib/features/grimoire/backgrounds.ts';
	import { defaultBackground } from '#lib/features/grimoire/default-background.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';

	/**
	 * The board background for every game (Trevor, 2026-10-17: background settings in Settings
	 * too). Same store as the board's Background dialog, where a single game can also have its
	 * own; a game's own choice still wins there.
	 */
	const current = $derived(defaultBackground.current);
	let error = $state('');
	let input = $state<HTMLInputElement>();

	$effect(() => void defaultBackground.load());

	async function choose(choice: BackgroundChoice | undefined) {
		error = '';
		try {
			if (choice) await saveBackground('default', choice);
			else await clearBackground('default');
			defaultBackground.set(choice);
		} catch {
			error = t('settings.backgroundSaveError');
		}
	}

	async function picked(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		try {
			await choose({ kind: 'image', image: await shrinkImage(file) });
		} catch {
			error = t('settings.backgroundImageError');
		}
		if (input) input.value = '';
	}
</script>

<SettingRow layout="stacked" label={t('settings.background')}>
	{#snippet control(labelId)}
		<div class="presets" role="group" aria-labelledby={labelId}>
			<!-- None first in the list, not a separate button (Trevor, 2026-10-18). -->
			<button
				type="button"
				class="preset"
				aria-pressed={!current || current.kind === 'none'}
				onclick={() => choose(undefined)}
			>
				<span class="swatch none"></span>
				<span>{t('settings.backgroundNone')}</span>
			</button>
			{#each Object.entries(PRESETS) as [id, preset] (id)}
				<button
					type="button"
					class="preset"
					aria-pressed={current?.kind === 'preset' && current.id === id}
					onclick={() => choose({ kind: 'preset', id: id as PresetId })}
				>
					<span class="swatch" style:background={preset.css}></span>
					<span>{preset.label}</span>
				</button>
			{/each}
		</div>
		<div class="choices">
			<Button icon="add" aria-pressed={current?.kind === 'image'} onclick={() => input?.click()}>
				{current?.kind === 'image'
					? t('settings.backgroundYourImage')
					: t('settings.backgroundImage')}
			</Button>
		</div>
		<p class="error" role="status">{error}</p>
		<input
			bind:this={input}
			class="file"
			type="file"
			accept="image/*"
			aria-label={t('settings.backgroundFile')}
			onchange={picked}
		/>
	{/snippet}
</SettingRow>

<style>
	.presets {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(calc(6 * var(--u)), 1fr));
		gap: var(--space-2);
	}
	.preset {
		display: grid;
		justify-items: center;
		gap: var(--space-1);
		min-height: var(--tap-target);
		padding: var(--space-1);
		border: 0.1rem solid transparent;
		border-radius: var(--radius-md);
		background: none;
		color: inherit;
		font: 600 0.8rem var(--font-control);
		cursor: pointer;
	}
	.preset[aria-pressed='true'] {
		border-color: var(--accent);
	}
	.swatch {
		width: 100%;
		aspect-ratio: 3 / 2;
		border-radius: var(--radius-md);
		box-shadow: inset 0 0 0 0.06rem var(--border);
	}
	.swatch.none {
		background: var(--surface);
	}
	.choices {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
	/* One reserved line, so an error never moves the list. */
	.error {
		min-height: 1.3em;
		margin: var(--space-1) 0 0;
		color: var(--accent);
		font-size: 0.85rem;
	}
	.file {
		display: none;
	}
</style>
