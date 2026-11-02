<script lang="ts">
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { trueCharacter, type SeatId } from '#lib/core/model/index.ts';
	import {
		falseInfoSource,
		type AnswerOption,
		type LearnedRole,
		type Reliability
	} from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { seatName } from './night-steps.ts';

	/**
	 * Why a valid row is valid when not simply true: who would have to register otherwise,
	 * the waking player's ability not working, the Vortox, or a marked choice that isn't
	 * valid. Nothing for a true row. Shared by the night step's Valid Information lists.
	 */
	interface Props {
		grimoire: Grimoire;
		reason: LearnedRole['reason'] | AnswerOption['reason'];
		/** For `registers`: the players who would register as something else. */
		registered?: readonly SeatId[];
		/**
		 * The waking player's reliability, when known: names the character behind false info
		 * (the Duchess's False Info) and any that only may make it false (the Fibbin).
		 */
		source?: Pick<Reliability, 'unreliable' | 'mayBeFalse' | 'falseBy'>;
	}

	let { grimoire, reason, registered = [], source }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	/** The character that makes the information false (the Vortox, the Duchess). */
	const falseBy = $derived(source?.falseBy ?? falseInfoSource(game, characters)?.characterId);
	/** A character that may make it false, when nothing else makes it unreliable (the Fibbin). */
	const mayBy = $derived(source && !source.unreliable ? source.mayBeFalse : undefined);
</script>

{#if reason === 'registers'}<span class="tag"
		>Registers{#if registered.length > 0}:
			{#each registered as seatId, n (seatId)}{n ? ', ' : ''}{@const id = trueCharacter(
					game,
					seatId,
					characters
				)}<span class="player"
					><PlayerBadge name={seatName(game, seatId)} />{#if id}<CharacterBadge
							characterId={id}
							character={characters.get(id)}
						/>{/if}</span
				>{/each}{/if}</span
	>{:else if reason === 'unreliable' && mayBy}<span class="tag warn"
		><CharacterBadge characterId={mayBy} character={characters.get(mayBy)} />Might be false</span
	>{:else if reason === 'unreliable'}<span class="tag warn"
		><Icon name="warning" />Not reliable</span
	>{:else if reason === 'vortox'}<span class="tag warn"
		>{#if falseBy}<CharacterBadge
				characterId={falseBy}
				character={characters.get(falseBy)}
			/>{/if}</span
	>{:else if reason === 'invalid'}<span class="tag warn"><Icon name="warning" />Not valid</span
	>{/if}

<style>
	.tag {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
		font-size: 0.85rem;
		color: var(--on-surface-muted);
		--icon-size: 1em;
	}
	.tag.warn {
		color: var(--evil-text);
	}
	.player {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
	}
</style>
