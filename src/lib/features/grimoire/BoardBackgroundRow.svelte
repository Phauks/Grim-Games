<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';
	import {
		clearBackground,
		readBackground,
		saveBackground,
		shrinkImage,
		PRESETS,
		type BackgroundChoice,
		type PresetId
	} from './backgrounds.ts';
	import type { BoardBackgroundContext } from './board-background.svelte.ts';
	// SPIKE (animated backgrounds, not for merge)
	import CssScene from './spike-scenes/CssScene.svelte';
	import { spike } from './spike-scenes/spike-state.svelte.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	const SCENES = [
		{ id: 'hellfire', label: 'Hellfire' },
		{ id: 'beach', label: 'Tropical beach' }
	] as const;

	/**
	 * The open board's background in Board and tokens (Trevor, 2026-10-16 and 2026-10-18): an
	 * image from this device, a built-in one, the script's own when it names one, or none, for
	 * this game or for every game. Everything the board's old Background dialog had.
	 */
	interface Props {
		board: BoardBackgroundContext;
	}

	let { board }: Props = $props();

	let scope = $state<'game' | 'default'>('game');
	let error = $state('');
	let input = $state<HTMLInputElement>();
	let ownChoice = $state(false);
	$effect(() => {
		const gameId = board.gameId;
		void readBackground({ gameId }).then((own) => (ownChoice = own !== undefined));
	});

	const current = $derived(board.current);
	const where = $derived(scope === 'game' ? { gameId: board.gameId } : ('default' as const));
	const nowText = $derived(
		current.kind === 'image'
			? 'Your image'
			: current.kind === 'preset'
				? PRESETS[current.id].label
				: current.kind === 'script'
					? "The script's background"
					: 'None (plain board)'
	);

	async function choose(choice: BackgroundChoice) {
		error = '';
		try {
			await saveBackground(where, choice);
			// A new default reaches this game only if it has no choice of its own.
			if (scope === 'default') await clearBackground({ gameId: board.gameId });
			ownChoice = scope === 'game';
			board.onChange();
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

	async function useDefault() {
		await clearBackground({ gameId: board.gameId });
		ownChoice = false;
		board.onChange();
	}
</script>

<SettingRow layout="stacked" label="Background">
	{#snippet control(labelId)}
		<dl class="change">
			<dt>Now</dt>
			<dd data-testid="background-now">{nowText}{ownChoice ? ', for this game' : ''}</dd>
		</dl>
		<Select
			label="Use for"
			value={scope}
			options={[
				{ value: 'game', label: 'This game' },
				{ value: 'default', label: 'All games' }
			]}
			onChange={(s) => (scope = s)}
		/>
		<div class="presets" role="group" aria-labelledby={labelId}>
			<!-- None first in the list, not a separate button (Trevor, 2026-10-18). -->
			<button
				type="button"
				class="preset"
				aria-pressed={current.kind === 'none'}
				onclick={() => choose({ kind: 'none' })}
			>
				<span class="swatch none"></span>
				<span>{t('settings.backgroundNone')}</span>
			</button>
			{#each Object.entries(PRESETS) as [id, preset] (id)}
				<button
					type="button"
					class="preset"
					aria-pressed={current.kind === 'preset' && current.id === id}
					onclick={() => choose({ kind: 'preset', id: id as PresetId })}
				>
					<span class="swatch" style:background={preset.css}></span>
					<span>{preset.label}</span>
				</button>
			{/each}
			{#each SCENES as scene (scene.id)}
				<button
					type="button"
					class="preset"
					aria-pressed={spike.scene === scene.id}
					onclick={() => (spike.scene = scene.id)}
				>
					<span class="swatch moving"
						><CssScene scene={scene.id} still={spike.still} contained /></span
					>
					<span>{scene.label}</span>
				</button>
			{/each}
		</div>
		<div class="choices">
			<Button icon="add" onclick={() => input?.click()}>{t('settings.backgroundImage')}</Button>
			<Button
				variant="quiet"
				disabled={!board.scriptImage}
				onclick={() => choose({ kind: 'script' })}
			>
				{board.scriptImage ? "The script's background" : 'No script background'}
			</Button>
			<Button variant="quiet" disabled={!ownChoice} onclick={useDefault}>
				Use the default for all games
			</Button>
		</div>
		<!-- One reserved line, so an error never moves the list. -->
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
<SettingToggle
	label="Moving backgrounds"
	checked={!spike.still}
	onChange={(on) => (spike.still = !on)}
/>

<style>
	.change {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
		margin: 0 0 var(--space-2);
	}
	.change dt {
		color: var(--on-surface-muted);
		font-size: 0.85rem;
	}
	.change dd {
		margin: 0;
	}
	.presets {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(calc(6 * var(--u)), 1fr));
		gap: var(--space-2);
		margin-top: var(--space-3);
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
	.swatch.moving {
		position: relative;
		overflow: hidden;
		isolation: isolate;
	}
	.swatch.none {
		background: var(--surface);
	}
	.choices {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
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
