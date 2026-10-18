<script lang="ts">
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { fieldsFromEntry, previewCharacter } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { savedCharacters } from './stores.svelte.ts';

	/** The characters made on this device, for the Library; each opens in the Character builder. */
	const rows = $derived(
		savedCharacters.list.map((saved) => ({
			savedId: saved.savedId,
			character: previewCharacter(fieldsFromEntry(saved.entry))
		}))
	);
</script>

<ul class="characters" data-testid="library-characters">
	{#each rows as row (row.savedId)}
		<li>
			<a href="{resolve('/build-character')}#edit={encodeURIComponent(row.savedId)}"
				><CharacterBadge
					characterId={row.character.id}
					character={row.character}
					interactive={false}
				/></a
			>
		</li>
	{:else}
		<li class="none">{t('common.none')}</li>
	{/each}
</ul>

<style>
	.characters {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	a {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap-target);
		color: inherit;
		text-decoration: none;
	}
</style>
