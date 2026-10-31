<script lang="ts">
	import { STANDARD_INFO_TOKENS, type CharacterId } from '#lib/core/data/index.ts';
	import { scriptCharacterIds } from '#lib/core/model/index.ts';
	import type { NightStep } from '#lib/core/rules/index.ts';
	import { evilLearns, shownToSeats } from '#lib/core/rules/index.ts';
	import { charactersReallyInPlay } from '#lib/features/bluffs/bluffs.ts';
	import type { ShownInfoCard } from '#lib/features/show/shown.ts';
	import Select from '#lib/ui/primitives/Select.svelte';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { seatName } from './night-steps.ts';

	/**
	 * Who this step wakes to show its character's token (`shownTo` in its rules block): the
	 * player carrying the Widow's Know, or every Minion for the Damsel. Shown with one tap,
	 * as the step's other Valid Information is; "None" until anyone qualifies.
	 *
	 * Also what each evil player learns (`evilLearns`: the Storm Catcher's Stormcaught): "This
	 * player is" with the marked player's character, pointing at them; with no one marked,
	 * "These characters are not in play" with the good character the Storyteller named.
	 */
	interface Props {
		grimoire: Grimoire;
		step: NightStep;
		onShow: (characterId: CharacterId) => void;
		onShowCard: (card: ShownInfoCard) => void;
	}

	let { grimoire, step, onShow, onShowCard }: Props = $props();
	const headingId = $props.id();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const seats = $derived(
		step.character ? shownToSeats(game, step.character.id, characters) : undefined
	);
	const learns = $derived(
		step.character ? evilLearns(game, step.character.id, characters) : undefined
	);
	const text = (id: string) => STANDARD_INFO_TOKENS.find((token) => token.id === id)?.text ?? '';
	/** With no one marked: the good character named, from the script's not in play. */
	let named = $state<CharacterId>();
	const notInPlay = $derived.by(() => {
		const inPlay = charactersReallyInPlay(game, characters);
		return scriptCharacterIds(game.script).filter((id) => {
			const type = characters.get(id)?.type;
			return (type === 'townsfolk' || type === 'outsider') && !inPlay.has(id);
		});
	});
	const shownId = $derived(learns?.marked ? learns.marked.characterId : named);
	function showLearned() {
		const character = shownId ? characters.get(shownId) : undefined;
		onShowCard({
			title: text(learns?.marked ? 'this-player-is' : 'not-in-play'),
			characters: character ? [{ character }] : []
		});
	}
</script>

{#if step.character && seats}
	<section aria-labelledby={headingId} data-testid="night-shown-to">
		<h3 id={headingId}>{t('show.shownTo.heading')}</h3>
		<p class="row">
			{#each seats as seatId, n (seatId)}{n ? ', ' : ''}<PlayerBadge
					name={seatName(game, seatId)}
				/>{:else}{t('common.none')}{/each}
			<span class="see">{t('show.shownTo.sees')}</span>
			<CharacterBadge
				characterId={step.character.id}
				character={step.character}
				interactive={false}
			/>
		</p>
		<Button variant="quiet" icon="showToPlayer" onclick={() => onShow(step.character!.id)}
			>{t('show.toPlayer')}</Button
		>
	</section>
{/if}

{#if step.character && learns}
	<section aria-labelledby="{headingId}-evil" data-testid="night-evil-learns">
		<h3 id="{headingId}-evil">{t('show.shownTo.heading')}</h3>
		<p class="row">
			{#each learns.evil as seatId, n (seatId)}{n ? ', ' : ''}<PlayerBadge
					name={seatName(game, seatId)}
				/>{:else}{t('common.none')}{/each}
			<span class="see">{t('show.shownTo.sees')}</span>
			{#if learns.marked}
				{text('this-player-is')}
				{#if learns.marked.characterId}<CharacterBadge
						characterId={learns.marked.characterId}
						character={characters.get(learns.marked.characterId)}
						interactive={false}
					/>{/if}
				<PlayerBadge name={seatName(game, learns.marked.seatId)} />
			{:else}
				{text('not-in-play')}
				<Select
					label={t('show.evilLearns.named')}
					hideLabel
					placeholder={t('show.evilLearns.named')}
					attention={named === undefined}
					value={named}
					options={notInPlay.map((id) => ({
						value: id,
						// eslint-disable-next-line grim/names-as-badges -- the option's accessible name and typeahead text; it shows as the badge (the item snippet)
						label: characters.get(id)?.name ?? id
					}))}
					onChange={(id) => (named = id)}
					onClear={() => (named = undefined)}
				>
					{#snippet item(option)}<CharacterBadge
							characterId={option.value}
							character={characters.get(option.value)}
							interactive={false}
						/>{/snippet}
					{#snippet selected(option)}<CharacterBadge
							characterId={option.value}
							character={characters.get(option.value)}
							interactive={false}
						/>{/snippet}
				</Select>
			{/if}
		</p>
		<Button variant="quiet" icon="showToPlayer" disabled={!shownId} onclick={showLearned}
			>{t('show.toPlayer')}</Button
		>
	</section>
{/if}

<style>
	/* The same heading as the step's other Valid Information (NightSuggested). */
	h3 {
		margin: var(--space-2) 0 var(--space-1);
		font-size: 1rem;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		margin: 0 0 var(--space-1);
	}
	.see {
		color: var(--on-surface-muted);
	}
</style>
