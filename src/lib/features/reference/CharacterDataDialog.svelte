<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import {
		characterData,
		characterDataFile,
		type CharacterDataPart
	} from '#lib/core/rules/character-data.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import { cardsOfCharacter } from '#lib/features/info-tokens/character-cards.ts';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import FileView from '#lib/ui/primitives/FileView.svelte';
	import DataTree from './DataTree.svelte';

	/**
	 * All data (Trevor, 2026-10-28: "a button to show all information our app would use to use
	 * the character"): each piece the app reads about one character, under the file it comes
	 * from, then all of it as one JSON file to copy or download.
	 */
	interface Props {
		open: boolean;
		character: Character;
	}

	let { open = $bindable(), character }: Props = $props();

	type Part = CharacterDataPart | 'cards';
	const found = $derived(
		officialData.current ? characterData(officialData.current, character.id) : undefined
	);
	// The character's own info cards are a feature list, not core data, so they join here.
	const cards = $derived({
		file: 'src/lib/features/info-tokens/character-cards.ts',
		data: cardsOfCharacter(character)
	});
	const sources = $derived<{ part: Part; file: string; data: unknown }[]>([
		...(found?.sources ?? []),
		{ part: 'cards', ...cards }
	]);
	const text = $derived(
		JSON.stringify(
			{
				...(found ? characterDataFile(found) : { id: character.id }),
				cards
			},
			null,
			'\t'
		)
	);
	const fileName = $derived(`${character.id}-data.json`);
	// The name is a slot, shown as the character's badge.
	const title = $derived(t('reference.data.title', { character: slot('character') }));
</script>

<Dialog bind:open {title} size="full">
	{#snippet heading()}
		<Sentence text={title}
			>{#snippet fill()}<CharacterBadge
					characterId={character.id}
					{character}
				/>{/snippet}</Sentence
		>
	{/snippet}
	<div class="data" data-testid="character-data">
		{#each sources as source (source.part)}
			<section class="group" data-part={source.part}>
				<h3>{t(`reference.data.part.${source.part}`)}</h3>
				<code class="file">{source.file}</code>
				<div class="value"><DataTree value={source.data} /></div>
			</section>
		{/each}
		<!-- The raw JSON starts closed, as the game modes' Inspect file does (Trevor, 2026-10-18). -->
		<Collapsible title={t('reference.data.file')} level={3} startClosed>
			<FileView
				title={fileName}
				{text}
				{fileName}
				copyLabel={t('reference.data.copy')}
				downloadLabel={t('reference.data.download')}
				testid="character-data-file"
			/>
		</Collapsible>
	</div>
</Dialog>

<style>
	/* A full dialog doesn't scroll itself: its content does (as the game modes' Inspect). */
	.data {
		display: grid;
		flex: 1;
		min-height: 0;
		align-content: start;
		gap: var(--space-4);
		overflow-y: auto;
		container: data-view / inline-size;
	}
	.group {
		display: grid;
		gap: var(--space-1);
	}
	h3 {
		margin: 0;
		padding-bottom: var(--space-1);
		border-bottom: 2px solid var(--border);
		font-size: 1.05rem;
	}
	.file {
		color: var(--on-surface-muted);
		font-size: 0.8rem;
		overflow-wrap: anywhere;
	}
	.value {
		font-size: 0.9rem;
	}
</style>
