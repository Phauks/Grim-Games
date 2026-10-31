<script lang="ts">
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { STANDARD_INFO_TOKENS, type CharacterId } from '#lib/core/data/index.ts';
	import {
		trueCharacter,
		type CharacterLookup,
		type FakeEvilInfo,
		type Game,
		type SeatId
	} from '#lib/core/model/index.ts';
	import {
		believedDemon,
		chosenLikeDemon,
		demonInfo,
		fakeEvilInfoOf,
		shownAtMinionInfo,
		type Night
	} from '#lib/core/rules/index.ts';
	import {
		bluffSetLabel,
		charactersReallyInPlay,
		DEMON_SET,
		LUNATIC_SET,
		showableBluffSets
	} from '#lib/features/bluffs/bluffs.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { seatName } from '#lib/features/grimoire/night-steps.ts';
	import SeatChooser from '#lib/features/grimoire/SeatChooser.svelte';
	import NightText from '#lib/features/reference/NightText.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import type { ShownInfoCard } from './shown.ts';

	/**
	 * The cards for Minion info and Demon info (Trevor, 2026-10-18): every card the step can
	 * show, each with who it points at, never one pick made for the Storyteller. Each card is
	 * shown on its own; nothing is shown until the Storyteller taps.
	 *
	 * With `believer`, the same cards for a player who believes they are the Demon (the
	 * Lunatic, Trevor 2026-10-29): fake Minions, their bluffs and a decoy Lunatic on the first
	 * night; later, the Demon they believe they are, whom they chose for the real Demon, and the
	 * decoy's picks (https://wiki.bloodontheclocktower.com/Lunatic).
	 */
	interface Props {
		game: Game;
		characters: CharacterLookup;
		step: 'minioninfo' | 'demoninfo' | 'believer';
		/** The player who believes they are the Demon, for `step: "believer"`. */
		believer?: SeatId;
		night?: Night;
		onShow: (card: ShownInfoCard) => void;
		/** No bluffs yet, or the believer's to edit: open the Demon bluffs sheet. */
		onChooseBluffs: () => void;
		/** The believer's fake world changed. */
		onFakeChange?: (info: FakeEvilInfo) => void;
	}

	let {
		game,
		characters,
		step,
		believer,
		night = 'first',
		onShow,
		onChooseBluffs,
		onFakeChange
	}: Props = $props();

	const text = (id: string) => STANDARD_INFO_TOKENS.find((t) => t.id === id)?.text ?? '';
	const seatsOf = (type: 'minion' | 'demon') =>
		game.seating.filter((s) => {
			const id = trueCharacter(game, s, characters);
			return id !== undefined && characters.get(id)?.type === type;
		});
	const union = (a: readonly SeatId[], b: readonly SeatId[]) => [...new Set([...a, ...b])];
	const info = $derived(demonInfo(game, characters));
	const demons = $derived(union(seatsOf('demon'), info.shownAsDemon));
	const minions = $derived(union(seatsOf('minion'), info.shownAsMinions));
	const inPlay = $derived(charactersReallyInPlay(game, characters));
	const bluffSets = $derived(showableBluffSets(game, characters));
	/** The character keeping the Demon and Minions from learning each other (the Poppy Grower). */
	const hiddenFlag = $derived(info.hiddenBy);

	// The believer's fake world.
	const believerId = $derived(believer ? trueCharacter(game, believer, characters) : undefined);
	const fake = $derived(believer ? fakeEvilInfoOf(game, believer) : { minions: [] });
	const believed = $derived.by(() => {
		const id = believer ? believedDemon(game, believer, characters) : undefined;
		return id ? characters.get(id) : undefined;
	});
	const believedText = $derived(night === 'other' ? believed?.otherNightReminder : undefined);
	const change = (patch: Partial<FakeEvilInfo>) => onFakeChange?.({ ...fake, ...patch });

	interface Row {
		key: string;
		title: string;
		/** The players the Storyteller points at. */
		seats?: readonly SeatId[];
		/** Whom they chose, pointed at after them. */
		chose?: readonly SeatId[];
		set?: string;
		characterIds?: readonly CharacterId[];
		/** The Demon's own bluffs must not be in play. */
		blocked?: boolean;
		/** A character in play that keeps this from being learnt. */
		flag?: CharacterId;
		/** Players to add with one tap (the Magician as a fake Minion). */
		adds?: readonly SeatId[];
		/** Choose or Edit what the row shows. */
		edit?: { label: string; action: () => void };
		/** Shows only its characters: the bluffs, or "This player is" with the Lunatic's token. */
		showCharacters?: readonly CharacterId[];
	}

	const believerRows = $derived.by<Row[]>(() => {
		if (!believer || !believerId) return [];
		const lunatic = [believerId];
		if (night === 'other') {
			const out: Row[] = [
				{
					key: 'demon-wake',
					title: text('this-player-is'),
					seats: [believer],
					chose: chosenLikeDemon(game, believer, characters),
					characterIds: lunatic,
					showCharacters: lunatic
				}
			];
			if (fake.decoy)
				out.push({
					key: 'decoy',
					title: text('this-player-is'),
					seats: [fake.decoy],
					chose: fake.decoyChose ?? [],
					characterIds: lunatic,
					showCharacters: lunatic,
					edit: { label: t('show.evil.choose'), action: () => pick('decoyChose') }
				});
			return out;
		}
		const bluffs = game.bluffs[LUNATIC_SET] ?? [];
		return [
			{
				key: 'minions',
				title: text('these-are-your-minions'),
				seats: fake.minions,
				flag: hiddenFlag,
				adds: info.shownAsMinions.filter((s) => s !== believer && !fake.minions.includes(s)),
				edit: { label: t('show.evil.choose'), action: () => pick('minions') }
			},
			{
				key: 'bluffs',
				title: text('not-in-play'),
				set: bluffSetLabel(LUNATIC_SET, true, game.bluffNames?.[LUNATIC_SET]),
				characterIds: bluffs,
				showCharacters: bluffs,
				edit: { label: t('show.evil.edit'), action: onChooseBluffs }
			},
			{
				key: 'decoy',
				title: text('this-player-is'),
				seats: fake.decoy ? [fake.decoy] : [],
				characterIds: lunatic,
				showCharacters: lunatic,
				edit: { label: t('show.evil.choose'), action: () => pick('decoy') }
			}
		];
	});

	const rows = $derived.by<Row[]>(() => {
		if (step === 'believer') return believerRows;
		const out: Row[] = [];
		if (step === 'minioninfo') {
			out.push({ key: 'demon', title: text('this-is-the-demon'), seats: demons, flag: hiddenFlag });
			// Other Minions only when there is more than one.
			if (minions.length > 1)
				out.push({ key: 'minions', title: text('these-are-your-minions'), seats: minions });
			// A token every Minion is shown, with no words (the Damsel: "All Minions know a Damsel
			// is in play", https://wiki.bloodontheclocktower.com/Damsel).
			for (const id of shownAtMinionInfo(game, characters))
				out.push({ key: `shown-${id}`, title: '', characterIds: [id], showCharacters: [id] });
		} else {
			out.push({
				key: 'minions',
				title: text('these-are-your-minions'),
				seats: minions,
				flag: hiddenFlag
			});
			for (const set of bluffSets)
				out.push({
					key: `bluffs-${set.set}`,
					title: text('not-in-play'),
					set: set.label,
					characterIds: set.characterIds,
					showCharacters: set.characterIds,
					blocked: set.set === DEMON_SET && set.characterIds.some((id) => inPlay.has(id))
				});
		}
		return out;
	});

	/** The card's accessible name: its words, or the tokens of a card with none (the Damsel). */
	function cardName(row: Row): string {
		if (!row.title)
			return (row.characterIds ?? []).map((id) => characters.get(id)?.name ?? id).join(', ');
		return row.set ? `${row.title} · ${row.set}` : row.title;
	}
	function card(row: Row): ShownInfoCard {
		return {
			...(row.title ? { title: row.title } : {}),
			characters: (row.showCharacters ?? []).flatMap((id) => {
				const character = characters.get(id);
				return character ? [{ character, alignment: 'good' as const }] : [];
			})
		};
	}
	// The Lunatic's token is shown as it is, not as a good character.
	function shown(row: Row): ShownInfoCard {
		const out = card(row);
		if (step !== 'believer' || row.key === 'bluffs') return out;
		return {
			...out,
			characters: out.characters?.map(({ character }) => ({ character }))
		};
	}

	// Choosing players for the believer's rows: Minions and the decoy's picks are several, each
	// tap adds or takes one off; the decoy is one.
	let picking = $state<'minions' | 'decoy' | 'decoyChose' | undefined>();
	let chooserOpen = $state(false);
	function pick(kind: 'minions' | 'decoy' | 'decoyChose') {
		picking = kind;
		chooserOpen = true;
	}
	const picked = $derived(
		picking === 'minions'
			? fake.minions
			: picking === 'decoyChose'
				? (fake.decoyChose ?? [])
				: fake.decoy
					? [fake.decoy]
					: []
	);
	const toggle = (list: readonly SeatId[], seatId: SeatId) =>
		list.includes(seatId) ? list.filter((s) => s !== seatId) : [...list, seatId];
	function chosen(seatId: SeatId) {
		if (picking === 'minions') change({ minions: toggle(fake.minions, seatId) });
		else if (picking === 'decoyChose')
			change({ decoyChose: toggle(fake.decoyChose ?? [], seatId) });
		else {
			chooserOpen = false;
			change({ decoy: seatId, decoyChose: [] });
		}
	}
	const chooserTitle = $derived(
		picking === 'minions'
			? text('these-are-your-minions')
			: picking === 'decoyChose'
				? t('show.evil.decoyChose')
				: text('this-player-is')
	);
</script>

<!-- A player as their name pill and their character's badge, as in the night suggestions. -->
{#snippet player(seatId: SeatId)}{@const id = trueCharacter(game, seatId, characters)}<span
		class="player"
		><PlayerBadge name={seatName(game, seatId)} />{#if id}<CharacterBadge
				characterId={id}
				character={characters.get(id)}
			/>{/if}</span
	>{/snippet}

<section
	class="cards"
	aria-label={step === 'believer' ? t('show.evil.believerTitle') : t('show.evil.title')}
>
	{#if step === 'believer' && believedText && believed}
		<h3 class="as">
			{t('show.evil.as')}
			<CharacterBadge characterId={believed.id} character={believed} interactive={false} />
		</h3>
		<p class="text" data-testid="believed-demon-text">
			<NightText text={believedText} character={believed} night="other" />
		</p>
	{/if}
	<h3>{step === 'believer' ? t('show.evil.believerTitle') : t('show.evil.title')}</h3>
	<ul>
		{#each rows as row (row.key)}
			{@const empty =
				row.showCharacters?.length === 0 || (step === 'believer' && row.seats?.length === 0)}
			<li data-testid="evil-info-card" data-row={row.key}>
				<div class="what">
					<span class="title"
						>{row.title}{#if row.set}<span class="set">&nbsp;· {row.set}</span>{/if}</span
					>
					{#if row.seats}
						<span class="who"
							>{#each row.seats as seatId, n (seatId)}{n ? ', ' : ''}{@render player(
									seatId
								)}{:else}{t('common.none')}{/each}{#if row.chose}<span class="chose"
									>{t('show.evil.chose')}</span
								>{#each row.chose as seatId, n (seatId)}{n ? ', ' : ''}<PlayerBadge
										name={seatName(game, seatId)}
									/>{:else}{t('common.none')}{/each}{/if}</span
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
							{:else}{t('common.none')}{/each}
						</span>
					{/if}
					{#if row.adds?.length}
						<span class="badges">
							{#each row.adds as seatId (seatId)}
								<Button
									variant="quiet"
									icon="add"
									aria-label={t('show.evil.add', { name: seatName(game, seatId) })}
									onclick={() => change({ minions: [...fake.minions, seatId] })}
									><PlayerBadge name={seatName(game, seatId)} /></Button
								>
							{/each}
						</span>
					{/if}
					{#if row.blocked}
						<span class="flag"><Icon name="warning" /> {t('show.evil.inPlay')}</span>
					{/if}
					{#if row.flag}
						<span class="flag"
							><Icon name="warning" /><CharacterBadge
								characterId={row.flag}
								character={characters.get(row.flag)}
								interactive={false}
							/>{t('show.evil.hidden')}</span
						>
					{/if}
				</div>
				{#if row.edit}
					<Button variant="quiet" icon="edit" onclick={row.edit.action}>{row.edit.label}</Button>
				{/if}
				<Button
					variant="quiet"
					icon="forward"
					disabled={empty}
					aria-label={t('show.evil.showNamed', { card: cardName(row) })}
					onclick={() => onShow(shown(row))}>{t('show.evil.show')}</Button
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

{#if step === 'believer'}
	<SeatChooser
		bind:open={chooserOpen}
		title={chooserTitle}
		{game}
		{characters}
		exclude={picking === 'decoyChose' ? undefined : believer}
		onChoose={chosen}
		onNone={picking === 'decoy'
			? () => ((chooserOpen = false), change({ decoy: undefined }))
			: undefined}
	>
		{#snippet rowMarks(seatId)}{#if picked.includes(seatId)}<Icon name="check" />{/if}{/snippet}
	</SeatChooser>
{/if}

<style>
	.cards {
		display: grid;
		gap: var(--space-2);
	}
	h3 {
		margin: 0;
	}
	.as {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
	}
	.text {
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
	.set,
	.chose {
		color: var(--on-surface-muted);
	}
	.chose {
		margin-inline: var(--space-1);
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
