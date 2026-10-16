<script lang="ts">
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { historyItems, type HistoryItem, type HistoryPart } from './history.ts';

	interface Props {
		open: boolean;
		grimoire: Grimoire;
	}

	let { open = $bindable(), grimoire }: Props = $props();

	const characters = $derived(grimoire.open.characters);
	const cursor = $derived(grimoire.open.session.log.cursor);
	// Only built while open: it replays the whole log.
	const items = $derived(
		open ? historyItems(grimoire.open.session.log.entries, cursor, characters) : []
	);
	const time = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

	/** The entry the Storyteller tapped, and where the game would go. */
	let chosen = $state<{ item: HistoryItem; to: number } | undefined>();
	let confirmOpen = $state(false);
	const changes = $derived(chosen ? Math.abs(cursor - chosen.to) : 0);

	function choose(item: HistoryItem) {
		// An applied entry rolls back to just before it; an undone one restores up to it.
		chosen = { item, to: item.undone ? item.cursor : item.cursor - 1 };
		confirmOpen = true;
	}

	function confirm() {
		confirmOpen = false;
		if (chosen) grimoire.open.goTo(chosen.to);
		chosen = undefined;
	}
</script>

{#snippet line(parts: HistoryPart[])}
	{#each parts as part, i (i)}{#if part.kind === 'text'}{part.text}{:else if part.kind === 'seat'}{#if part.characterId}<CharacterBadge
					characterId={part.characterId}
					character={characters.get(part.characterId)}
					alignment={part.alignment}
					playerName={part.name}
					inline
				/>{:else}<strong>{part.name}</strong
				>{/if}{:else if part.kind === 'character'}<CharacterBadge
				characterId={part.characterId}
				character={characters.get(part.characterId)}
				inline
			/>{:else}<span class="chip"
				><ReminderToken label={part.label} type={characters.get(part.characterId)?.type} /></span
			>{/if}{/each}
{/snippet}

<Dialog
	bind:open
	title="History"
	description="Newest first. Tap a change to go back to just before it."
	size="full"
>
	<ol class="history">
		{#each items as item (item.cursor)}
			<li class:undone={item.undone} class:now={item.cursor === cursor}>
				<span class="text">{@render line(item.parts)}</span>
				<span class="when">
					{item.cursor === cursor ? 'Now · ' : item.undone ? 'Undone · ' : ''}{time.format(item.at)}
				</span>
				{#if item.cursor > 1}
					<Button variant="quiet" onclick={() => choose(item)}>
						{item.undone ? 'Restore' : 'Go back'}
					</Button>
				{/if}
			</li>
		{/each}
	</ol>
</Dialog>

<Dialog
	bind:open={confirmOpen}
	title={chosen?.item.undone ? 'Restore changes?' : 'Go back?'}
	role="alertdialog"
>
	{#if chosen}
		<p>
			{chosen.item.undone ? 'Restores' : 'Undoes'}
			{changes}
			{changes === 1 ? 'change' : 'changes'}, up to {chosen.item.undone
				? 'and including'
				: 'just before'}:
		</p>
		<p class="target">{@render line(chosen.item.parts)}</p>
		<p class="note">
			{chosen.item.undone
				? 'Restored changes are applied again.'
				: 'Undone changes stay in History, greyed out, until you make a new change.'}
		</p>
	{/if}
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (confirmOpen = false)}>Cancel</Button>
		<Button variant="accent" icon="history" onclick={confirm}>
			{chosen?.item.undone ? 'Restore' : 'Go back'}
		</Button>
	{/snippet}
</Dialog>

<style>
	.history {
		flex: 1;
		min-height: 0;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		list-style: none;
	}
	li {
		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-areas: 'text action' 'when action';
		align-items: center;
		column-gap: var(--space-2);
		padding: var(--space-1) 0;
		border-bottom: 1px solid var(--border);
	}
	.text {
		grid-area: text;
		line-height: 1.9;
	}
	.when {
		grid-area: when;
		font-size: 0.8rem;
		color: var(--on-surface-muted);
	}
	li :global(button) {
		grid-area: action;
	}
	li.now .when {
		color: var(--accent);
	}
	li.undone .text {
		opacity: 0.5;
		text-decoration: line-through;
	}
	.chip {
		display: inline-block;
		vertical-align: middle;
	}
	p {
		margin: 0 0 var(--space-2);
	}
	.target {
		line-height: 1.9;
	}
	.note {
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
</style>
