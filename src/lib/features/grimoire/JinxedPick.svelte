<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import type { CharacterLookup, Game, SeatId } from '#lib/core/model/index.ts';
	import { jinxForbidsBecoming } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import JinxNote from '#lib/features/characters/JinxNote.svelte';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { jinxBetween } from '#lib/features/game/game-jinxes.ts';
	import SeatBadge from '#lib/features/grimoire/SeatBadge.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';

	/**
	 * A character a jinx says can't be in play with one already in play (the Pit-Hag cannot
	 * create a Heretic, https://wiki.bloodontheclocktower.com/Djinn; Trevor: "show it as
	 * impossible if they try to click it in the selector"). `note` fades it in a picker
	 * (CharacterPicker's `faded`); `pick` asks first, showing the jinx, and goes ahead on
	 * Confirm, as the Storyteller may still override. Used by every picker that changes a
	 * seat's character: the seat sheet's and a night step's.
	 */
	interface Props {
		game: Game;
		characters: CharacterLookup;
	}

	let { game, characters }: Props = $props();

	let open = $state(false);
	let asked = $state<{ seatId: SeatId; id: CharacterId; partner: CharacterId; go: () => void }>();
	const jinx = $derived(
		asked ? jinxBetween(game, officialData.current, asked.id, asked.partner) : undefined
	);

	/** The row's note in a picker for `seatId`, when a jinx forbids it there. */
	export function note(seatId: SeatId | undefined, character: Character): string | undefined {
		if (seatId === undefined) return undefined;
		return jinxForbidsBecoming(game, seatId, character.id, characters) ? 'Jinxed' : undefined;
	}

	/** Runs `go` now, or after Confirm when a jinx forbids `seatId` becoming `id`. */
	export function pick(seatId: SeatId, id: CharacterId, go: () => void) {
		const partner = jinxForbidsBecoming(game, seatId, id, characters);
		if (!partner) return go();
		asked = { seatId, id, partner, go };
		open = true;
	}
</script>

<ConfirmDialog
	bind:open
	title="Jinxed"
	onConfirm={() => asked?.go()}
	onCancel={() => (asked = undefined)}
>
	{#if asked}
		<p class="lead">
			<SeatBadge {game} {characters} seatId={asked.seatId} /> can't become
			<CharacterBadge characterId={asked.id} character={characters.get(asked.id)} /> while
			<CharacterBadge characterId={asked.partner} character={characters.get(asked.partner)} /> is in play.
		</p>
		{#if jinx}<div data-testid="jinxed-pick"><JinxNote {jinx} {characters} /></div>{/if}
	{/if}
</ConfirmDialog>

<style>
	.lead {
		margin: 0 0 var(--space-2);
	}
</style>
