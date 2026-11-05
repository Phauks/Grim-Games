<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { NIGHT_MARKERS, type NightMarker, type PlayerName } from '#lib/core/data/index.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import type { RowMarker } from '#lib/features/characters/character-templates.ts';
	import { glossaryDialog } from '#lib/features/glossary/glossary-dialog.svelte.ts';
	import { glossaryKey } from '#lib/features/glossary/wiki-glossary.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import MarkerToken from '#lib/ui/token/MarkerToken.svelte';
	import { MARKER_ICONS, stepName, type NamedStep } from './night-steps.ts';

	/**
	 * A night step as the character piece draws it, wherever a step heads (the strip under the
	 * board, the opened step): a character's step is that character; Dusk, Dawn, Minion info,
	 * Demon info and the other steps are the same piece with their picture in the ring (Trevor,
	 * 2026-11-03: "a varient of the character info"; 2026-11-05: nowhere the old way).
	 */
	type Props = Omit<
		ComponentProps<typeof CharacterPiece>,
		'character' | 'marker' | 'playerName'
	> & {
		/** A board's night step, or a step of a player's night order. */
		step: NamedStep;
		/** The seat's player, the second half of the step's band. */
		playerName?: PlayerName;
	};

	let { step, ...piece }: Props = $props();

	const isMarker = (id: string): id is NightMarker =>
		(NIGHT_MARKERS as readonly string[]).includes(id);
	/** The steps the Glossary has an entry for, by the step's own name (Trevor, 2026-10-18). */
	const GLOSSARY_STEPS = new Set(['dusk', 'dawn', 'minioninfo', 'demoninfo']);
	const marker = $derived.by((): RowMarker | undefined => {
		if (step.character) return undefined;
		const name = stepName(step);
		return {
			name,
			team: step.id === 'minioninfo' || step.id === 'demoninfo' ? 'evil' : 'neutral',
			picture,
			info: GLOSSARY_STEPS.has(step.id) ? () => glossaryDialog.show(glossaryKey(name)) : undefined,
			infoLabel: `About ${name}`
		};
	});
</script>

{#snippet picture()}
	{#if isMarker(step.id)}<MarkerToken marker={step.id} size={40} label="" />{:else}<span
			class="marker-icon"><Icon name={MARKER_ICONS[step.id] ?? 'night'} /></span
		>{/if}
{/snippet}

<CharacterPiece {...piece} character={step.character} {marker} />

<style>
	/* A step's icon in the ring, as a character's icon fills it. */
	.marker-icon {
		display: grid;
		place-items: center;
		--icon-size: 70%;
		color: var(--heading);
	}
</style>
