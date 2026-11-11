<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { MARKER_TEXT } from '#lib/core/rules/night/night-order.ts';
	import NightText from '#lib/features/reference/NightText.svelte';
	import StepPiece from '#lib/features/grimoire/StepPiece.svelte';
	import SectionStack from '#lib/ui/layout/SectionStack.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import type { PlayerNight } from './player-script.ts';

	interface Props {
		nights: readonly PlayerNight[];
		/** Plain headings, for print; on screen each night closes from its header. */
		flat?: boolean;
	}

	let { nights, flat = false }: Props = $props();
</script>

<!-- Who wakes, in order, with TPI's night text (Trevor, 2026-10-15). On screen the nights stack
     as the Script tab's sections do, one line between them (Trevor, 2026-10-27). -->
{#snippet nightList()}
	{#each nights as n (n.night)}
		{@const title = n.night === 'first' ? t('player.firstNight') : t('player.otherNights')}
		{#snippet list()}
			<ol>
				{#each n.entries as entry, i (i)}
					<!-- Each step as the character row, its night text where the ability goes, and
					     Dusk, Dawn and the info steps the same row with their picture; no numbers
					     (Trevor, 2026-11-05: "just don't include numbers"). -->
					<li data-step={entry.kind === 'marker' ? entry.id : entry.character.id}>
						{#if entry.kind === 'marker'}
							{@const said = MARKER_TEXT[entry.id][n.night]}
							<StepPiece
								step={{ id: entry.id, kind: 'marker' }}
								template={said ? 'row' : 'name'}
								info
							>
								{#snippet abilityText()}{said}{/snippet}
							</StepPiece>
						{:else}
							{@const c = entry.character}
							<StepPiece step={{ id: c.id, kind: 'character', character: c }} template="row" info>
								{#snippet abilityText()}{#if entry.text}<NightText
											text={entry.text}
											character={c}
											night={n.night}
										/>{:else}{t('common.none')}{/if}{/snippet}
							</StepPiece>
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
		padding-block: var(--space-2);
	}
	li + li {
		border-top: 1px solid var(--border);
	}
</style>
