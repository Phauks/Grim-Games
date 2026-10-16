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
	 * Sample games in memory for tests, run through the real engine. `tb`: 8 players, one a
	 * Drunk who thinks they are the Chef. `bmr`: 8 players with a Lunatic.
	 */
	interface Props {
		variant?: 'tb' | 'bmr';
	}

	let { variant = 'tb' }: Props = $props();

	const CASTS = {
		tb: ['washerwoman', 'slayer', 'virgin', 'undertaker', 'empath', 'chef', 'poisoner', 'imp'],
		bmr: [
			'grandmother',
			'sailor',
			'chambermaid',
			'exorcist',
			'lunatic',
			'tinker',
			'godfather',
			'zombuul'
		]
	};

	let session = $state.raw<GameSession>();
	let characters = $state.raw<CharacterLookup>();
	let open = $state(false);

	function start(data: GameData) {
		const loaded = editionScript(variant, data);
		if (!loaded) return;
		const script = {
			meta: loaded.meta,
			entries: loaded.characters.map((c) => ({ kind: 'official' as const, id: c.id }))
		};
		const lookup = characterLookup(data, script);
		const ctx = systemContext(lookup);
		const cast = CASTS[variant];
		const created = createGame({ type: 'CreateGame', script, playerCount: cast.length }, ctx);
		if (!created.ok) return;
		let s = created.session;
		const seats = s.game.seating;
		const commands: Command[] = cast.map((characterId, i) => ({
			type: 'AssignCharacter',
			seatId: seats[i],
			characterId
		}));
		if (variant === 'tb') {
			commands.push({
				type: 'AddReminder',
				seatId: seats[cast.indexOf('chef')],
				reminder: { characterId: 'drunk', label: 'Is The Drunk' }
			});
		}
		for (const command of commands) {
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

<Button icon="demon" disabled={!session} onclick={() => (open = true)}
	>{variant === 'bmr' ? 'Demon bluffs (Lunatic game)' : 'Demon bluffs'}</Button
>
{#if session && characters}
	<BluffsSheet bind:open game={session.game} {characters} dispatch={run} />
{/if}
