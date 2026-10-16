<script lang="ts" module>
	/** A seat the Storyteller can name on a card, e.g. with "This is the Demon". */
	export interface InfoTokenPlayer {
		id: string;
		/** The player's name, or "Seat N" when the seat has none. */
		label: string;
	}
</script>

<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import { STANDARD_INFO_TOKENS, type InfoToken } from '#lib/core/data/info-tokens.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import CharacterPicker from '#lib/features/show/CharacterPicker.svelte';
	import ShowToPlayer from '#lib/features/show/ShowToPlayer.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { plainText } from './bold.ts';
	import { MAX_CUSTOM_TEXT } from './custom-tokens.ts';
	import { customInfoTokens } from './custom-tokens.svelte.ts';
	import InfoTokenText from './InfoTokenText.svelte';

	interface Props {
		open?: boolean;
		/** Characters the Storyteller can show with a card, in script order. */
		characters: readonly Character[];
		/** Seats that can be named on a player card; none means the card is shown alone. */
		players?: readonly InfoTokenPlayer[];
	}

	let { open = $bindable(false), characters, players = [] }: Props = $props();

	/** "These characters are not in play" is shown with the 3 bluffs; the others with one. */
	const PICK_MAX: Record<string, number> = { 'not-in-play': 3 };

	type View =
		| { kind: 'list' }
		| { kind: 'characters'; token: InfoToken }
		| { kind: 'players'; token: InfoToken }
		| { kind: 'edit'; id?: string };

	let view = $state<View>({ kind: 'list' });
	let query = $state('');
	let pickedCharacters = $state<CharacterId[]>([]);
	let pickedPlayers = $state<string[]>([]);
	let draft = $state('');

	let showOpen = $state(false);
	let shown = $state<{ text: string; characterIds: CharacterId[]; players: string[] }>({
		text: '',
		characterIds: [],
		players: []
	});

	const byId = $derived(new Map(characters.map((c) => [c.id, c])));
	const shownCharacters = $derived(
		shown.characterIds.flatMap((id) => {
			const character = byId.get(id);
			return character ? [{ character }] : [];
		})
	);

	const needle = $derived(query.trim().toLowerCase());
	const matches = (token: InfoToken) =>
		needle === '' || plainText(token.text).toLowerCase().includes(needle);
	const standard = $derived(STANDARD_INFO_TOKENS.filter(matches));
	const custom = $derived(customInfoTokens.list.filter(matches));

	const title = $derived.by(() => {
		switch (view.kind) {
			case 'list':
				return 'Info tokens';
			case 'edit':
				return view.id ? 'Edit info token' : 'Add info token';
			default:
				return plainText(view.token.text);
		}
	});

	// Each time the sheet opens it starts at the list.
	$effect(() => {
		if (!open && !showOpen) view = { kind: 'list' };
	});

	function choose(token: InfoToken) {
		if (token.shows === 'characters') {
			pickedCharacters = [];
			view = { kind: 'characters', token };
		} else if (token.shows === 'player' && players.length > 0) {
			pickedPlayers = [];
			view = { kind: 'players', token };
		} else {
			show(token.text);
		}
	}

	function togglePlayer(id: string) {
		pickedPlayers = pickedPlayers.includes(id)
			? pickedPlayers.filter((p) => p !== id)
			: [...pickedPlayers, id];
	}

	function edit(token?: InfoToken) {
		draft = token?.text ?? '';
		view = { kind: 'edit', id: token?.id };
	}

	/**
	 * The player view opens on its own: the sheet closes first and comes back when the player
	 * view is closed, because the sheet hides everything outside it while open.
	 */
	function show(text: string, characterIds: CharacterId[] = [], seatIds: string[] = []) {
		const names = players.filter((p) => seatIds.includes(p.id)).map((p) => p.label);
		shown = { text, characterIds, players: names };
		view = { kind: 'list' };
		open = false;
		showOpen = true;
	}
</script>

<BottomSheet bind:open {title} height="85dvh" focusFirstField={false}>
	{#snippet actions()}
		<!-- Always drawn (disabled on the list) so the header never shifts. -->
		<span class="back">
			<IconButton
				icon="back"
				label="Back"
				disabled={view.kind === 'list'}
				onclick={() => (view = { kind: 'list' })}
			/>
		</span>
	{/snippet}
	<ErrorBoundary area="info-tokens">
		{#if view.kind === 'list'}
			<div class="search">
				<Icon name="search" />
				<input
					bind:value={query}
					type="search"
					aria-label="Search info tokens"
					placeholder="Search"
					autocomplete="off"
					enterkeyhint="search"
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							e.currentTarget.blur();
						}
					}}
				/>
				<button
					type="button"
					class="clear"
					aria-label="Clear search"
					disabled={query === ''}
					onclick={() => (query = '')}><Icon name="close" /></button
				>
			</div>

			<section aria-labelledby="sheet-standard">
				<h3 id="sheet-standard">Standard</h3>
				<ul class="cards">
					{#each standard as token (token.id)}
						<li>
							<button type="button" class="card" onclick={() => choose(token)}>
								{token.text}
							</button>
						</li>
					{:else}
						<li class="none">None</li>
					{/each}
				</ul>
			</section>

			<section aria-labelledby="sheet-custom">
				<div class="heading">
					<h3 id="sheet-custom">Custom</h3>
					<Button icon="add" variant="quiet" onclick={() => edit()}>Add info token</Button>
				</div>
				<ul class="cards">
					{#each custom as token (token.id)}
						<li class="custom">
							<button type="button" class="card" onclick={() => show(token.text)}>
								<InfoTokenText text={token.text} />
							</button>
							<IconButton
								icon="notes"
								label="Edit {plainText(token.text)}"
								onclick={() => edit(token)}
							/>
						</li>
					{:else}
						<li class="none">None</li>
					{/each}
				</ul>
			</section>
		{:else if view.kind === 'characters'}
			{@const token = view.token}
			<CharacterPicker
				{characters}
				bind:selected={pickedCharacters}
				max={PICK_MAX[token.id] ?? 1}
				label="Characters"
			/>
			<div class="sheet-actions">
				<Button variant="accent" icon="forward" onclick={() => show(token.text, pickedCharacters)}
					>Show</Button
				>
			</div>
		{:else if view.kind === 'players'}
			{@const token = view.token}
			<ul class="players" aria-label="Players">
				{#each players as player (player.id)}
					{@const chosen = pickedPlayers.includes(player.id)}
					<li>
						<button
							type="button"
							class="player"
							aria-pressed={chosen}
							onclick={() => togglePlayer(player.id)}
						>
							<span>{player.label}</span>
							<span class="tick" aria-hidden="true"><Icon name="check" /></span>
						</button>
					</li>
				{/each}
			</ul>
			<div class="sheet-actions">
				<Button variant="accent" icon="forward" onclick={() => show(token.text, [], pickedPlayers)}
					>Show</Button
				>
			</div>
		{:else}
			{@const id = view.id}
			<label class="field">
				<span>Text</span>
				<textarea
					bind:value={draft}
					maxlength={MAX_CUSTOM_TEXT}
					rows="3"
					aria-describedby="sheet-bold-hint"></textarea>
			</label>
			<p id="sheet-bold-hint" class="hint">Put **two stars** round words to make them bold.</p>
			<div class="sheet-actions">
				<Button
					variant="quiet"
					disabled={!id}
					onclick={() => {
						if (id) customInfoTokens.remove(id);
						view = { kind: 'list' };
					}}>Delete</Button
				>
				<Button
					variant="accent"
					disabled={!draft.trim()}
					onclick={() => {
						customInfoTokens.save(draft, id);
						view = { kind: 'list' };
					}}>Save</Button
				>
			</div>
		{/if}
	</ErrorBoundary>
</BottomSheet>

<ShowToPlayer
	bind:open={showOpen}
	title={shown.text}
	characters={shownCharacters}
	players={shown.players}
	onclose={() => (open = true)}
/>

<style>
	/* Lives in a sheet, so it follows the sheet's colours rather than the page's. */
	section + section {
		margin-top: var(--space-4);
	}
	h3 {
		margin: 0 0 var(--space-2);
		font-family: var(--font-heading);
		font-size: 1.1rem;
		color: inherit;
	}
	.back {
		display: contents;
		color: inherit;
	}
	.back :global(.icon-button) {
		color: inherit;
	}
	.heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin-bottom: var(--space-2);
	}
	.heading h3 {
		margin: 0;
	}
	.search {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		height: var(--tap-target);
		margin-bottom: var(--space-3);
		padding-inline-start: var(--space-2);
		border-radius: var(--radius-md);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 30%, transparent);
	}
	.search:focus-within {
		box-shadow: inset 0 0 0 2px var(--focus);
	}
	.search input {
		flex: 1;
		min-width: 0;
		height: 100%;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		outline: none;
	}
	.search input::-webkit-search-cancel-button {
		appearance: none;
	}
	.clear {
		display: grid;
		place-items: center;
		width: var(--tap-target);
		height: var(--tap-target);
		border: 0;
		background: none;
		color: inherit;
		cursor: pointer;
	}
	.clear:disabled {
		visibility: hidden;
	}
	.cards,
	.players {
		display: grid;
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
	.card,
	.player {
		flex: 1;
		display: flex;
		align-items: center;
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-2) var(--space-3);
		border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
		border-radius: var(--radius-md);
		background: none;
		color: inherit;
		font-family: var(--font-heading);
		font-size: 1.05rem;
		text-align: left;
		cursor: pointer;
	}
	.card:hover,
	.player:hover {
		background: color-mix(in srgb, currentColor 8%, transparent);
	}
	.player {
		justify-content: space-between;
	}
	.player[aria-pressed='true'] {
		border: 2px solid var(--accent);
	}
	/* The tick keeps its place, so choosing never moves the name. */
	.tick {
		visibility: hidden;
		color: var(--accent);
	}
	.player[aria-pressed='true'] .tick {
		visibility: visible;
	}
	.none {
		opacity: 0.7;
	}
	.sheet-actions {
		position: sticky;
		bottom: 0;
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
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
		border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
		border-radius: var(--radius-md);
		background: none;
		color: inherit;
		font: inherit;
		resize: vertical;
	}
	.hint {
		margin: var(--space-1) 0 0;
		font-size: 0.85rem;
		opacity: 0.8;
	}
</style>
