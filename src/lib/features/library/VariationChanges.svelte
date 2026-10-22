<script lang="ts">
	import { loadScript, type Character, type GameData } from '#lib/core/data/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { scriptChanges } from './script-changes.ts';

	/**
	 * What a variation changed from the script it was made from (Trevor, 2026-10-17: "allow
	 * users to see what the variation is"). Both sides are stated; empty rows say None.
	 */
	interface Props {
		open?: boolean;
		/** The original's stored JSON, kept with the variation. */
		original: readonly unknown[];
		variation: readonly unknown[];
		data: GameData | undefined;
	}

	let { open = $bindable(false), original, variation, data }: Props = $props();

	const changes = $derived(scriptChanges(original, variation));
	const sameId = (id: string) => id.toLowerCase().replace(/[^a-z0-9]/g, '');
	function lookup(json: readonly unknown[]): Map<string, Character> {
		const characters = data ? (loadScript(json, data).script?.characters ?? []) : [];
		return new Map(characters.map((c) => [sameId(c.id), c]));
	}
	const before = $derived(lookup(original));
	const after = $derived(lookup(variation));
	const none = $derived(t('common.none'));
</script>

{#snippet badges(ids: readonly string[], from: Map<string, Character>)}
	{#each ids as id (id)}
		{@const character = from.get(sameId(id))}
		{#if character}
			<CharacterBadge characterId={character.id} {character} />
		{:else}
			<span>{id}</span>
		{/if}
	{:else}
		<span class="muted">{none}</span>
	{/each}
{/snippet}

<Dialog bind:open title={t('library.whatChanged')}>
	<dl data-testid="variation-changes">
		<dt>{t('library.change.originalName')}</dt>
		<dd>{changes.name ? changes.name.from || none : none}</dd>
		<dt>{t('library.change.name')}</dt>
		<dd>{changes.name ? changes.name.to || none : none}</dd>
		<dt>{t('library.change.originalAuthor')}</dt>
		<dd>{changes.author ? changes.author.from || none : none}</dd>
		<dt>{t('library.change.author')}</dt>
		<dd>{changes.author ? changes.author.to || none : none}</dd>
		<dt>{t('library.change.added')}</dt>
		<dd class="badges">{@render badges(changes.added, after)}</dd>
		<dt>{t('library.change.removed')}</dt>
		<dd class="badges">{@render badges(changes.removed, before)}</dd>
		<dt>{t('library.change.edited')}</dt>
		<dd class="badges">{@render badges(changes.edited, after)}</dd>
		<dt>{t('library.change.other')}</dt>
		<dd>{changes.otherDetails ? t('library.change.otherChanged') : none}</dd>
	</dl>
</Dialog>

<style>
	dl {
		margin: 0;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--space-2) var(--space-3);
		align-items: center;
	}
	dt {
		color: var(--on-surface-muted);
	}
	dd {
		margin: 0;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.muted {
		color: var(--on-surface-muted);
	}
</style>
