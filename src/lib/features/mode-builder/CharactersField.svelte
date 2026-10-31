<script lang="ts">
	import { onMount } from 'svelte';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	/**
	 * A list of character ids in a mode file: the chosen characters as badges, and the shared
	 * character picker over every official character to change them.
	 */
	interface Props {
		label: string;
		ids: readonly CharacterId[];
		onChange: (ids: CharacterId[]) => void;
		disabled?: boolean;
	}

	let { label, ids, onChange, disabled = false }: Props = $props();

	let characters = $state.raw<readonly Character[]>([]);
	let choosing = $state(false);
	onMount(() => {
		loadOfficialData()
			.then((data) => (characters = data.characters))
			.catch((e) => reportError(e, { area: 'modes' }));
	});

	function toggle(id: CharacterId) {
		onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
	}
</script>

<div class="characters">
	<Button variant="field" icon="players" {disabled} onclick={() => (choosing = true)}>
		{t('modes.builder.chooseCharacters')}
		<CountBadge count={ids.length} />
	</Button>
	<p class="badges">
		{#each ids as id (id)}
			<CharacterBadge characterId={id} />
		{:else}
			<span class="muted">{t('common.none')}</span>
		{/each}
	</p>
</div>

<Dialog bind:open={choosing} title={label} size="full">
	<CharacterPicker {characters} mode="multi" selected={ids} onSelect={toggle} />
</Dialog>

<style>
	.characters {
		display: grid;
		gap: var(--space-1);
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin: 0;
	}
	.muted {
		color: var(--on-surface-muted);
	}
</style>
