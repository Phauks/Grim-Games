<script lang="ts">
	import PageMenuButton from '#lib/features/shell/PageMenuButton.svelte';
	import { APP_NAME } from '#lib/core/app-name.ts';
	import type { CharacterId, Jinx, PlayerName } from '#lib/core/data/index.ts';
	import Character from '#lib/features/characters/Character.svelte';
	import JinxMark from '#lib/features/characters/JinxMark.svelte';
	import {
		CHARACTER_TEMPLATE_NAMES,
		CHARACTER_TEMPLATES,
		type CharacterTemplateName
	} from '#lib/features/characters/character-templates.ts';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';

	/*
	 * The one character piece with its switches (Trevor, 2026-11-02: "make it toggleable so i
	 * could control it"). Every look below is the real component the app uses.
	 */
	const CHARACTERS: { value: CharacterId; label: string }[] = [
		{ value: 'washerwoman' as CharacterId, label: 'Washerwoman' },
		{ value: 'imp' as CharacterId, label: 'Imp' },
		{ value: 'witch' as CharacterId, label: 'Witch' },
		{ value: 'beggar' as CharacterId, label: 'Beggar' }
	];
	const TEMPLATE_LABELS: Record<CharacterTemplateName, string> = {
		row: 'Row',
		name: 'Name only',
		badge: 'Badge',
		entry: 'Entry'
	};

	let characterId = $state<CharacterId>('witch' as CharacterId);
	let template = $state<CharacterTemplateName>('row');
	let ability = $state(true);
	let player = $state(false);
	let fullWidth = $state(true);
	let text = $state(false);
	let marks = $state(false);
	let tag = $state(false);
	let controls = $state(false);
	let aside = $state(false);
	let chosen = $state(false);

	const ring = $derived(CHARACTER_TEMPLATES[template].shape === 'ring');
	const playerName = $derived(player ? ('Sam' as PlayerName) : undefined);
	const jinxes = $derived<Jinx[]>([
		{ characters: [characterId, 'alchemist' as CharacterId], reason: 'A sample jinx.' },
		{ characters: [characterId, 'marionette' as CharacterId], reason: 'A sample jinx.' }
	]);

	function pickTemplate(next: CharacterTemplateName) {
		template = next;
		ability = CHARACTER_TEMPLATES[next].ability;
		fullWidth = CHARACTER_TEMPLATES[next].fullWidth;
	}
</script>

<svelte:head>
	<title>Character piece · {APP_NAME}</title>
</svelte:head>

<PageMenuButton />

<main>
	<h1>Character piece</h1>
	<div class="playground">
		<div class="controls" role="group" aria-label="Character piece settings">
			<Select
				label="Character"
				value={characterId}
				options={CHARACTERS}
				onChange={(v) => (characterId = v)}
			/>
			<Select
				label="Template"
				value={template}
				options={CHARACTER_TEMPLATE_NAMES.map((value) => ({
					value,
					label: TEMPLATE_LABELS[value]
				}))}
				onChange={pickTemplate}
			/>
			<Toggle
				label="Ability"
				checked={ring && ability}
				disabled={!ring}
				onChange={(v) => (ability = v)}
			/>
			<Toggle label="Player name" checked={player} onChange={(v) => (player = v)} />
			<Toggle label="Full width" checked={fullWidth} onChange={(v) => (fullWidth = v)} />
			<Toggle
				label="Text under it"
				checked={text}
				disabled={!ring && template !== 'entry'}
				onChange={(v) => (text = v)}
			/>
			<Toggle label="Jinx marks" checked={marks} onChange={(v) => (marks = v)} />
			<Toggle label="Tag" checked={tag} onChange={(v) => (tag = v)} />
			<Toggle
				label="Controls"
				checked={controls}
				disabled={template === 'badge' || template === 'name'}
				onChange={(v) => (controls = v)}
			/>
			<Toggle
				label="Count beside it"
				checked={aside}
				disabled={!ring}
				onChange={(v) => (aside = v)}
			/>
			<Toggle label="Chosen" checked={chosen} disabled={!ring} onChange={(v) => (chosen = v)} />
		</div>
		<div class="stage" data-testid="character-stage">
			{#key `${template}-${characterId}`}
				<Character
					{template}
					{characterId}
					{playerName}
					{ability}
					{fullWidth}
					info
					pressed={ring && chosen ? true : undefined}
					onclick={ring && chosen ? () => {} : undefined}
					tags={tag ? tagSnippet : undefined}
					marks={marks ? marksSnippet : undefined}
					controls={controls ? controlsSnippet : undefined}
					aside={aside ? asideSnippet : undefined}
					children={text ? textSnippet : undefined}
				/>
			{/key}
			<p class="in-line">
				In a sentence: <Character template="badge" {characterId} {playerName} /> has chosen
				<Character
					template="badge"
					characterId={'washerwoman' as CharacterId}
					playerName={'Alex' as PlayerName}
				/>.
			</p>
		</div>
	</div>
</main>

{#snippet tagSnippet()}<span class="tag">Bluff</span>{/snippet}
{#snippet marksSnippet()}<JinxMark {characterId} {jinxes} />{/snippet}
{#snippet controlsSnippet()}<Button>Lock</Button>{/snippet}
{#snippet asideSnippet()}<CountBadge count={2} times />{/snippet}
{#snippet textSnippet()}<span>Chose the Librarian tonight.</span>{/snippet}

<style>
	main {
		max-width: calc(60 * var(--u));
		margin: 0 auto;
		padding: var(--space-4);
	}
	h1 {
		font-family: var(--font-heading);
	}
	.playground {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-4);
	}
	@media (min-width: 48rem) {
		.playground {
			grid-template-columns: minmax(0, 18rem) minmax(0, 1fr);
		}
	}
	.controls {
		display: grid;
		gap: var(--space-1);
		align-content: start;
	}
	.stage {
		display: grid;
		gap: var(--space-4);
		align-content: start;
		min-width: 0;
	}
	.in-line {
		line-height: 2;
	}
	.tag {
		flex: none;
		padding: 0 0.5em;
		border: 0.0625rem solid currentColor;
		border-radius: var(--radius-full);
		font-family: var(--font-control);
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1.3;
	}
</style>
