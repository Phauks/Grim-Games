<script lang="ts">
	import {
		BOARD_SOUNDS,
		MIX_NAME_MAX,
		boardSound,
		padId,
		padName,
		type SoundPad
	} from '#lib/core/sound/soundboard.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';

	/**
	 * Which sounds and mixes the soundboard shows (Trevor 2026-10-27: "perhaps a storyteller
	 * only wants access to some. We could have some hot spots where storytellers could place
	 * sounds and mixes"): the pads placed, in order, then the library's other sounds to add,
	 * then a new mix of several sounds that play together. Opened from the soundboard's
	 * "+ New" pad and Edit, and from Settings > Sound.
	 */
	let { open = $bindable(false) }: { open?: boolean } = $props();

	const pads = $derived(preferences.current.soundPads);
	const placed = $derived(new Set(pads.map(padId)));
	const unplaced = $derived(BOARD_SOUNDS.filter((sound) => !placed.has(sound.id)));

	let mixName = $state('');
	let mixSounds = $state<string[]>([]);

	function save(soundPads: SoundPad[]) {
		preferences.update({ soundPads });
	}

	function move(index: number, by: -1 | 1) {
		const next = [...pads];
		const [pad] = next.splice(index, 1);
		next.splice(index + by, 0, pad);
		save(next);
	}

	function toggleMixSound(id: string) {
		mixSounds = mixSounds.includes(id)
			? mixSounds.filter((sound) => sound !== id)
			: [...mixSounds, id];
	}

	function addMix() {
		const name = mixName.trim();
		if (!name || !mixSounds.length) return;
		save([...pads, { mix: `mix-${Date.now().toString(36)}`, name, sounds: mixSounds }]);
		mixName = '';
		mixSounds = [];
	}

	function mixLine(pad: SoundPad): string | undefined {
		if ('sound' in pad) return undefined;
		return pad.sounds.map((id) => boardSound(id)?.name ?? id).join(', ');
	}
</script>

<Dialog bind:open title={t('settings.soundPads')}>
	<h3>{t('settings.soundPadsPlaced')}</h3>
	<ul class="rows" aria-label={t('settings.soundPadsPlaced')}>
		{#each pads as pad, index (padId(pad))}
			{@const name = padName(pad)}
			<li>
				<span class="name">
					{name}
					{#if mixLine(pad)}<span class="sounds">{mixLine(pad)}</span>{/if}
				</span>
				<IconButton
					icon="moveUp"
					label={t('settings.soundPadUp', { name })}
					disabled={index === 0}
					onclick={() => move(index, -1)}
				/>
				<IconButton
					icon="moveDown"
					label={t('settings.soundPadDown', { name })}
					disabled={index === pads.length - 1}
					onclick={() => move(index, 1)}
				/>
				<DeleteButton
					label={t('settings.soundPadRemove', { name })}
					onclick={() => save(pads.filter((other) => padId(other) !== padId(pad)))}
				/>
			</li>
		{:else}
			<li class="none">{t('common.none')}</li>
		{/each}
	</ul>

	<h3>{t('settings.soundPadsAdd')}</h3>
	<ul class="rows" aria-label={t('settings.soundPadsAdd')}>
		{#each unplaced as sound (sound.id)}
			<li>
				<span class="name">{sound.name}</span>
				<IconButton
					icon="add"
					label={t('settings.soundPadAdd', { name: sound.name })}
					onclick={() => save([...pads, { sound: sound.id }])}
				/>
			</li>
		{:else}
			<li class="none">{t('common.none')}</li>
		{/each}
	</ul>

	<h3>{t('settings.soundMixNew')}</h3>
	<TextField
		label={t('settings.soundMixName')}
		bind:value={mixName}
		maxlength={MIX_NAME_MAX}
		enterkeyhint="done"
	/>
	<div class="chips" role="group" aria-label={t('settings.soundMixSounds')}>
		{#each BOARD_SOUNDS as sound (sound.id)}
			<Chip pressed={mixSounds.includes(sound.id)} onclick={() => toggleMixSound(sound.id)}>
				{sound.name}
			</Chip>
		{/each}
	</div>
	<div class="end">
		<Button
			variant="accent"
			icon="add"
			disabled={!mixName.trim() || !mixSounds.length}
			onclick={addMix}>{t('settings.soundMixAdd')}</Button
		>
	</div>
</Dialog>

<style>
	h3 {
		margin: var(--space-3) 0 var(--space-1);
		font-size: 1rem;
		color: var(--heading);
	}
	.rows {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.rows li {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--tap-target);
		border-bottom: 1px solid var(--border);
	}
	.name {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	.sounds {
		font-size: 0.85em;
		color: var(--on-surface-muted);
	}
	.none {
		color: var(--on-surface-muted);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		padding-block: var(--space-2);
	}
	.end {
		display: flex;
		justify-content: flex-end;
	}
</style>
