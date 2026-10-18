<script lang="ts">
	import { NIGHT_MARKERS, type NightMarker } from '#lib/core/data/index.ts';
	import type { NightStep } from '#lib/core/rules/index.ts';
	import CharacterDialog from '#lib/features/characters/CharacterDialog.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import { glossaryDialog } from '#lib/features/glossary/glossary-dialog.svelte.ts';
	import { glossaryKey } from '#lib/features/glossary/wiki-glossary.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import MarkerToken from '#lib/ui/token/MarkerToken.svelte';
	import { MARKER_ICONS, stepName } from './night-steps.ts';

	/**
	 * A night step's picture: the character's token, a marker token, or an icon. With
	 * `details`, tapping it opens the character's details, or the Glossary at Dusk, Dawn,
	 * Minion Info and Demon Info (Trevor, 2026-10-18), like tapping a character badge.
	 */
	interface Props {
		step: NightStep;
		size: number;
		details?: boolean;
	}

	let { step, size, details = false }: Props = $props();

	const isMarker = (id: string): id is NightMarker =>
		(NIGHT_MARKERS as readonly string[]).includes(id);
	/** The markers the Glossary has an entry for, by the step's own name. */
	const GLOSSARY_MARKERS = new Set(['dusk', 'dawn', 'minioninfo', 'demoninfo']);
	const tappable = $derived(details && (!!step.character || GLOSSARY_MARKERS.has(step.id)));

	let open = $state(false);
	// The dialog is only created on first tap, as with a character badge.
	let used = $state(false);
	function show() {
		if (step.character) {
			used = true;
			open = true;
		} else glossaryDialog.show(glossaryKey(stepName(step)));
	}
</script>

{#snippet picture()}
	{#if step.character}
		<CharacterToken character={step.character} {size} />
	{:else if isMarker(step.id)}
		<!-- The step's name is shown beside it. -->
		<MarkerToken marker={step.id} {size} label="" />
	{:else}
		<Icon name={MARKER_ICONS[step.id] ?? 'night'} />
	{/if}
{/snippet}

{#if tappable}
	<button
		type="button"
		class="details"
		aria-haspopup="dialog"
		aria-label={`About ${stepName(step)}`}
		data-testid="step-icon"
		onclick={show}>{@render picture()}</button
	>
	{#if used && step.character}<CharacterDialog bind:open character={step.character} />{/if}
{:else}
	{@render picture()}
{/if}

<style>
	.details {
		display: grid;
		place-items: center;
		min-width: var(--tap-target);
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		cursor: pointer;
	}
</style>
