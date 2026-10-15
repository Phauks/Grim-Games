<script lang="ts">
	import { wikiUrl, type Character } from '#lib/core/data/index.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	interface Props {
		open?: boolean;
		character: Character;
		icon?: string;
	}

	let { open = $bindable(false), character, icon }: Props = $props();
	const wiki = $derived(wikiUrl(character));
	const typeLabel = $derived(character.type[0].toUpperCase() + character.type.slice(1));
</script>

<Dialog bind:open title={character.name}>
	<div class="summary">
		<span class="icon"
			>{#if icon}<img src={icon} alt="" width="64" height="64" />{/if}</span
		>
		<p class="type">{typeLabel}</p>
	</div>
	<p class="ability">{character.ability}</p>
	{#snippet actions()}
		{#if wiki}
			<!-- External wiki page (the rules authority), not an app route. -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a class="wiki" href={wiki} target="_blank" rel="noopener">
				<Icon name="wiki" /><span>Open wiki entry</span>
			</a>
		{:else}
			<!-- Homebrew: no wiki page. Shown disabled so the layout is the same for every character. -->
			<span class="wiki" aria-disabled="true"><Icon name="wiki" /><span>No wiki entry</span></span>
		{/if}
	{/snippet}
</Dialog>

<style>
	.summary {
		display: flex;
		align-items: center;
		gap: var(--space-3, calc(0.75 * var(--u)));
	}
	.icon {
		display: inline-grid;
		place-items: center;
		width: calc(4.5 * var(--u));
		height: calc(4.5 * var(--u));
		border-radius: 50%;
		background: var(--token-face, var(--on-surface));
	}
	.type {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.ability {
		font-family: var(--font-ability);
		font-size: 1.05rem;
		line-height: 1.5;
	}
	.wiki {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2, calc(0.5 * var(--u)));
		min-height: var(--tap-target);
		padding: 0 var(--space-4, calc(1 * var(--u)));
		border-radius: var(--radius-md, calc(0.5 * var(--u)));
		background: var(--accent);
		color: var(--on-accent, var(--on-surface));
		text-decoration: none;
		font-weight: 600;
	}
	.wiki[aria-disabled='true'] {
		opacity: 0.5;
	}
</style>
