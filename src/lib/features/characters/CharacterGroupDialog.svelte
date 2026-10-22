<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		CHARACTER_TYPES,
		GROUP_SOURCES,
		charactersOfGroup,
		type CharacterType,
		type GroupSource
	} from '#lib/core/data/index.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import { EDITION_LABELS, TYPE_LABELS, TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import CharacterEntry from './CharacterEntry.svelte';
	import { clearShownCharacter } from './character-context.ts';
	import { officialData } from './game-data.svelte.ts';

	/**
	 * Every character of one type from one source script or the Carousel, each with its
	 * ability (Trevor, 2026-10-20). Opened from a character's type and source at the top of its
	 * details, starting on that character's own group; both can be changed here.
	 */
	interface Props {
		open?: boolean;
		source: GroupSource;
		type: CharacterType;
	}

	let { open = $bindable(false), source: startSource, type: startType }: Props = $props();
	// The badges here open each character's own details, the one it was opened from included.
	clearShownCharacter();

	let source = $state<GroupSource>('all');
	let type = $state<CharacterType>('townsfolk');
	// Each time it opens, on the group it was opened for.
	$effect(() => {
		if (open) {
			source = startSource;
			type = startType;
		}
	});

	const sourceLabel = (value: GroupSource) =>
		value === 'all' ? t('characters.allSources') : (EDITION_LABELS[value] ?? value);
	const characters = $derived(
		officialData.current ? charactersOfGroup(officialData.current.characters, source, type) : []
	);
	const title = $derived(
		source === 'all' ? TYPE_PLURALS[type] : `${sourceLabel(source)} ${TYPE_PLURALS[type]}`
	);
</script>

<Dialog bind:open {title} size="full">
	<div class="choices">
		<Select
			label={t('characters.groupSource')}
			value={source}
			options={GROUP_SOURCES.map((value) => ({ value, label: sourceLabel(value) }))}
			onChange={(value) => (source = value)}
		/>
		<Select
			label={t('characters.groupType')}
			value={type}
			options={CHARACTER_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] }))}
			onChange={(value) => (type = value)}
		/>
	</div>
	<section aria-label={title} data-testid="character-group">
		{#each characters as character (character.id)}
			<CharacterEntry characterId={character.id}>
				<p class="ability"><GlossaryText text={character.ability} names={[character.name]} /></p>
			</CharacterEntry>
		{:else}
			<p class="none">{t('common.none')}</p>
		{/each}
	</section>
</Dialog>

<style>
	.choices {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
		gap: var(--space-2) var(--space-3);
		padding: var(--space-2) 0 var(--space-3);
		border-bottom: var(--card-border);
	}
	.ability {
		margin: 0;
		font-family: var(--font-ability);
		line-height: 1.5;
	}
	.none {
		color: var(--on-surface-muted);
	}
</style>
