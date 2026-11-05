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
		type BackgroundChoice
	} from './backgrounds.ts';
	import BackgroundTiles from './BackgroundTiles.svelte';
	import type { BoardBackgroundContext } from './board-background.svelte.ts';
	import MovingCustomise from './moving/MovingCustomise.svelte';
	import { MOVING_BACKGROUNDS } from '#lib/core/backgrounds/moving.ts';

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
				: current.kind === 'moving'
					? MOVING_BACKGROUNDS[current.id].label
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
		<div class="tiles">
			<BackgroundTiles {current} labelledBy={labelId} onChoose={choose} />
		</div>
		<div class="choices">
			<MovingCustomise {current} onSave={choose} />
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
	.tiles {
		margin-top: var(--space-3);
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
