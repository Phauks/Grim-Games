<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import { dayUseCandidates, dayUseUsers } from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import SeatChooser from '#lib/features/grimoire/SeatChooser.svelte';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import type { DayPort } from './day-port.ts';

	/**
	 * Use, on the row of a rule character whose day ability any living player may use once per
	 * game (`dayUse.anyone`: the Doomsayer, https://wiki.bloodontheclocktower.com/Doomsayer). It
	 * asks which living player uses it, those who already did faded but choosable (warn, never
	 * lock), then hands that player to `onChoose` (the day's DayUseDialog asks who dies). Disabled
	 * while nobody may use it (too few alive, or everyone has).
	 */
	interface Props {
		game: DayPort;
		characterId: CharacterId;
		onChoose: (seatId: SeatId) => void;
	}

	let { game, characterId, onChoose }: Props = $props();

	const g = $derived(game.game);
	let open = $state(false);
	const used = $derived(new Set(dayUseUsers(g, characterId)));
	const title = t('day.useAnyoneWho', { character: slot('character') });

	function chose(seatId: SeatId) {
		open = false;
		onChoose(seatId);
	}
</script>

<!-- eslint-disable grim/names-as-badges -- accessible name (aria-label) only -->
<Chip
	data-testid="day-use-anyone"
	disabled={dayUseCandidates(g, characterId, game.characters).length === 0}
	aria-label={t('day.useAnyoneLabel', { character: game.characterName(characterId) })}
	onclick={() => (open = true)}>{t('day.useAnyone')}</Chip
>
<!-- eslint-enable grim/names-as-badges -->

<SeatChooser
	bind:open
	{title}
	game={g}
	characters={game.characters}
	offer={(s) => !g.seats[s].dead}
	misfits={used}
	onChoose={chose}
>
	{#snippet heading()}
		<Sentence text={title} {fill} />
	{/snippet}
</SeatChooser>

{#snippet fill(name: string)}{#if name === 'character'}<CharacterBadge
			{characterId}
			character={game.characters.get(characterId)}
			interactive={false}
		/>{/if}{/snippet}
