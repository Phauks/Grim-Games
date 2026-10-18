<script lang="ts" module>
	export interface ScriptFact {
		label: string;
		value: string;
		/** Opens the value on another site, e.g. the script's BotC Scripts page. */
		href?: string;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { GameData } from '#lib/core/data/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { BotcScriptsEntry } from './botcscripts-api.ts';
	import { botcCard } from './botcscripts-cards.ts';

	/**
	 * One script's details beside the list on the Scripts page (Trevor, 2026-10-16: script info
	 * on the right, no modal): the current script, or the row last tapped, with its characters
	 * by type. Nothing is saved until Save is tapped.
	 */
	interface Props {
		/** Shown above the name, e.g. "Current script". */
		heading: string;
		/** The script's own name; '' shows "None". */
		name: string;
		facts: readonly ScriptFact[];
		entries: readonly BotcScriptsEntry[];
		data: GameData | undefined;
		actions?: Snippet;
		/**
		 * The script as players see it (names and abilities), once it has loaded. Until then
		 * the characters are listed as badges by type.
		 */
		sheet?: Snippet;
		/** The Version field's value: a version picker, or "None" (always shown, no reflow). */
		version?: Snippet;
		/** More rows of the main info (`dt`/`dd`), e.g. the script's checks. */
		extra?: Snippet;
		/**
		 * Above the heading, e.g. a Back button. Given, the heading and name stay pinned to the
		 * top of the scrolling details (Trevor, 2026-10-17).
		 */
		lead?: Snippet;
		/**
		 * The actions sit in the pinned top with the name, a header for the Library's pane
		 * (Trevor, 2026-10-18: "controls ... should all be in the header").
		 */
		actionsInTop?: boolean;
	}

	let {
		heading,
		name,
		facts,
		entries,
		data,
		actions,
		sheet,
		version,
		extra,
		lead,
		actionsInTop = false
	}: Props = $props();

	const card = $derived(data ? botcCard(entries, data) : undefined);
</script>

<div class="details" data-testid="script-details">
	<div class="top" class:pinned={!!lead || actionsInTop} data-testid="script-details-top">
		{@render lead?.()}
		<h2>{heading}</h2>
		<p class="name" data-testid="script-details-name">{name || t('common.none')}</p>
		{#if actions && actionsInTop}
			<div class="actions">{@render actions()}</div>
		{/if}
	</div>
	<dl>
		{#each facts as fact (fact.label)}
			<dt>{fact.label}</dt>
			<dd>
				{#if fact.href}
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a href={fact.href} target="_blank" rel="noopener noreferrer">{fact.value}</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{:else}
					{fact.value}
				{/if}
			</dd>
		{/each}
		{#if version}
			<dt>{t('scripts.details.version')}</dt>
			<dd class="version">{@render version()}</dd>
		{/if}
		{@render extra?.()}
	</dl>
	{#if actions && !actionsInTop}
		<div class="actions">{@render actions()}</div>
	{/if}
	{#if sheet}
		<div class="sheet" data-testid="script-sheet">{@render sheet()}</div>
	{:else}
		<div class="groups" data-testid="script-characters">
			{#each card?.groups ?? [] as group (group.type ?? 'unknown')}
				<section>
					<h3>
						{group.type ? TYPE_PLURALS[group.type] : t('scripts.botc.unknownType')}
						<span class="count">{group.characters.length}</span>
					</h3>
					<p class="badges">
						{#each group.characters as c (c.id)}
							{#if c.official}
								<CharacterBadge characterId={c.official.id} inline />
							{:else}
								<span class="homebrew">{c.name}</span>
							{/if}
						{/each}
					</p>
				</section>
			{:else}
				<p class="muted">{t('common.none')}</p>
			{/each}
		</div>
	{/if}
</div>

<style>
	.details {
		display: grid;
		gap: var(--space-2);
		align-content: start;
		min-width: 0;
	}
	.top {
		display: grid;
		gap: var(--space-2);
	}
	/* Pinned over the scrolling details; it covers their top padding, so nothing shows above it. */
	.top.pinned {
		position: sticky;
		top: calc(-1 * var(--pinned-inset, 0));
		z-index: 1;
		margin-top: calc(-1 * var(--pinned-inset, 0));
		padding-top: var(--pinned-inset, 0);
		padding-bottom: var(--space-2);
		border-bottom: var(--card-border);
		background: var(--card-background);
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	.name {
		margin: 0;
		font-size: 1.3rem;
		color: var(--heading);
		overflow-wrap: anywhere;
	}
	dl {
		margin: 0;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--space-1) var(--space-3);
	}
	dt {
		color: var(--on-surface-muted);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	/* The picker on its own line and "Newer" under it, so neither squeezes the other. */
	.version {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		justify-items: start;
		gap: var(--space-1);
	}
	dd a {
		min-height: auto;
		color: inherit;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		align-items: center;
		gap: var(--space-2);
	}
	.sheet {
		margin-top: var(--space-2);
		min-width: 0;
	}
	.groups {
		display: grid;
		gap: var(--space-3);
		margin-top: var(--space-2);
	}
	h3 {
		margin: 0 0 var(--space-1);
		font-size: 1rem;
	}
	.count {
		color: var(--on-surface-muted);
		font-weight: 400;
	}
	.badges {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-2);
		align-items: center;
	}
	.homebrew {
		padding: 0 var(--space-1);
		border: var(--card-border);
		border-radius: var(--radius-sm);
	}
	.muted {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
