<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import { turnOffer, type Conversion } from '#lib/core/modes/index.ts';
	import SharedPicker from '#lib/features/characters/CharacterPicker.svelte';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { TYPE_LABELS } from '#lib/features/reference/labels.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import DraftSeatList from './DraftSeatList.svelte';

	/**
	 * Once everyone has drafted, a drafted character that turns players into another type (the
	 * Kazali's Minions, Grimbits' draft): the Storyteller picks a player, then which character of
	 * that type they become, until the count is reached or they stop. Neighbours turned (the Lord
	 * of Typhon's) each pick their own from offers, as in the draft, refusing down to the last
	 * (Trevor, 2026-10-27: "the selected ppl can select their minion through the mulligan").
	 */
	interface Props {
		open: boolean;
		conversion: Conversion;
		by: Character | undefined;
		/** The seats (by pick index) that may be turned. */
		seats: readonly number[];
		seatLabel: (seat: number) => string;
		/** What each seat drafted. */
		kept: (seat: number) => Character | undefined;
		/** The characters of the type they may become. */
		characters: readonly Character[];
		/** The draft's offer sizes (3 → 2 → 1), for players who pick their own. */
		offers: readonly number[];
		onDone: (turned: Record<number, CharacterId>) => void;
	}

	let {
		open = $bindable(),
		conversion,
		by,
		seats,
		seatLabel,
		kept,
		characters,
		offers,
		onDone
	}: Props = $props();

	let turned = $state<Record<number, CharacterId>>({});
	let at = $state<number | undefined>();
	const left = $derived(seats.filter((i) => turned[i] === undefined));
	const options = $derived(characters.filter((c) => !Object.values(turned).includes(c.id)));
	const type = $derived(TYPE_LABELS[conversion.type]);
	/** Each player picks their own, seat by seat. */
	const own = $derived(conversion.players === 'neighbours');
	let refused = $state<CharacterId[]>([]);
	let offerIndex = $state(0);
	let offer = $state<CharacterId[]>([]);
	const offered = $derived(offer.flatMap((id) => options.find((c) => c.id === id) ?? []));

	function deal(index: number) {
		offerIndex = index;
		const size = offers[index] ?? 1;
		offer = turnOffer(
			options.map((c) => c.id),
			refused,
			size,
			Math.random
		);
	}

	$effect(() => {
		if (own && at === undefined && left.length > 0) {
			at = left[0];
			refused = [];
			deal(0);
		}
	});

	function refuse() {
		refused = [...refused, ...offer];
		deal(offerIndex + 1);
	}

	function become(id: CharacterId) {
		if (at === undefined) return;
		turned = { ...turned, [at]: id };
		at = undefined;
		if (Object.keys(turned).length >= conversion.count || left.length === 0) onDone(turned);
	}
</script>

<Dialog bind:open title={t('modes.deal.askTitle')} size="full">
	{#snippet subtitle()}{#if by}<CharacterBadge characterId={by.id} character={by} />{/if}{/snippet}
	{#if at === undefined}
		<div class="ask" data-testid="draft-convert">
			<p class="prompt">{t('modes.deal.convertSeat', { type })}</p>
			<!-- Each seat that may be turned. -->
			<DraftSeatList
				seats={left}
				{seatLabel}
				{kept}
				onPick={(i) => (at = i)}
				last={t('modes.deal.convertStop')}
				onLast={() => onDone(turned)}
				testid="convert-seats"
			/>
		</div>
	{:else}
		<div class="choose" data-testid="convert-character">
			{#if own}
				<p class="seat">{seatLabel(at)}</p>
				<p class="prompt">
					{t('modes.deal.turned', { type })}{#if by}<CharacterBadge
							characterId={by.id}
							character={by}
						/>{/if}
				</p>
			{:else}
				<p class="prompt">{t('modes.deal.convertCharacter', { type, seat: seatLabel(at) })}</p>
			{/if}
			{#if options.length === 0}
				<p>{t('modes.deal.noOptions')}</p>
			{:else}
				<div class="list">
					<SharedPicker
						characters={own ? offered : options}
						collapsibleKey="deal"
						showSearch={false}
						onSelect={become}
					/>
				</div>
			{/if}
			{#if own}
				<Button icon="random" disabled={offerIndex >= offers.length - 1} onclick={refuse}>
					{t('modes.deal.refuse')}
				</Button>
			{/if}
		</div>
	{/if}
</Dialog>

<style>
	.prompt,
	.seat {
		margin: 0;
	}
	.prompt {
		font-weight: 600;
	}
	.ask,
	.choose {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	/* A full dialog doesn't scroll itself: its content does. */
	.choose,
	.list {
		flex: 1;
		min-height: 0;
	}
	.list {
		display: flex;
		flex-direction: column;
	}
</style>
