<script lang="ts">
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Segmented from '#lib/ui/primitives/Segmented.svelte';
	import {
		clearBackground,
		readBackground,
		saveBackground,
		shrinkImage,
		type BackgroundChoice
	} from './backgrounds.ts';

	/**
	 * Board background (Trevor, 2026-10-16): an image from this device, the script's own
	 * background when it names one, or none. Applies to this game or to every game.
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
			onChange();
			open = false;
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
		onChange();
		open = false;
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
	<!-- Stays on this device: the image is kept in this browser only. -->
	<p class="note">Images stay on this device and are never uploaded.</p>
	<p class="error" role="status">{error}</p>
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
	.note {
		margin: var(--space-2) 0 0;
		color: var(--on-surface-muted);
		font-size: 0.85rem;
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
</style>
