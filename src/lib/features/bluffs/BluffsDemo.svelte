<script lang="ts">
	import { onMount } from 'svelte';
	import { editionScript, type GameData } from '#lib/core/data/index.ts';
	import {
		createGame,
		dispatch,
		systemContext,
		type Command,
		type GameSession
	} from '#lib/core/engine/index.ts';
	import { characterLookup, type CharacterLookup } from '#lib/core/model/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import BluffsSheet, { type BluffCommand } from './BluffsSheet.svelte';

	/**
	 * A stand-in for the grimoire board until it mounts the sheet: an 8-player Trouble
	 * Brewing game in memory, run through the real engine.
	 */
	const CAST = [
		'washerwoman',
		'slayer',
		'virgin',
		'undertaker',
		'empath',
		'chef',
		'poisoner',
		'imp'
	];

	let session = $state.raw<GameSession>();
	let characters = $state.raw<CharacterLookup>();
	let open = $state(false);

	function start(data: GameData) {
		const loaded = editionScript('tb', data);
		if (!loaded) return;
		const script = {
			meta: loaded.meta,
			entries: loaded.characters.map((c) => ({ kind: 'official' as const, id: c.id }))
		};
		const lookup = characterLookup(data, script);
		const ctx = systemContext(lookup);
		const created = createGame({ type: 'CreateGame', script, playerCount: CAST.length }, ctx);
		if (!created.ok) return;
		let s = created.session;
		for (const [i, characterId] of CAST.entries()) {
			const command: Command = { type: 'AssignCharacter', seatId: s.game.seating[i], characterId };
			const result = dispatch(s, command, ctx);
			if (result.ok) s = result.session;
		}
		characters = lookup;
		session = s;
	}

	function run(command: BluffCommand) {
		if (!session || !characters) throw new Error('no game');
		const result = dispatch(session, command, systemContext(characters));
		if (result.ok) session = result.session;
		return result;
	}

	onMount(() => void loadOfficialData().then(start));
</script>

<Button icon="demon" disabled={!session} onclick={() => (open = true)}>Demon bluffs</Button>
{#if session && characters}
	<BluffsSheet bind:open game={session.game} {characters} dispatch={run} />
{/if}
