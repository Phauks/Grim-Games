<script lang="ts">
	import {
		clearBackground,
		saveBackground,
		shrinkImage,
		type BackgroundChoice
	} from '#lib/features/grimoire/backgrounds.ts';
	import BackgroundTiles from '#lib/features/grimoire/BackgroundTiles.svelte';
	import BackgroundCustomise from '#lib/features/grimoire/BackgroundCustomise.svelte';
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
		<BackgroundTiles
			{current}
			labelledBy={labelId}
			onChoose={(choice) => choose(choice.kind === 'none' ? undefined : choice)}
		/>
		<div class="choices">
			<BackgroundCustomise {current} onSave={choose} />
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
