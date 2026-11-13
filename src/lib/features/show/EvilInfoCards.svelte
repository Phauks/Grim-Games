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
		fakeEvilInfoOf
	} from '#lib/core/rules/night/evil-info.ts';
	import { shownAtMinionInfo } from '#lib/core/rules/night/shown-to.ts';
	import { type Night } from '#lib/core/model/overrides.ts';
	import {
		bluffSetLabel,
		charactersReallyInPlay,
		DEMON_SET,
		LUNATIC_SET,
		showableBluffSets
	} from '#lib/features/bluffs/bluffs.ts';
	import { gameHasDemonBluffs } from '#lib/features/modes/bluffs.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import { seatName } from '#lib/features/grimoire/night/night-steps.ts';
	import SeatChooser from '#lib/features/grimoire/seats/SeatChooser.svelte';
	import NightText from '#lib/features/reference/NightText.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import StepLine from '#lib/features/reference/StepLine.svelte';
	import NightTextLines from '#lib/features/reference/NightTextLines.svelte';
	import type { NightTextSteps } from '#lib/core/rules/night/night-text.ts';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import SeatBadge from '#lib/features/board/SeatBadge.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import StepLines from '#lib/features/reference/StepLines.svelte';
	import ShowToPlayerButton from './ShowToPlayerButton.svelte';
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
		/**
		 * The step's text as lines (`stepNightText`): the cards are drawn on the lines that say
		 * to show them, as a character's step draws its info tokens (Trevor, 2026-11-06: "make
		 * sure these conform totally with how a character would show up"). Without it, the cards
		 * come with their heading and their own list (a believer's).
		 */
		textLines?: NightTextSteps;
		/** The step's name, never marked as a Glossary term in its own text. */
		name?: string;
	}

	let {
		game,
		characters,
		step,
		believer,
		night = 'first',
		onShow,
		onChooseBluffs,
		onFakeChange,
		textLines,
		name
	}: Props = $props();

	/** The cards shown at this step, drawn as done; forgotten on another step. */
	let shownRows = $state<readonly string[]>([]);
	$effect.pre(() => {
		void step;
		void believer;
		shownRows = [];
	});

	const text = (id: string) => STANDARD_INFO_TOKENS.find((t) => t.id === id)?.text ?? '';
	const seatsOf = (type: 'minion' | 'demon') =>
		game.seating.filter((s) => {
			const id = trueCharacter(game, s, characters);
			return id !== undefined && characters.get(id)?.type === type;
		});
	const union = (a: readonly SeatId[], b: readonly SeatId[]) => [...new Set([...a, ...b])];
	const info = $derived(demonInfo(game, characters));
	const demons = $derived(union(seatsOf('demon'), info.shownAsDemon));
	/** Minions the Demon is not told about by a jinx (the Magician's Marionette, L119). */
	const hiddenMinions = $derived(info.neighbourHidden?.seats ?? []);
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
		/** What `flag` changes, when not the usual hiding of the evil team. */
		flagText?: string;
		/** Players to add with one tap (the Magician as a fake Minion). */
		adds?: readonly SeatId[];
		/** Choose or Edit what the row shows, as an icon. */
		edit?: { label: string; icon: 'edit' | 'demon'; action: () => void };
		/** Nothing to show yet (no bluffs chosen): only its `edit`. */
		noShow?: boolean;
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
					edit: { label: t('show.evil.choose'), icon: 'edit', action: () => pick('decoyChose') }
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
				edit: { label: t('show.evil.choose'), icon: 'edit', action: () => pick('minions') }
			},
			{
				key: 'bluffs',
				title: text('not-in-play'),
				set: bluffSetLabel(LUNATIC_SET, true, game.bluffNames[LUNATIC_SET]),
				characterIds: bluffs,
				showCharacters: bluffs,
				edit: { label: t('show.evil.edit'), icon: 'edit', action: onChooseBluffs }
			},
			{
				key: 'decoy',
				title: text('this-player-is'),
				seats: fake.decoy ? [fake.decoy] : [],
				characterIds: lunatic,
				showCharacters: lunatic,
				edit: { label: t('show.evil.choose'), icon: 'edit', action: () => pick('decoy') }
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
			// A jinx keeps a neighbour's Minion from the Demon (the Magician with the Marionette,
			// https://wiki.bloodontheclocktower.com/Magician#Related_Jinxes).
			const neighbour = info.neighbourHidden;
			out.push({
				key: 'minions',
				title: text('these-are-your-minions'),
				seats: minions.filter((s) => !hiddenMinions.includes(s)),
				...(hiddenFlag
					? { flag: hiddenFlag }
					: neighbour
						? {
								flag: neighbour.hiddenBy,
								flagText: t('show.evil.neighbourHidden')
							}
						: {})
			});
			// A jinx has the Demon's players wake in groups and learn who is good (the Magician
			// with Legion, https://wiki.bloodontheclocktower.com/Legion#Related_Jinxes).
			if (info.goodShown)
				out.push({
					key: 'good',
					title: t('show.evil.good'),
					seats: info.goodShown.seats,
					flag: info.goodShown.hiddenBy,
					flagText: t('show.evil.groups')
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

	/**
	 * No bluffs yet: the bluffs' line offers to choose them, unless the mode gives the Demon
	 * none (Sushi Buffet, Whale Buffet).
	 */
	const allRows = $derived<Row[]>(
		step === 'demoninfo' && bluffSets.length === 0 && gameHasDemonBluffs(game.gameId)
			? [
					...rows,
					{
						key: 'no-bluffs',
						title: text('not-in-play'),
						characterIds: [],
						noShow: true,
						edit: { label: t('show.evil.chooseBluffs'), icon: 'demon', action: onChooseBluffs }
					}
				]
			: rows
	);
	/**
	 * Which line of the step's text says to show each card (`MARKER_TEXT`): Minion info's
	 * "Show them the Demon." and "Show them the other Minions.", Demon info's "Show them their
	 * Minions." and "Show them 3 good characters not in play as bluffs."
	 */
	const LINE_OF: Record<string, Record<string, number>> = {
		minioninfo: { demon: 1, minions: 2 },
		demoninfo: { minions: 1, [`bluffs-${DEMON_SET}`]: 2, 'no-bluffs': 2 }
	};
	const lineCount = $derived(textLines?.lines.length ?? 0);
	const lineOf = (row: Row) => {
		const at = LINE_OF[step]?.[row.key];
		return at !== undefined && at < lineCount ? at : undefined;
	};
	/** The cards on each line, by its place in reading order. */
	const onLine = (line: number) => allRows.filter((row) => lineOf(row) === line);
	const offLine = $derived(allRows.filter((row) => lineOf(row) === undefined));

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

<!-- A player as the badge with their player, as every Storyteller screen shows a seat. -->
{#snippet player(seatId: SeatId)}<SeatBadge
		{game}
		{characters}
		{seatId}
		characterId={trueCharacter(game, seatId, characters)}
	/>{/snippet}

<!-- What a card shows: the card, whom it points at, its characters and any warning. -->
{#snippet detail(row: Row)}
	<span class="what">
		{#if row.title}<span class="card"
				><ReminderToken
					label={row.title}
					variant="info"
					title={t('reference.infoToken')}
				/>{#if row.set}<span class="set">{row.set}</span>{/if}</span
			>{/if}
		{#if row.seats}
			<span class="badges who"
				>{#each row.seats as seatId (seatId)}{@render player(seatId)}{:else}{t(
						'common.none'
					)}{/each}</span
			>
			{#if row.chose}
				<span class="badges who"
					><span class="chose">{t('show.evil.chose')}</span
					>{#each row.chose as seatId (seatId)}<PlayerBadge
							name={seatName(game, seatId)}
						/>{:else}{t('common.none')}{/each}</span
				>
			{/if}
		{/if}
		{#if row.characterIds}
			<span class="badges">
				{#each row.characterIds as id (id)}
					<CharacterPiece
						template="badge"
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
				><Icon name="warning" /><CharacterPiece
					template="badge"
					characterId={row.flag}
					character={characters.get(row.flag)}
					interactive={false}
				/>{row.flagText ?? t('show.evil.hidden')}</span
			>
		{/if}
	</span>
{/snippet}

<!-- A card's buttons, icons only as on a character's lines (Trevor, 2026-11-06). -->
{#snippet buttons(row: Row)}
	{@const empty =
		row.showCharacters?.length === 0 || (step === 'believer' && row.seats?.length === 0)}
	{#if row.edit}<IconButton
			icon={row.edit.icon}
			label={row.edit.label}
			outlined
			onclick={row.edit.action}
		/>{/if}
	{#if !row.noShow}<ShowToPlayerButton
			disabled={empty}
			aria-label={`${t('show.toPlayer')}: ${cardName(row)}`}
			onclick={() => {
				if (!shownRows.includes(row.key)) shownRows = [...shownRows, row.key];
				onShow(shown(row));
			}}
		/>{/if}
{/snippet}

{#snippet cardLine(row: Row)}
	<StepLine data-testid="evil-info-card" data-row={row.key} marked={shownRows.includes(row.key)}>
		{@render detail(row)}
		{#snippet end()}{@render buttons(row)}{/snippet}
	</StepLine>
{/snippet}

{#if textLines}
	<!-- The step's own lines, each card on the line that says to show it, as a character's
	     info tokens sit on their lines; any other card is a line after them. -->
	<NightTextLines
		steps={textLines}
		{name}
		marked={(i) => onLine(i).some((row) => shownRows.includes(row.key))}
	>
		{#snippet lineExtra(i)}{#each onLine(i) as row (row.key)}<span
					class="on-line"
					data-testid="evil-info-card"
					data-row={row.key}>{@render detail(row)}</span
				>{/each}{/snippet}
		{#snippet lineEnd(i)}{#each onLine(i) as row (row.key)}{@render buttons(row)}{/each}{/snippet}
		{#snippet after()}{#each offLine as row (row.key)}{@render cardLine(row)}{/each}{/snippet}
	</NightTextLines>
{:else}
	<section
		class="cards"
		aria-label={step === 'believer' ? t('show.evil.believerTitle') : t('show.evil.title')}
	>
		{#if step === 'believer' && believedText && believed}
			<h3 class="as">
				{t('show.evil.as')}
				<CharacterPiece
					template="badge"
					characterId={believed.id}
					character={believed}
					interactive={false}
				/>
			</h3>
			<p class="text" data-testid="believed-demon-text">
				<NightText text={believedText} character={believed} night="other" />
			</p>
		{/if}
		<h3>{step === 'believer' ? t('show.evil.believerTitle') : t('show.evil.title')}</h3>
		<div class="list">
			<StepLines
				>{#each allRows as row (row.key)}{@render cardLine(row)}{/each}</StepLines
			>
		</div>
	</section>
{/if}

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
	.list {
		border-top: 0.0625rem solid var(--border);
	}
	.on-line {
		display: block;
		margin-block-start: var(--space-1);
	}
	.card {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
	}
	.what {
		display: grid;
		min-width: 0;
		gap: var(--space-1);
	}
	.set,
	.chose {
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
</style>
