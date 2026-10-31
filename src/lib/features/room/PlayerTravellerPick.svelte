<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, CharacterId, PlayerName } from '#lib/core/data/index.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import CharacterRow from '#lib/features/characters/CharacterRow.svelte';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { roomScript } from './room-script.svelte.ts';
	import type { RoomPlayer } from './player.svelte.ts';

	/**
	 * Travellers choose on their phones (Trevor, 2026-10-31): the player picks their Traveller
	 * (https://wiki.bloodontheclocktower.com/Glossary, "Traveller"). Every phone choosing sees
	 * the same list; a tap holds one, greyed on the others with who holds it, a tap on another
	 * lets the first go, and Confirm sends it. Opens when the Storyteller sends the choice.
	 */
	let { player }: { player: RoomPlayer } = $props();

	const pick = $derived(player.view?.travellerPick);
	$effect(() => void loadOfficialData());
	const byId = $derived(
		new Map<CharacterId, Character>([
			...(officialData.current?.characters ?? []).map((c) => [c.id, c] as const),
			...(roomScript(player.code)?.characters ?? []).map((c) => [c.id, c] as const)
		])
	);
	const options = $derived(
		(pick?.options ?? []).flatMap((id) => {
			const character = byId.get(id);
			return character ? [character] : [];
		})
	);
	const offline = $derived(player.status !== 'open');

	let open = $state(false);
	let seenPick = '';
	$effect(() => {
		const id = pick?.pickId ?? '';
		if (id !== seenPick) open = !!pick && !pick.confirmed;
		seenPick = id;
	});

	/** The Traveller this phone last tapped, to say so when another phone got there first. */
	let tapped = $state<CharacterId>();
	$effect(() => {
		if (!tapped || !pick) return;
		const by = pick.held[tapped];
		if (pick.mine === tapped) tapped = undefined;
		else if (by !== undefined) {
			toast(t('room.travellers.taken', { player: by }));
			tapped = undefined;
		}
	});

	function tap(id: CharacterId) {
		if (!pick || pick.confirmed || offline) return;
		if (pick.mine === id) return;
		tapped = id;
		player.holdTraveller(id);
	}
</script>

{#if pick}
	<Dialog bind:open title={t('room.travellers.choose')}>
		<ul class="list" data-testid="traveller-pick">
			{#each options as character (character.id)}
				{@const by = pick.held[character.id]}
				{@const mine = pick.mine === character.id}
				<li>
					<CharacterRow
						{character}
						info
						current={mine}
						disabled={by !== undefined || (!!pick.confirmed && !mine) || offline}
						playerName={by ? (by as PlayerName) : undefined}
						note={mine
							? t(pick.confirmed ? 'room.travellers.sent' : 'room.travellers.held')
							: by !== undefined
								? t('room.travellers.heldBy')
								: undefined}
						withNote
						onclick={() => tap(character.id)}
					/>
				</li>
			{/each}
		</ul>
		{#snippet actions()}
			<ModalActions
				onConfirm={() => player.confirmTraveller()}
				disabled={offline || !pick.mine || !!pick.confirmed}
			/>
		{/snippet}
	</Dialog>
{/if}

<style>
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
	}
</style>
