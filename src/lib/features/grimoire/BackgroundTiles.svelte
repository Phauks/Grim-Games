<script lang="ts">
	import {
		MOVING_BACKGROUNDS,
		MOVING_IDS,
		movingDefaults,
		type MovingId
	} from '#lib/core/backgrounds/moving.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import fire from '#lib/assets/backgrounds/thumb-fire.jpg';
	import rain from '#lib/assets/backgrounds/thumb-rain.jpg';
	import stars from '#lib/assets/backgrounds/thumb-stars.jpg';
	import vortex from '#lib/assets/backgrounds/thumb-vortex.jpg';
	import yinyang from '#lib/assets/backgrounds/thumb-yinyang.jpg';
	import { PRESETS, type BackgroundChoice, type PresetId } from './backgrounds.ts';

	/**
	 * The background tiles, in the open board's Background row and the default's in Settings:
	 * None first (Trevor, 2026-10-18), the built-in still ones, then the moving ones (M43).
	 * A moving tile keeps its own settings when it is already the one chosen.
	 */
	interface Props {
		/** The choice in use; undefined reads as None. */
		current: BackgroundChoice | undefined;
		labelledBy: string;
		onChoose: (choice: BackgroundChoice) => void;
	}
	let { current, labelledBy, onChoose }: Props = $props();

	/** Still pictures of each moving background at its first preset, drawn by its own scene. */
	const THUMBS: Record<MovingId, string> = { vortex, fire, rain, stars, yinyang };

	function chooseMoving(id: MovingId) {
		if (current?.kind === 'moving' && current.id === id) return;
		onChoose({ kind: 'moving', id, params: movingDefaults(id) });
	}
</script>

<div class="presets" role="group" aria-labelledby={labelledBy}>
	<button
		type="button"
		class="preset"
		aria-pressed={!current || current.kind === 'none'}
		onclick={() => onChoose({ kind: 'none' })}
	>
		<span class="swatch none"></span>
		<span>{t('settings.backgroundNone')}</span>
	</button>
	{#each Object.entries(PRESETS) as [id, preset] (id)}
		<button
			type="button"
			class="preset"
			aria-pressed={current?.kind === 'preset' && current.id === id}
			onclick={() => onChoose({ kind: 'preset', id: id as PresetId })}
		>
			<span class="swatch" style:background={preset.css}></span>
			<span>{preset.label}</span>
		</button>
	{/each}
	{#each MOVING_IDS as id (id)}
		<button
			type="button"
			class="preset"
			data-moving={id}
			aria-pressed={current?.kind === 'moving' && current.id === id}
			onclick={() => chooseMoving(id)}
		>
			<img class="swatch" src={THUMBS[id]} alt="" />
			<span>{MOVING_BACKGROUNDS[id].label}</span>
		</button>
	{/each}
</div>

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
		display: block;
		width: 100%;
		aspect-ratio: 3 / 2;
		object-fit: cover;
		border-radius: var(--radius-md);
		box-shadow: inset 0 0 0 0.06rem var(--border);
	}
	.swatch.none {
		background: var(--surface);
	}
</style>
