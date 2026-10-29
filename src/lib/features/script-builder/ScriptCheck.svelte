<!--
	The script check beside the Script builder's list (ScriptBuilderPage): its jinxes, the
	setup changes its characters make, characters another needs that aren't on it yet, and
	the homebrew characters with their creators.
-->
<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import type { ScriptFacts } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { savedCharacters } from '#lib/features/character-builder/stores.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { scriptBuilderDraft as draft } from './draft.svelte.ts';
	import type { DraftCredit } from './draft.ts';

	interface Props {
		/** What the script check found; undefined until a character is chosen. */
		facts: ScriptFacts | undefined;
		/** The script's own characters, so homebrew ones show as badges too. */
		onScript: ReadonlyMap<CharacterId, Character>;
		/** The homebrew characters on the script. */
		homebrew: Character[];
		credits: Record<CharacterId, DraftCredit>;
		/** Opens a character made in the Character builder to edit, in place of `replaces`. */
		onEditCharacter: (savedId: string, replaces: CharacterId) => void;
	}

	let { facts, onScript, homebrew, credits, onEditCharacter }: Props = $props();

	const needs = $derived(facts?.requirements.filter((r) => !r.onScript) ?? []);
	/** The saved character a homebrew character on the script came from, if made here. */
	const savedFor = (id: CharacterId) => savedCharacters.list.find((c) => c.entry.id === id);
</script>

<section class="check" aria-label={t('script-builder.check')} data-testid="builder-check">
	<Collapsible
		title={t('script-builder.jinxes')}
		level={3}
		storageKey="script-builder:jinxes"
		empty={!facts?.jinxes.length}
	>
		{#snippet aside()}<CountBadge count={facts?.jinxes.length ?? 0} testid="jinx-count" />{/snippet}
		{#if facts?.jinxes.length}
			<ul>
				{#each facts.jinxes as jinx (jinx.characters.join('+'))}
					<li>
						<CharacterBadge
							characterId={jinx.characters[0]}
							character={onScript.get(jinx.characters[0])}
						/>
						{t('script-builder.and')}
						<CharacterBadge
							characterId={jinx.characters[1]}
							character={onScript.get(jinx.characters[1])}
						/>: {jinx.reason}
					</li>
				{/each}
			</ul>
		{:else}<p>{t('common.none')}</p>{/if}
	</Collapsible>
	<Collapsible
		title={t('script-builder.setupChanges')}
		level={3}
		storageKey="script-builder:setup"
		empty={!facts?.modifiers.length}
	>
		{#snippet aside()}<CountBadge count={facts?.modifiers.length ?? 0} />{/snippet}
		{#if facts?.modifiers.length}
			<ul>
				{#each facts.modifiers as modifier (modifier.id)}
					<li>
						<CharacterBadge characterId={modifier.id} character={onScript.get(modifier.id)} />
						{modifier.summary}
					</li>
				{/each}
			</ul>
		{:else}<p>{t('common.none')}</p>{/if}
	</Collapsible>
	<Collapsible
		title={t('script-builder.needs')}
		level={3}
		storageKey="script-builder:needs"
		empty={!needs.length}
	>
		{#snippet aside()}<CountBadge count={needs.length} warn={needs.length > 0} />{/snippet}
		{#if needs.length}
			<ul>
				{#each needs as need (need.id)}
					<li>
						<CharacterBadge characterId={need.id} character={onScript.get(need.id)} />
						{t('script-builder.needsChar')}
						<CharacterBadge characterId={need.requires} />
						<Button variant="quiet" onclick={() => draft.toggle(need.requires)}
							>{t('script-builder.add')}</Button
						>
					</li>
				{/each}
			</ul>
		{:else}<p>{t('common.none')}</p>{/if}
	</Collapsible>
	<Collapsible
		title={t('script-builder.homebrew')}
		level={3}
		storageKey="script-builder:homebrew"
		empty={!homebrew.length}
	>
		{#snippet aside()}<CountBadge count={homebrew.length} testid="homebrew-count" />{/snippet}
		{#if homebrew.length}
			<ul class="credits">
				{#each homebrew as character (character.id)}
					{@const credit = credits[character.id]}
					{@const saved = savedFor(character.id)}
					<li>
						<CharacterBadge characterId={character.id} {character} />
						<span class="creator">{credit?.creator || t('common.none')}</span>
						{#if saved}
							<IconButton
								icon="edit"
								label={t('character-builder.editCharacter', { name: character.name })}
								onclick={() => onEditCharacter(saved.savedId, character.id)}
							/>
						{/if}
						{#if credit?.url}
							<!-- eslint-disable svelte/no-navigation-without-resolve -->
							<a
								class="wiki"
								href={credit.url}
								target="_blank"
								rel="noopener noreferrer"
								aria-label={t('script-builder.wikiPage', { name: character.name })}
								title={t('script-builder.wikiPage', { name: character.name })}
								><Icon name="wiki" /></a
							>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{/if}
					</li>
				{/each}
			</ul>
		{:else}<p>{t('common.none')}</p>{/if}
	</Collapsible>
</section>

<style>
	.credits {
		padding: 0;
		list-style: none;
	}
	.credits li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
	}
	.creator {
		color: var(--on-surface-muted);
		overflow-wrap: anywhere;
	}
	.wiki {
		display: grid;
		place-items: center;
		width: var(--tap-target);
		height: var(--tap-target);
		color: inherit;
	}
	.check {
		display: grid;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-3) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		font-size: 0.9rem;
	}
	.check p,
	.check ul {
		margin: 0;
	}
	.check ul {
		display: grid;
		gap: var(--space-2);
		padding-inline-start: 1.2em;
	}
</style>
