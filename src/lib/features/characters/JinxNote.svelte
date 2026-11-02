<script lang="ts">
	import type { Character, CharacterId, Jinx } from '#lib/core/data/index.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import CharacterBadge from './CharacterBadge.svelte';
	import { officialData } from './game-data.svelte.ts';

	/**
	 * One jinx as every screen shows it: both characters as one split badge (Trevor, 2026-11-02), then the jinx's own text,
	 * word for word (TPI's, or the script's homebrew wording; official game text is never
	 * edited). The script sheet's Jinxes, a jinx mark's dialog (JinxMark) and a night step
	 * all draw it (L107).
	 */
	interface Props {
		jinx: Jinx;
		/** The script's characters, for homebrew names and icons; else the badges look them up. */
		characters?: ReadonlyMap<CharacterId, Character>;
	}

	let { jinx, characters }: Props = $props();
	const a = $derived(jinx.characters[0]);
	const b = $derived(jinx.characters[1]);
	const nameOf = (id: CharacterId) =>
		characters?.get(id)?.name ?? officialData.current?.byId.get(id)?.name ?? id;
</script>

<div class="jinx-note" data-testid="jinx-note" data-pair={`${a}+${b}`}>
	<span class="pair">
		<span class="joined">
			<CharacterBadge characterId={a} character={characters?.get(a)} joined="start" />
			<CharacterBadge characterId={b} character={characters?.get(b)} joined="end" />
		</span>
	</span>
	<p class="jinx-text">
		<GlossaryText text={jinx.reason} names={[nameOf(a), nameOf(b)]} />
	</p>
</div>

<style>
	.jinx-note {
		display: grid;
		justify-items: start;
		gap: calc(0.125 * var(--u));
		align-content: start;
	}
	/*
	 * A badge above its text keeps the row it had as a tall pill: its 44px tap area then
	 * stays clear of the rules terms' tap areas on the line below, and nothing moves.
	 */
	.pair {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--tap-target);
	}
	/* The split badge's outer edge, in the heading colour so the pair reads as a jinx. */
	.joined {
		display: inline-flex;
		max-width: calc(100% - 0.24em);
		/* Room for the edge, which a scrolling parent would otherwise clip. */
		margin-inline: 0.12em;
		border-radius: var(--radius-full);
		box-shadow: 0 0 0 0.12em var(--heading);
	}
	.jinx-text {
		margin: 0;
		padding-left: var(--space-1);
		font-family: var(--font-ability);
		line-height: 1.35;
	}
</style>
