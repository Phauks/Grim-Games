<script lang="ts">
	import { NIGHT_MARKERS, type NightMarker } from '#lib/core/data/index.ts';
	import type { NightStep } from '#lib/core/rules/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import MarkerToken from '#lib/ui/token/MarkerToken.svelte';
	import { MARKER_ICONS } from './night-steps.ts';

	/** A night step's picture: the character's token, a marker token, or an icon. */
	interface Props {
		step: NightStep;
		size: number;
	}

	let { step, size }: Props = $props();

	const isMarker = (id: string): id is NightMarker =>
		(NIGHT_MARKERS as readonly string[]).includes(id);
</script>

{#if step.character}
	<CharacterToken character={step.character} {size} />
{:else if isMarker(step.id)}
	<!-- The step's name is shown beside it. -->
	<MarkerToken marker={step.id} {size} label="" />
{:else}
	<Icon name={MARKER_ICONS[step.id] ?? 'night'} />
{/if}
