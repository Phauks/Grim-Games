<script lang="ts">
	import { seatName } from '#lib/features/game/seat-label.ts';
	import type { Alignment, CharacterId, CharacterType } from '#lib/core/data/index.ts';
	import { rulesFor } from '#lib/core/rules/rules-for.ts';
	import {
		alignmentOf,
		scriptCharacterIds,
		trueCharacter,
		typeOf,
		type SeatId
	} from '#lib/core/model/index.ts';
	import { isReplacedAfterDraw } from '#lib/core/rules/bag-characters.ts';
	import {
		alsoBecomes,
		allEvilBecoming,
		arbitraryDeathPartners,
		arbitraryDeathsTonight,
		changeableSeats,
		characterChanger,
		createdTooLate,
		earlyOnly,
		jinxedPartners,
		neighbourAlignments,
		neighbourBecoming,
		jinxEffect,
		picksCharacterOnlyBy,
		storytellerGains,
		storytellerPicksNow,
		swapChoice,
		swapPartner,
		swappableSeats,
		type NightStep
	} from '#lib/core/rules/index.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import AlignmentPill from './AlignmentPill.svelte';
	import ShowToPlayerButton from '#lib/features/show/ShowToPlayerButton.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import CharacterPicker from './CharacterPicker.svelte';
	import JinxedPick from './JinxedPick.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import SeatChooser from './SeatChooser.svelte';

	/**
	 * A step whose character changes a chosen player's character tonight (`changesCharacter`:
	 * the Pit-Hag, the Summoner's Night 3, the Huntsman's Damsel; Trevor 2026-10-27 and
	 * 2026-10-29): the Storyteller picks the player it pointed at, then the character. The
	 * character list shows nothing of the grimoire, so the device can be handed to the player
	 * to point at one (https://wiki.bloodontheclocktower.com/Summoner: "a Demon icon on the
	 * character sheet"). Show to player follows.
	 *
	 * A step that swaps two players' characters (`swapsCharacters`: the Barber's haircuts,
	 * https://wiki.bloodontheclocktower.com/Barber) picks the two players instead; each keeps
	 * their alignment, and each is shown their new character. The Hatter's tea party
	 * (`sameType`, https://wiki.bloodontheclocktower.com/Hatter) lets each Minion and Demon
	 * player change in turn, each into another character of their own type. The Cult Leader
	 * (`takesNeighbourAlignment`, https://wiki.bloodontheclocktower.com/Cult_Leader) shows its
	 * alignment and offers each living neighbour's that differs. On the first night the Kazali
	 * (`upTo: 'minions'`, https://wiki.bloodontheclocktower.com/Kazali) makes evil Minions, one
	 * player after another, until the usual number are in play.
	 *
	 * A step whose character swaps with the Demon it chooses (`becomes.into: 'swap'`: the
	 * Snake Charmer, https://wiki.bloodontheclocktower.com/Snake_Charmer) picks the player it
	 * pointed at; the Demon swaps characters and alignments with it and the old Demon gets its
	 * token (Poisoned), in one change. Anyone else: nothing happens. Each swapped player can be
	 * shown their new character.
	 */
	interface Props {
		grimoire: Grimoire;
		step: NightStep;
		/** Show the new character to its player. */
		onShow: (characterId: CharacterId) => void;
		/** The characters made tonight on this step, the latest last, for its "You are" card. */
		onChanges?: (characterIds: readonly CharacterId[]) => void;
	}

	let { grimoire, step, onShow, onChanges }: Props = $props();

	// The ability this step uses: a gained or held one's own character (the Demon with the
	// Boffin's Huntsman), else the step's. A player who has it some other way (the
	// Alchemist-Summoner, by token) wakes at that character's own step (`abilityHolders`).
	const abilityId = $derived(
		step.gained?.status === 'has-ability' ? step.gained.characterId : step.character?.id
	);

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const rule = $derived(
		abilityId ? rulesFor(game, abilityId, characters)?.changesCharacter : undefined
	);
	const changer = $derived(abilityId ? characterChanger(game, abilityId, characters) : undefined);
	const onlyDemons = $derived(rule?.types.length === 1 && rule.types[0] === 'demon');
	const offered = $derived(
		abilityId ? new Set(changeableSeats(game, abilityId, characters)) : new Set()
	);
	// An ability the Storyteller holds is used by the Storyteller, whoever has its token (the
	// Summoner's, once the Engineer removes its living player from play; L118).
	const acts = $derived(step.storytellerAbility ? offered.size > 0 : changer !== undefined);
	const script = $derived(scriptCharacterIds(game.script));
	// Characters someone plays are left out when only not-in-play ones may be picked, except
	// one a jinx lets it create again with a spare token (the Pit-Hag's Village Idiot,
	// https://wiki.bloodontheclocktower.com/Pit-Hag#Related_Jinxes).
	const spare = $derived(
		abilityId ? jinxedPartners(abilityId, 'spareToken', game.script, characters) : []
	);
	// Making the night's Minions (the Kazali, the Lord of Typhon), a stand-in such as the
	// Marionette is never made: it enters play as the Demon's good neighbour, by its own token,
	// and is not told (https://wiki.bloodontheclocktower.com/Marionette#Related_Jinxes).
	const standIns = $derived(
		rule?.upTo
			? script.filter((id) => {
					const c = characters.get(id);
					return c !== undefined && isReplacedAfterDraw(c);
				})
			: []
	);
	const inPlay = $derived([
		...(rule?.notInPlay
			? game.seating
					.flatMap((id) => trueCharacter(game, id, characters) ?? [])
					.filter((id) => !spare.includes(id))
			: []),
		...standIns
	]);
	// Characters a jinx bars once a day is over (the Pit-Hag's and Hatter's Leviathan after
	// day 5, https://wiki.bloodontheclocktower.com/Leviathan#Related_Jinxes).
	const tooLate = $derived(abilityId ? createdTooLate(game, abilityId, characters) : []);
	// Characters whose player the Storyteller picks when this one creates them (the Pit-Hag's
	// Damsel): said on the step, as the Storyteller picks the player here anyway.
	const storytellerPicks = $derived(
		abilityId && rule
			? jinxedPartners(abilityId, 'storytellerPicksPlayer', game.script, characters)
			: []
	);

	// Characters that make every evil player them when this one creates them (Legion).
	const allEvil = $derived.by(() => {
		const by = abilityId;
		if (!by || !rule) return [];
		return script.filter((id) => jinxEffect(game, by, id, 'allEvilBecome', characters));
	});

	// The Summoner's jinxes (L118, https://wiki.bloodontheclocktower.com/Summoner#Related_Jinxes):
	// characters whose neighbours a jinx sets when this one creates them (the Lord of Typhon).
	const neighbourNotes = $derived.by(() => {
		const by = abilityId;
		if (!by || !rule) return [];
		return script.flatMap((id) => {
			const near = jinxEffect(game, by, id, 'alsoBecomes', characters);
			const type = near?.players === 'neighbours' ? near.type : undefined;
			return type ? [{ id, type }] : [];
		});
	});
	// A second living Demon made here makes deaths tonight arbitrary (the Hatter, Kazali, Pit-Hag).
	const arbitrary = $derived(
		abilityId && rule ? arbitraryDeathPartners(game, abilityId, characters) : []
	);
	const arbitraryNow = $derived.by(() => {
		const by = abilityId;
		return (
			by !== undefined && made.some((m) => arbitraryDeathsTonight(game, by, m.seatId, characters))
		);
	});
	// Living characters that leave the choice of player to the Storyteller (the Poppy Grower).
	const picksNow = $derived(
		abilityId && rule ? storytellerPicksNow(game, abilityId, characters) : []
	);
	// A giver whose jinx leaves the choice of player to the Storyteller for the player with this
	// ability (the Alchemist-Summoner chooses which Demon but not which player, L121).
	const characterOnly = $derived(
		abilityId && rule ? picksCharacterOnlyBy(game, abilityId, characters) : undefined
	);
	// The only characters it may make tonight, on a jinx's earlier token (the Pukka on Night 2).
	const early = $derived(abilityId && rule ? earlyOnly(game, abilityId, characters) : undefined);
	// Characters whose ability the Storyteller gains when this step changes their living player
	// (the Summoner, changed by the Engineer).
	const handsOver = $derived.by(() => {
		const by = abilityId;
		if (!by || !rule) return [];
		return script.filter(
			(id) => jinxEffect(game, id, by, 'storytellerHas', characters)?.once === 'changed'
		);
	});

	const swaps = $derived(
		abilityId ? rulesFor(game, abilityId, characters)?.swapsCharacters : undefined
	);
	// Any player with a character may be picked; the rule's left-out types are faded, as the
	// Storyteller may still override.
	const swappable = $derived(
		abilityId ? new Set(swappableSeats(game, abilityId, characters)) : new Set()
	);
	const swapMisfits = $derived(
		new Set(game.seating.filter((id) => game.seats[id].characterId && !swappable.has(id)))
	);
	// Once a Demon is picked first, another Demon is left out of the second pick.
	const secondMisfits = $derived.by(() => {
		if (abilityId === undefined || first === undefined) return swapMisfits;
		const ok = new Set(swappableSeats(game, abilityId, characters, first));
		return new Set(
			game.seating.filter((id) => id !== first && game.seats[id].characterId && !ok.has(id))
		);
	});
	// The Cult Leader's living neighbours' alignments, one of which it takes tonight.
	const neighbours = $derived(
		abilityId ? neighbourAlignments(game, abilityId, characters) : undefined
	);
	const takeAlignment = (seatId: SeatId, alignment: Alignment) =>
		grimoire.run({ type: 'SetAlignment', seatId, alignment });

	let firstOpen = $state(false);
	let secondOpen = $state(false);
	let first = $state<SeatId>();
	let swapped = $state<readonly SeatId[]>();

	function chooseFirst(seatId: SeatId) {
		firstOpen = false;
		first = seatId;
		secondOpen = true;
	}
	function chooseSecond(seatId: SeatId) {
		secondOpen = false;
		const seatA = first;
		first = undefined;
		if (!seatA) return;
		const command = {
			type: 'SwapCharacters' as const,
			seatId: seatA,
			withSeatId: seatId,
			keepAlignments: true as const
		};
		if (grimoire.run(command)) {
			swapped = [seatA, seatId];
			const ids = swapped.flatMap((s) => game.seats[s]?.characterId ?? []);
			onChanges?.(ids);
		}
	}

	// The Snake Charmer's choice: its player (or a Philosopher who took its token), and the two
	// seats it swapped tonight.
	const charms = $derived(
		abilityId ? rulesFor(game, abilityId, characters)?.becomes?.into === 'swap' : false
	);
	const charmer = $derived(
		charms && abilityId ? swapPartner(game, abilityId, characters) : undefined
	);
	let charmOpen = $state(false);
	let charmed = $state<readonly SeatId[]>();
	function charm(seatId: SeatId) {
		charmOpen = false;
		if (abilityId === undefined) return;
		const choice = swapChoice(game, abilityId, seatId, characters);
		if (!choice) return;
		if (grimoire.run({ type: 'SwapCharacters', ...choice })) {
			charmed = [choice.withSeatId, choice.seatId];
			onChanges?.(charmed.flatMap((s) => game.seats[s]?.characterId ?? []));
		}
	}

	let seatOpen = $state(false);
	let characterOpen = $state(false);
	let chosen = $state<SeatId>();
	// Each change made tonight; the Hatter's Minions and Demon may each change (`sameType`), and
	// the Kazali makes Minions until there are as many as usual (`upTo`).
	let made = $state<{ seatId: SeatId; characterId: CharacterId }[]>([]);
	$effect.pre(() => {
		void step.id;
		made = [];
		swapped = undefined;
		charmed = undefined;
	});

	function chooseSeat(seatId: SeatId) {
		seatOpen = false;
		chosen = seatId;
		characterOpen = true;
	}
	let jinxed = $state<JinxedPick>();
	// A character a jinx says is never dealt here: its chooser also picks one of this type and
	// becomes that (the Hatter's Lil' Monsta, a Minion; L116).
	let alsoType = $state<CharacterType>();
	let alsoSeat = $state<SeatId>();
	let alsoOpen = $state(false);
	function chooseCharacter(characterId: CharacterId) {
		characterOpen = false;
		const seatId = chosen;
		chosen = undefined;
		if (!seatId) return;
		const also = abilityId ? alsoBecomes(game, abilityId, characterId, characters) : undefined;
		if (also) {
			alsoType = also;
			alsoSeat = seatId;
			alsoOpen = true;
			return;
		}
		pickFor(seatId, characterId);
	}
	function chooseAlso(characterId: CharacterId) {
		alsoOpen = false;
		const seatId = alsoSeat;
		alsoSeat = undefined;
		if (seatId) pickFor(seatId, characterId);
	}
	function pickFor(seatId: SeatId, characterId: CharacterId) {
		// A jinx may say it can't be in play with a character in play: ask first.
		if (jinxed) jinxed.pick(seatId, characterId, () => change(seatId, characterId));
		else change(seatId, characterId);
	}
	// The jinxed characters this step can make that say so, for the step's note.
	const alsoNotes = $derived(
		abilityId && rule
			? script.flatMap((id) => {
					const type = alsoBecomes(game, abilityId, id, characters);
					return type ? [{ id, type }] : [];
				})
			: []
	);
	function change(seatId: SeatId, characterId: CharacterId) {
		const by = abilityId;
		const gains = by ? storytellerGains(game, seatId, by, characters) : undefined;
		const command = {
			type: 'AssignCharacter' as const,
			seatId,
			characterId,
			...(rule?.alignment ? { alignment: rule.alignment } : {}),
			// Kept on the seat for the jinxes that hang on who made the change (`Seat.changedBy`).
			...(abilityId ? { by: abilityId } : {})
		};
		if (grimoire.run(command)) {
			made = [...made.filter((m) => m.seatId !== seatId), { seatId, characterId }];
			// A jinx may make every other evil player it too (the Engineer's, Hatter's and
			// Summoner's Legion, https://wiki.bloodontheclocktower.com/Legion#Related_Jinxes).
			for (const other of by ? allEvilBecoming(grimoire.game, by, characterId, characters) : [])
				if (grimoire.run({ ...command, seatId: other }))
					made = [...made.filter((m) => m.seatId !== other), { seatId: other, characterId }];
			// The Storyteller gains the ability of a living player this removed from play.
			if (by && gains) grimoire.run({ type: 'SetStorytellerAbility', via: by, characterId: gains });
			// A summoned Lord of Typhon's other neighbour becomes an evil Minion: pick which.
			const near = by
				? neighbourBecoming(grimoire.game, by, characterId, seatId, characters)
				: undefined;
			if (near?.becomes !== undefined) {
				neighbourType = near.type;
				neighbourSeat = near.becomes;
				neighbourOpen = true;
			}
			onChanges?.(made.map((m) => m.characterId));
		}
	}
	let neighbourType = $state<CharacterType>();
	let neighbourSeat = $state<SeatId>();
	let neighbourOpen = $state(false);
	function chooseNeighbour(characterId: CharacterId) {
		neighbourOpen = false;
		const seatId = neighbourSeat;
		neighbourSeat = undefined;
		if (!seatId) return;
		const command = {
			type: 'AssignCharacter' as const,
			seatId,
			characterId,
			alignment: 'evil' as const,
			...(abilityId ? { by: abilityId } : {})
		};
		if (grimoire.run(command)) {
			made = [...made.filter((m) => m.seatId !== seatId), { seatId, characterId }];
			onChanges?.(made.map((m) => m.characterId));
		}
	}
	// A character a jinx says must neighbour a type, faded for a player who neighbours none.
	function neighbourMisfit(seatId: SeatId | undefined, characterId: CharacterId) {
		const by = abilityId;
		if (!by || seatId === undefined) return undefined;
		const near = neighbourBecoming(game, by, characterId, seatId, characters);
		return near && !near.fits ? `Must neighbour ${TYPE_ARTICLE[near.type]}` : undefined;
	}
	const inPlayNow = $derived(
		game.seating.flatMap((id) => trueCharacter(game, id, characters) ?? [])
	);
	// With `sameType`, the chosen player picks from their own type, not their own character;
	// with `anyType` too (the Hatter's optional rule), from any of the rule's types.
	const chosenType = $derived(chosen ? typeOf(game, chosen, characters) : undefined);
	const pickTypes = $derived(
		rule?.sameType && !rule.anyType && chosenType ? [chosenType] : (rule?.types ?? [])
	);
	const chosenOwn = $derived(chosen ? trueCharacter(game, chosen, characters) : undefined);
	const left = $derived([
		...inPlay,
		...tooLate,
		...(rule?.sameType && chosenOwn ? [chosenOwn] : []),
		...(early ? script.filter((id) => !early.includes(id)) : [])
	]);
	const playerName = (seatId: SeatId) => seatName(game, seatId);
	const TYPE_ARTICLE: Record<CharacterType, string> = {
		townsfolk: 'a Townsfolk',
		outsider: 'an Outsider',
		minion: 'a Minion',
		demon: 'a Demon',
		traveller: 'a Traveller',
		fabled: 'a Fabled',
		loric: 'a Loric'
	};
</script>

{#snippet newCharacter(seatId: SeatId, characterId: CharacterId | undefined)}
	{#if characterId}
		<CharacterPiece
			template="badge"
			{characterId}
			character={characters.get(characterId)}
			alignment={alignmentOf(game, seatId)}
			playerName={playerName(seatId)}
		/>
		<ShowToPlayerButton onclick={() => onShow(characterId)} />
	{/if}
{/snippet}

{#if neighbours}
	{@const now = alignmentOf(game, neighbours.seatId)}
	<h3>Alignment</h3>
	<div class="row" data-testid="neighbour-alignment">
		{#if now}<AlignmentPill alignment={now} />{/if}
		<span class="none"></span>
		{#each neighbours.alignments.filter((a) => a !== now) as alignment (alignment)}
			<Button variant="quiet" onclick={() => takeAlignment(neighbours.seatId, alignment)}
				>Make {alignment}</Button
			>
		{/each}
	</div>
{/if}

{#if swaps && (swappable.size >= 2 || swapped)}
	<h3>Swapped characters</h3>
	<div class="row" data-testid="swap-characters">
		{#if swapped}
			{#each swapped as seatId (seatId)}
				{@render newCharacter(seatId, game.seats[seatId]?.characterId)}
			{/each}
		{:else}
			<span class="none">None</span>
			<Button variant="quiet" onclick={() => (firstOpen = true)}>Choose</Button>
		{/if}
	</div>
	<SeatChooser
		bind:open={firstOpen}
		title="Swaps character"
		{game}
		{characters}
		offer={(id) => !!game.seats[id].characterId}
		misfits={swapMisfits}
		onChoose={chooseFirst}
	/>
	<SeatChooser
		bind:open={secondOpen}
		title="Swaps with"
		{game}
		{characters}
		exclude={first}
		offer={(id) => !!game.seats[id].characterId}
		misfits={secondMisfits}
		onChoose={chooseSecond}
	/>
{/if}

{#if charms && (charmer !== undefined || charmed)}
	<h3>Swapped characters</h3>
	<div class="row" data-testid="charm-swap">
		{#if charmed}
			{#each charmed as seatId (seatId)}
				{@render newCharacter(seatId, game.seats[seatId]?.characterId)}
			{/each}
		{:else}
			<span class="none">None</span>
			<Button variant="quiet" onclick={() => (charmOpen = true)}>Choose</Button>
		{/if}
	</div>
	<SeatChooser
		bind:open={charmOpen}
		title="Chooses a player"
		{game}
		{characters}
		offer={(id) => !game.seats[id].dead}
		onChoose={charm}
	/>
{/if}

{#if rule && (acts || made.length)}
	<h3>{onlyDemons ? 'New Demon' : 'New character'}</h3>
	<div class="row" data-testid="change-character">
		{#each made as change (change.seatId)}
			{@render newCharacter(change.seatId, change.characterId)}
		{:else}
			<span class="none">None</span>
		{/each}
		{#if !made.length || ((rule.sameType || rule.upTo) && acts)}
			<Button variant="quiet" onclick={() => (seatOpen = true)}>Choose</Button>
		{/if}
	</div>
	{#each alsoNotes as note (note.id)}
		<p class="note" role="note" data-testid="also-becomes">
			<CharacterPiece
				template="badge"
				characterId={note.id}
				character={characters.get(note.id)}
				interactive={false}
			/>: whoever chooses it also chooses {TYPE_ARTICLE[note.type]} to become.
		</p>
	{/each}
	{#each allEvil as id (id)}
		<p class="note" role="note" data-testid="all-evil-become">
			<CharacterPiece
				template="badge"
				characterId={id}
				character={characters.get(id)}
				interactive={false}
			/>: if created, every evil player becomes it.
		</p>
	{/each}
	{#each neighbourNotes as note (note.id)}
		<p class="note" role="note" data-testid="neighbour-becomes">
			<CharacterPiece
				template="badge"
				characterId={note.id}
				character={characters.get(note.id)}
				interactive={false}
			/>: if created, they must neighbour {TYPE_ARTICLE[note.type]}, and their other neighbour
			becomes an evil one.
		</p>
	{/each}
	{#if arbitrary.length > 0}
		<!-- One line in one place, before and after the change, so nothing moves. -->
		<p
			class="note"
			class:warn={arbitraryNow}
			role={arbitraryNow ? 'alert' : 'note'}
			data-testid="arbitrary-deaths"
		>
			{#if arbitraryNow}
				A second living Demon: deaths tonight are arbitrary.
			{:else}
				If this makes a second living Demon, deaths tonight are arbitrary.
			{/if}
		</p>
	{/if}
	{#each picksNow as id (id)}
		<p class="note" role="note" data-testid="storyteller-picks-now">
			<CharacterPiece
				template="badge"
				characterId={id}
				character={characters.get(id)}
				interactive={false}
			/> is alive: the Storyteller chooses which player, only the character is chosen here.
		</p>
	{/each}
	{#if characterOnly}
		<p class="note" role="note" data-testid="picks-character-only">
			<CharacterPiece
				template="badge"
				characterId={characterOnly}
				character={characters.get(characterOnly)}
				interactive={false}
			/> has this ability: they choose only the character, the Storyteller chooses which player.
		</p>
	{/if}
	{#if early}
		<p class="note" role="note" data-testid="early-only">
			Tonight only
			{#each early as id, i (id)}{i > 0 ? ', ' : ''}<CharacterPiece
					template="badge"
					characterId={id}
					character={characters.get(id)}
					interactive={false}
				/>{/each}
			may be made, a night early.
		</p>
	{/if}
	{#each handsOver as id (id)}
		<p class="note" role="note" data-testid="storyteller-gains">
			<CharacterPiece
				template="badge"
				characterId={id}
				character={characters.get(id)}
				interactive={false}
			/>: if its living player changes character, the Storyteller has its ability.
		</p>
	{/each}
	{#each storytellerPicks as id (id)}
		<p class="note" role="note" data-testid="storyteller-picks-player">
			<CharacterPiece
				template="badge"
				characterId={id}
				character={characters.get(id)}
				interactive={false}
			/>: the Storyteller chooses which player becomes it.
		</p>
	{/each}
	<SeatChooser
		bind:open={seatOpen}
		title={onlyDemons ? 'Becomes the Demon' : 'Changes character'}
		{game}
		{characters}
		offer={(id) => offered.has(id)}
		onChoose={chooseSeat}
	/>
	<CharacterPicker
		bind:open={characterOpen}
		title={onlyDemons ? 'Choose a Demon' : 'Choose a character'}
		{characters}
		script={game.script}
		types={pickTypes}
		exclude={left}
		faded={(c) => jinxed?.note(chosen, c) ?? neighbourMisfit(chosen, c.id)}
		onPick={chooseCharacter}
	/>
	<CharacterPicker
		bind:open={neighbourOpen}
		title={neighbourType
			? `Neighbour becomes ${TYPE_ARTICLE[neighbourType]}`
			: 'Neighbour becomes a character'}
		{characters}
		script={game.script}
		types={neighbourType ? [neighbourType] : []}
		exclude={inPlayNow}
		faded={(c) => jinxed?.note(neighbourSeat, c)}
		onPick={chooseNeighbour}
	/>
	<CharacterPicker
		bind:open={alsoOpen}
		title={alsoType ? `Also choose ${TYPE_ARTICLE[alsoType]}` : 'Also choose a character'}
		{characters}
		script={game.script}
		types={alsoType ? [alsoType] : []}
		exclude={left}
		faded={(c) => jinxed?.note(alsoSeat, c)}
		onPick={chooseAlso}
	/>
	<JinxedPick bind:this={jinxed} {game} {characters} />
{/if}

<style>
	h3 {
		margin: var(--space-2) 0 var(--space-1);
		font-size: 1rem;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.none {
		flex: 1;
		color: var(--on-surface-muted);
	}
	.note {
		margin: 0 0 var(--space-2);
		color: var(--on-surface-muted);
	}
	.note.warn {
		color: var(--on-surface);
		font-weight: 600;
	}
</style>
