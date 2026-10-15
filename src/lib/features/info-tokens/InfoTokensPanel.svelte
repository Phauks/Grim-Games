<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import { STANDARD_INFO_TOKENS, type InfoToken } from '#lib/core/data/info-tokens.ts';
	import CharacterPicker from '#lib/features/show/CharacterPicker.svelte';
	import ShowToPlayer from '#lib/features/show/ShowToPlayer.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { plainText } from './bold.ts';
	import { MAX_CUSTOM_TEXT } from './custom-tokens.ts';
	import { customInfoTokens } from './custom-tokens.svelte.ts';
	import InfoTokenText from './InfoTokenText.svelte';

	interface Props {
		/** Characters the Storyteller can show with a card, in script order. */
		characters: readonly Character[];
	}

	let { characters }: Props = $props();

	/** "These characters are not in play" is shown with the 3 bluffs; the others with one. */
	const PICK_MAX: Record<string, number> = { 'not-in-play': 3 };

	let showOpen = $state(false);
	let shown = $state<{ text: string; characterIds: CharacterId[] }>({ text: '', characterIds: [] });
	let pickOpen = $state(false);
	let picking = $state<InfoToken>();
	let picked = $state<CharacterId[]>([]);
	let editOpen = $state(false);
	let editing = $state<{ id?: string; text: string }>({ text: '' });

	const byId = $derived(new Map(characters.map((c) => [c.id, c])));
	const shownCharacters = $derived(
		shown.characterIds.flatMap((id) => {
			const character = byId.get(id);
			return character ? [{ character }] : [];
		})
	);

	function show(text: string, characterIds: CharacterId[] = []) {
		shown = { text, characterIds };
		showOpen = true;
	}

	function choose(token: InfoToken) {
		if (token.shows !== 'characters') return show(token.text);
		picking = token;
		picked = [];
		pickOpen = true;
	}

	function edit(token?: InfoToken) {
		editing = { id: token?.id, text: token?.text ?? '' };
		editOpen = true;
	}
</script>

<section aria-labelledby="standard-cards">
	<h2 id="standard-cards">Standard</h2>
	<ul class="cards">
		{#each STANDARD_INFO_TOKENS as token (token.id)}
			<li>
				<button type="button" class="card" onclick={() => choose(token)}>
					<span class="text">{token.text}</span>
				</button>
			</li>
		{/each}
	</ul>
</section>

<section aria-labelledby="custom-cards">
	<div class="heading">
		<h2 id="custom-cards">Custom</h2>
		<Button icon="add" variant="quiet" onclick={() => edit()}>Add info token</Button>
	</div>
	<ul class="cards">
		{#each customInfoTokens.list as token (token.id)}
			<li class="custom">
				<button type="button" class="card" onclick={() => show(token.text)}>
					<span class="text"><InfoTokenText text={token.text} /></span>
				</button>
				<IconButton icon="notes" label="Edit {plainText(token.text)}" onclick={() => edit(token)} />
			</li>
		{:else}
			<li class="none">None</li>
		{/each}
	</ul>
</section>

<BottomSheet bind:open={pickOpen} title={picking?.text ?? ''} height="85dvh">
	{#if picking}
		<CharacterPicker
			{characters}
			bind:selected={picked}
			max={PICK_MAX[picking.id] ?? 1}
			label="Characters"
		/>
		<div class="sheet-actions">
			<Button
				variant="accent"
				icon="forward"
				onclick={() => {
					pickOpen = false;
					if (picking) show(picking.text, picked);
				}}>Show</Button
			>
		</div>
	{/if}
</BottomSheet>

<Dialog bind:open={editOpen} title={editing.id ? 'Edit info token' : 'Add info token'}>
	<label class="field">
		<span>Text</span>
		<textarea
			bind:value={editing.text}
			maxlength={MAX_CUSTOM_TEXT}
			rows="3"
			aria-describedby="bold-hint"></textarea>
	</label>
	<p id="bold-hint" class="hint">Put **two stars** round words to make them bold.</p>
	{#snippet actions()}
		{#if editing.id}
			<Button
				variant="quiet"
				onclick={() => {
					if (editing.id) customInfoTokens.remove(editing.id);
					editOpen = false;
				}}>Delete</Button
			>
		{/if}
		<Button
			variant="accent"
			disabled={!editing.text.trim()}
			onclick={() => {
				customInfoTokens.save(editing.text, editing.id);
				editOpen = false;
			}}>Save</Button
		>
	{/snippet}
</Dialog>

<ShowToPlayer bind:open={showOpen} title={shown.text} characters={shownCharacters} />

<style>
	section + section {
		margin-top: var(--space-5);
	}
	h2 {
		margin: 0 0 var(--space-2);
		font-family: var(--font-heading);
		font-size: 1.2rem;
		color: var(--heading);
	}
	.heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin-bottom: var(--space-2);
	}
	.heading h2 {
		margin: 0;
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(calc(12 * var(--u)), 1fr));
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.custom {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.card {
		flex: 1;
		display: flex;
		align-items: center;
		width: 100%;
		min-height: calc(3.5 * var(--u));
		padding: var(--space-2) var(--space-3);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
		color: inherit;
		font-family: var(--font-heading);
		font-size: 1.05rem;
		text-align: left;
		cursor: pointer;
	}
	.card:hover {
		background: var(--surface-selected);
	}
	.none {
		color: var(--on-surface-muted);
	}
	.sheet-actions {
		position: sticky;
		bottom: 0;
		display: flex;
		justify-content: flex-end;
		padding-top: var(--space-3);
		background: var(--sheet-background);
	}
	.field {
		display: grid;
		gap: var(--space-1);
	}
	textarea {
		width: 100%;
		padding: var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: inherit;
		font: inherit;
		resize: vertical;
	}
	.hint {
		margin: var(--space-1) 0 0;
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
</style>
