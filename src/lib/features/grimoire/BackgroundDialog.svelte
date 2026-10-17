<script lang="ts">
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Segmented from '#lib/ui/primitives/Segmented.svelte';
	import { ASSIST_LABELS } from '#lib/ui/assistance.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { boardLooks, DEFAULT_BOARD_LOOKS, NAME_SIZE } from './board-looks.svelte.ts';
	import RulesAtSetting from './RulesAtSetting.svelte';
	import ReminderModeSetting from './ReminderModeSetting.svelte';
	import {
		clearBackground,
		readBackground,
		saveBackground,
		shrinkImage,
		PRESETS,
		type BackgroundChoice,
		type PresetId
	} from './backgrounds.ts';

	/**
	 * Board background (Trevor, 2026-10-16): an image from this device, the script's own
	 * background when it names one, or none. Applies to this game or to every game. It stays
	 * open after a choice, so several can be tried (Trevor, 2026-10-17), and holds the board's
	 * other looks too, the same values as in Settings.
	 */
	interface Props {
		open: boolean;
		gameId: string;
		/** The script's background link, if it has one. */
		scriptImage: string | undefined;
		/** What the board shows now. */
		current: BackgroundChoice;
		onChange: () => void;
	}

	let { open = $bindable(), gameId, scriptImage, current, onChange }: Props = $props();

	let scope = $state<'game' | 'default'>('game');
	let error = $state('');
	let input = $state<HTMLInputElement>();
	let ownChoice = $state(false);
	$effect(() => {
		if (!open) return;
		error = '';
		void readBackground({ gameId }).then((own) => (ownChoice = own !== undefined));
	});

	const where = $derived(scope === 'game' ? { gameId } : ('default' as const));
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
			if (scope === 'default') await clearBackground({ gameId });
			// The dialog stays open, so "Now" follows the choice.
			ownChoice = scope === 'game';
			onChange();
		} catch {
			error = 'The background could not be saved on this device.';
		}
	}

	async function picked(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		try {
			await choose({ kind: 'image', image: await shrinkImage(file) });
		} catch {
			error = 'That file could not be read as an image.';
		}
		if (input) input.value = '';
	}

	async function useDefault() {
		await clearBackground({ gameId });
		ownChoice = false;
		onChange();
	}
</script>

<Dialog bind:open title="Background">
	<dl class="change">
		<dt>Now</dt>
		<dd>{nowText}{ownChoice ? ', for this game' : ''}</dd>
	</dl>
	<Segmented
		label="Use for"
		value={scope}
		options={[
			{ value: 'game', label: 'This game' },
			{ value: 'default', label: 'All games' }
		]}
		onChange={(s) => (scope = s)}
	/>
	<div class="presets" role="group" aria-label="Built-in backgrounds">
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
	</div>
	<div class="choices">
		<Button icon="add" onclick={() => input?.click()}>Choose an image</Button>
		<Button variant="quiet" disabled={!scriptImage} onclick={() => choose({ kind: 'script' })}>
			{scriptImage ? "The script's background" : 'No script background'}
		</Button>
		<Button variant="quiet" onclick={() => choose({ kind: 'none' })}>None</Button>
		<Button variant="quiet" disabled={!ownChoice} onclick={useDefault}>
			Use the default for all games
		</Button>
	</div>
	<p class="error" role="status">{error}</p>
	<div class="looks" data-testid="board-looks">
		<SettingToggle
			label={ASSIST_LABELS.scriptTitle.label}
			description={ASSIST_LABELS.scriptTitle.description}
			checked={preferences.current.assistance.scriptTitle}
			onChange={(checked) =>
				preferences.update({
					assistance: { ...preferences.current.assistance, scriptTitle: checked }
				})}
		/>
		<SettingToggle
			label="Vignette"
			checked={boardLooks.current.vignette}
			onChange={(vignette) => boardLooks.update({ vignette })}
		/>
		<SettingSlider
			label="Vignette strength"
			value={boardLooks.current.vignetteStrength}
			min={0}
			max={1}
			step={0.05}
			defaultValue={DEFAULT_BOARD_LOOKS.vignetteStrength}
			onChange={(vignetteStrength) => boardLooks.update({ vignetteStrength })}
		/>
		<SettingSlider
			label="Player name size"
			value={boardLooks.current.nameSize}
			min={NAME_SIZE.min}
			max={NAME_SIZE.max}
			step={NAME_SIZE.step}
			defaultValue={DEFAULT_BOARD_LOOKS.nameSize}
			onChange={(nameSize) => boardLooks.update({ nameSize })}
		/>
		<RulesAtSetting />
		<ReminderModeSetting />
	</div>
	<input
		bind:this={input}
		class="file"
		type="file"
		accept="image/*"
		aria-label="Background image file"
		onchange={picked}
	/>
</Dialog>

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
	.choices {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-3);
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
	/* One reserved line, so an error never moves the dialog. */
	.error {
		min-height: 1.3em;
		margin: 0;
		color: var(--accent);
		font-size: 0.85rem;
	}
	.file {
		display: none;
	}
	.looks {
		display: grid;
		gap: var(--space-2);
	}
</style>
