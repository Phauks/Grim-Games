<script lang="ts">
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { STANDARD_INFO_TOKENS, type CharacterId } from '#lib/core/data/index.ts';
	import {
		trueCharacter,
		type CharacterLookup,
		type Game,
		type SeatId
	} from '#lib/core/model/index.ts';
	import {
		charactersReallyInPlay,
		DEMON_SET,
		showableBluffSets
	} from '#lib/features/bluffs/bluffs.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { seatName } from '#lib/features/grimoire/night-steps.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import type { ShownInfoCard } from './shown.ts';

	/**
	 * The cards for Minion info and Demon info (Trevor, 2026-10-18): every card the step can
	 * show, each with who it points at, never one pick made for the Storyteller. Each card is
	 * shown on its own; nothing is shown until the Storyteller taps.
	 */
	interface Props {
		game: Game;
		characters: CharacterLookup;
		step: 'minioninfo' | 'demoninfo';
		onShow: (card: ShownInfoCard) => void;
		/** No bluffs yet: open the Demon bluffs sheet. */
		onChooseBluffs: () => void;
	}

	let { game, characters, step, onShow, onChooseBluffs }: Props = $props();

	const text = (id: string) => STANDARD_INFO_TOKENS.find((t) => t.id === id)?.text ?? '';
	const seatsOf = (type: 'minion' | 'demon') =>
		game.seating.filter((s) => {
			const id = trueCharacter(game, s, characters);
			return id !== undefined && characters.get(id)?.type === type;
		});
	const demons = $derived(seatsOf('demon'));
	const minions = $derived(seatsOf('minion'));
	const inPlay = $derived(charactersReallyInPlay(game, characters));
	const bluffSets = $derived(showableBluffSets(game, characters));

	interface Row {
		key: string;
		title: string;
		/** The players the Storyteller points at. */
		seats?: readonly SeatId[];
		set?: string;
		characterIds?: readonly CharacterId[];
		/** The Demon's own bluffs must not be in play. */
		blocked?: boolean;
	}

	const rows = $derived.by<Row[]>(() => {
		const out: Row[] = [];
		if (step === 'minioninfo') {
			out.push({ key: 'demon', title: text('this-is-the-demon'), seats: demons });
			// Other Minions only when there is more than one.
			if (minions.length > 1)
				out.push({ key: 'minions', title: text('these-are-your-minions'), seats: minions });
		} else {
			out.push({ key: 'minions', title: text('these-are-your-minions'), seats: minions });
			for (const set of bluffSets)
				out.push({
					key: `bluffs-${set.set}`,
					title: text('not-in-play'),
					set: set.label,
					characterIds: set.characterIds,
					blocked: set.set === DEMON_SET && set.characterIds.some((id) => inPlay.has(id))
				});
		}
		return out;
	});

	function card(row: Row): ShownInfoCard {
		return {
			title: row.title,
			characters: (row.characterIds ?? []).flatMap((id) => {
				const character = characters.get(id);
				return character ? [{ character, alignment: 'good' as const }] : [];
			})
		};
	}
</script>

<!-- A player as their name pill and their character's badge, as in the night suggestions. -->
{#snippet player(seatId: SeatId)}{@const id = trueCharacter(game, seatId, characters)}<span
		class="player"
		><PlayerBadge name={seatName(game, seatId)} />{#if id}<CharacterBadge
				characterId={id}
				character={characters.get(id)}
			/>{/if}</span
	>{/snippet}

<section class="cards" aria-label={t('show.evil.title')}>
	<h3>{t('show.evil.title')}</h3>
	<ul>
		{#each rows as row (row.key)}
			<li data-testid="evil-info-card">
				<div class="what">
					<span class="title"
						>{row.title}{#if row.set}<span class="set">&nbsp;· {row.set}</span>{/if}</span
					>
					{#if row.seats}
						<span class="who"
							>{#each row.seats as seatId, n (seatId)}{n ? ', ' : ''}{@render player(
									seatId
								)}{:else}{t('common.none')}{/each}</span
						>
					{/if}
					{#if row.characterIds}
						<span class="badges">
							{#each row.characterIds as id (id)}
								<CharacterBadge
									characterId={id}
									character={characters.get(id)}
									interactive={false}
								/>
							{/each}
						</span>
					{/if}
					{#if row.blocked}
						<span class="flag"><Icon name="warning" /> {t('show.evil.inPlay')}</span>
					{/if}
				</div>
				<Button
					variant="quiet"
					icon="forward"
					aria-label={t('show.evil.showNamed', {
						card: row.set ? `${row.title} · ${row.set}` : row.title
					})}
					onclick={() => onShow(card(row))}>{t('show.evil.show')}</Button
				>
			</li>
		{/each}
		{#if step === 'demoninfo' && bluffSets.length === 0}
			<li data-testid="evil-info-card">
				<div class="what">
					<span class="title">{text('not-in-play')}</span>
					<span class="who">{t('common.none')}</span>
				</div>
				<Button variant="quiet" icon="demon" onclick={onChooseBluffs}
					>{t('show.evil.chooseBluffs')}</Button
				>
			</li>
		{/if}
	</ul>
</section>

<style>
	.cards {
		display: grid;
		gap: var(--space-2);
	}
	h3 {
		margin: 0;
	}
	ul {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
	}
	.what {
		display: grid;
		flex: 1;
		min-width: 0;
		gap: var(--space-1);
	}
	.title {
		font-family: var(--font-heading);
	}
	.set {
		color: var(--on-surface-muted);
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.badges > :global(*) {
		max-width: 100%;
	}
	.flag {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--accent);
		font-size: 0.85rem;
	}
	.player {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}
</style>
