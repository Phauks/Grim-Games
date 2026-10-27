<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { MARKER_TEXT } from '#lib/core/rules/night-order.ts';
	import type { Character } from '#lib/core/data/index.ts';
	import CharacterDialog from '#lib/features/characters/CharacterDialog.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import { iconUrl } from '#lib/features/characters/icon-url.ts';
	import NightText from '#lib/features/reference/NightText.svelte';
	import MarkerToken from '#lib/ui/token/MarkerToken.svelte';
	import SectionStack from '#lib/ui/layout/SectionStack.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import type { PlayerNight } from './player-script.ts';

	interface Props {
		nights: readonly PlayerNight[];
		/** Plain headings, for print; on screen each night closes from its header. */
		flat?: boolean;
	}

	let { nights, flat = false }: Props = $props();

	// Tapping a character's icon or name shows its ability and wiki link, like a badge.
	let shown = $state<Character>();
	let dialogOpen = $state(false);
	function show(c: Character) {
		shown = c;
		dialogOpen = true;
	}
</script>

<!-- Who wakes, in order, with TPI's night text (Trevor, 2026-10-15). On screen the nights stack
     as the Script tab's sections do, one line between them (Trevor, 2026-10-27). -->
{#snippet nightList()}
	{#each nights as n (n.night)}
		{@const title = n.night === 'first' ? t('player.firstNight') : t('player.otherNights')}
		{#snippet list()}
			<ol>
				{#each n.entries as entry, i (i)}
					<!-- Icon two lines tall; name on the first line, TPI's text beneath (Trevor). -->
					<li data-step={entry.kind === 'marker' ? entry.id : entry.character.id}>
						<span class="num">{i + 1}</span>
						{#if entry.kind === 'marker'}
							<span class="icon"><MarkerToken marker={entry.id} size={48} label="" /></span>
							<span class="name marker" data-marker={entry.id}>{MARKER_TEXT[entry.id].name}</span>
						{:else}
							{@const c = entry.character}
							<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
							<span class="icon" onclick={() => show(c)}
								><CharacterToken character={c} size={48} /></span
							>
							<button
								type="button"
								class="name character"
								aria-haspopup="dialog"
								onclick={() => show(c)}
								><!-- eslint-disable-next-line grim/names-as-badges -- caption beside its own token; a badge would repeat the icon -->
								{c.name}</button
							>
							<p class="text">
								{#if entry.text}<NightText
										text={entry.text}
										character={c}
										night={n.night}
									/>{:else}{t('common.none')}{/if}
							</p>
						{/if}
					</li>
				{/each}
			</ol>
		{/snippet}
		<!-- Each night closes from its header on screen, remembered here (Trevor, 2026-10-19). -->
		<section data-night={n.night}>
			{#if flat}
				<h2>{title}</h2>
				{@render list()}
			{:else}
				<Collapsible
					{title}
					storageKey="play:night-{n.night}"
					count={n.entries.filter((e) => e.kind === 'character').length}
					>{@render list()}</Collapsible
				>
			{/if}
		</section>
	{/each}
{/snippet}
{#if flat}<div class="nights">{@render nightList()}</div>{:else}<SectionStack
		>{@render nightList()}</SectionStack
	>{/if}

{#if shown}
	<CharacterDialog bind:open={dialogOpen} character={shown} icon={iconUrl(shown)} />
{/if}

<style>
	.nights {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, calc(16 * var(--u))), 1fr));
		gap: var(--space-4);
		align-items: start;
	}
	h2 {
		margin: 0 0 var(--space-2);
		font-size: 1.1rem;
		color: var(--heading);
		border-bottom: 1px solid var(--border);
		padding-bottom: var(--space-1);
	}
	ol {
		display: grid;
		gap: calc(0.125 * var(--u));
		margin: 0;
		padding: 0;
		list-style: none;
	}
	ol {
		gap: 0;
	}
	/* A clear line between steps (Trevor, 2026-10-19), with room above and below it. */
	li {
		display: grid;
		grid-template-columns: 2ch calc(3 * var(--u)) minmax(0, 1fr);
		column-gap: var(--space-2);
		align-items: start;
		padding-block: var(--space-2);
	}
	li + li {
		border-top: 1px solid var(--border);
	}
	/* Level with the middle of its icon on every step, however long the text (Trevor). */
	.num {
		grid-row: span 2;
		align-self: start;
		display: grid;
		align-items: center;
		justify-items: end;
		height: calc(3 * var(--u));
		color: var(--on-surface-muted);
		font-variant-numeric: tabular-nums;
	}
	/* The icon is as tall as the name line and the first line of text together. */
	.icon {
		grid-row: span 2;
		display: grid;
		align-self: start;
		width: calc(3 * var(--u));
		height: calc(3 * var(--u));
	}
	.icon:has(:global(.token)) {
		cursor: pointer;
	}
	.name {
		grid-column: 3;
		justify-self: start;
		/* Above any badge's tap area in the text below; the 48px icon opens it too. */
		position: relative;
		z-index: 1;
		min-height: calc(2 * var(--u));
		padding: 0;
		border: 0;
		background: none;
		color: var(--heading);
		font: 600 1rem / 1.5 var(--font-character);
		text-align: start;
	}
	button.name {
		cursor: pointer;
		touch-action: manipulation;
	}
	button.name:hover {
		text-decoration: underline;
	}
	.marker {
		display: flex;
		align-items: center;
		min-height: calc(3 * var(--u));
		grid-row: 1 / span 2;
		font-family: var(--font-control);
		color: var(--on-surface-muted);
	}
	.text {
		grid-column: 3;
		margin: 0;
		font-family: var(--font-ability);
		font-size: 0.95rem;
		line-height: 1.35;
	}
</style>
