<script lang="ts">
	import type { Alignment } from '#lib/core/data/index.ts';
	import {
		detectedEndReason,
		endCharacters,
		endReasonCharacter,
		type EndReason
	} from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * What End game saves (Trevor, 2026-10-18): the winner, and how they won, so History's
	 * alternate wins count what happened rather than only what the grimoire shows. Picking a
	 * winner preselects how the grimoire says they won (`detectedEndReason`); the Storyteller
	 * can change it. "How it ended" is always shown, disabled with no winner, so nothing moves.
	 */
	interface Props {
		grimoire: Grimoire;
		winner: Alignment | undefined;
		reason: EndReason | undefined;
		/** Today is over, for the rules checked at dusk; End game from the menu counts it over. */
		dayEnded?: boolean;
	}

	let { grimoire, winner = $bindable(), reason = $bindable(), dayEnded = true }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);

	// A new winner (picked here or preselected by the caller) preselects how they won.
	let reasonFor: Alignment | undefined;
	$effect.pre(() => {
		if (winner === reasonFor) return;
		reasonFor = winner;
		reason = winner ? detectedEndReason(game, characters, winner, { dayEnded }) : undefined;
	});

	const reasons = $derived<{ value: EndReason; label: string }[]>([
		{ value: 'demon-dead', label: 'Demon died' },
		{ value: 'two-alive', label: '2 alive' },
		...endCharacters(game, characters, reason).map((id) => ({
			value: `character:${id}` as EndReason,
			// eslint-disable-next-line grim/names-as-badges -- the option's accessible name; shown as a badge
			label: characters.get(id)?.name ?? id
		})),
		{ value: 'other', label: 'Other' }
	]);
</script>

{#snippet reasonLabel(option: { value: EndReason; label: string })}
	{@const id = endReasonCharacter(option.value)}
	{#if id}
		<CharacterBadge characterId={id} character={characters.get(id)} inline />
	{:else}
		{option.label}
	{/if}
{/snippet}

<div class="fields">
	<Select
		label="Winner"
		value={winner ?? 'none'}
		options={[
			{ value: 'good', label: 'Good' },
			{ value: 'evil', label: 'Evil' },
			{ value: 'none', label: 'Not recorded' }
		]}
		onChange={(team) => (winner = team === 'none' ? undefined : team)}
	/>
	<Select
		label="How it ended"
		value={reason}
		options={reasons}
		placeholder="None"
		disabled={winner === undefined}
		onChange={(next) => (reason = next)}
	>
		{#snippet item(option)}{@render reasonLabel(option)}{/snippet}
		{#snippet selected(option)}{@render reasonLabel(option)}{/snippet}
	</Select>
</div>

<style>
	.fields {
		display: grid;
		gap: var(--space-2);
	}
</style>
