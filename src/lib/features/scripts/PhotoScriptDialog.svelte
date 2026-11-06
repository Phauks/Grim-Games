<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import {
		editionScript,
		loadScript,
		OFFICIAL_EDITIONS,
		type Character,
		type CharacterId,
		type GameData,
		type LoadedScript
	} from '#lib/core/data/index.ts';
	import { typeTone } from '#lib/core/data/character-type.ts';
	import {
		knownScriptFor,
		photoScriptJson,
		readScriptLines,
		SAME_SCRIPT,
		type KnownScript,
		type PhotoLine
	} from '#lib/core/photo/script-photo.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Combobox from '#lib/ui/primitives/Combobox.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { groupByType } from '#lib/features/player/player-script.ts';
	import { recentScripts } from './current-script.svelte.ts';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { readQrCodes } from '#lib/ui/share/qr-reader.ts';
	import { photoCanvas, readPhotoLines } from './photo-reader.ts';
	import { isPdf, readPdfPages, type PdfPage } from './pdf-reader.ts';
	import { PHOTO_ACCEPT } from './photo-accept.ts';
	import { scannedScriptHash } from './share.ts';
	import { reloadSavedScript } from './saved-scripts.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ImportLogDialog from './ImportLogDialog.svelte';
	import { describeFile, failureText, importLog, logLine } from './import-log.svelte.ts';

	/**
	 * A script read from photos of its printed sheet (plan M54, Trevor picked layout 3A on
	 * 2026-11-05): what was found, by type, each row ticked to keep it; a close match marked
	 * "?"; a name the app doesn't know as a row to pick a character for. When the characters
	 * are a script the device already knows, that script loads, custom characters and all.
	 */
	interface Props {
		open?: boolean;
		/** Called with the script to add, once Confirm is pressed. */
		onconfirm: (script: LoadedScript) => void;
	}

	let { open = $bindable(false), onconfirm }: Props = $props();

	let lines = $state.raw<PhotoLine[]>([]);
	let reading = $state(false);
	let progress = $state(0);
	let failed = $state(false);
	let data = $state.raw<GameData>();
	/** Rows the user unticked. */
	const left = new SvelteSet<CharacterId>();
	/** The character picked for each unmatched name, by its place in the list. */
	let picks = $state<Record<number, string>>({});
	let fileInput: HTMLInputElement | undefined = $state();
	let logOpen = $state(false);

	const LEAVE_OUT = '';

	/** Scripts the photo may be: the official editions, then the user's own. */
	const known = $derived.by((): KnownScript<LoadedScript>[] => {
		if (!data) return [];
		const editions = OFFICIAL_EDITIONS.map((e) => editionScript(e.id, data!)!);
		const own = recentScripts.list
			.filter((s) => !s.edition)
			.map((s) => reloadSavedScript(s, data!))
			.filter((s): s is LoadedScript => !!s && s.name !== '');
		return [...editions, ...own].map((script) => ({
			key: script,
			name: script.name,
			characters: script.characters.map((c) => c.id)
		}));
	});

	/** Characters a line may name: every official one, and the custom ones on the user's scripts. */
	const pool = $derived.by((): Character[] => {
		if (!data) return [];
		const all = [
			...data.characters.filter((c) => c.edition),
			...known.flatMap((k) => k.key.characters)
		];
		return all.filter((c, i) => all.findIndex((o) => o.id === c.id) === i);
	});

	const result = $derived(readScriptLines(lines, pool));
	const kept = $derived(result.found.filter((f) => !left.has(f.character.id)));
	const picked = $derived(
		result.unmatched
			.map((_, i) => pool.find((c) => c.id === picks[i]))
			.filter((c): c is Character => !!c)
	);
	const chosen = $derived.by(() => {
		const all = [...kept.map((f) => f.character), ...picked];
		return all.filter((c, i) => all.findIndex((o) => o.id === c.id) === i);
	});
	const match = $derived(
		knownScriptFor(
			chosen.map((c) => c.id),
			result.title,
			known
		)
	);
	const groups = $derived(groupByType(result.found.map((f) => f.character)));
	const closeCount = $derived(result.found.filter((f) => f.kind === 'close').length);
	const kinds = $derived(new Map(result.found.map((f) => [f.character.id, f.kind])));
	const pickOptions = $derived([
		{ value: LEAVE_OUT, label: t('scripts.photo.leaveOut') },
		...pool
			.filter((c) => !kinds.has(c.id))
			.toSorted((a, b) => a.name.localeCompare(b.name))
			.map((c) => ({ value: c.id as string, label: c.name }))
	]);

	/**
	 * Reads one more photo, or a PDF of the sheet, and adds its lines to what was read. A PDF's
	 * own text is used as it is; a scanned page is read like a photo.
	 */
	export async function addPhoto(photo: Blob): Promise<void> {
		reading = true;
		failed = false;
		progress = 0;
		const pdf = isPdf(photo);
		const received = `${pdf ? 'PDF' : 'Photo'} received: ${describeFile(photo)}`;
		if (lines.length === 0) importLog.start(received);
		else importLog.add(`Another ${received[0].toLowerCase()}${received.slice(1)}`);
		try {
			data ??= await loadOfficialData();
			const pages: PdfPage[] = pdf
				? await readPdfPages(photo)
				: [{ canvas: await photoCanvas(photo) }];
			if (pdf) {
				importLog.add(`PDF: ${pages.length} page(s) read`);
				pages.forEach((p, i) =>
					importLog.add(
						p.lines
							? `Page ${i + 1}: its own text, ${p.lines.length} lines`
							: `Page ${i + 1}: no text of its own, read as a scan`
					)
				);
			} else {
				const { width, height } = pages[0].canvas;
				importLog.add(`Photo drawn at ${width} by ${height} for reading`);
			}
			// A sheet carrying its script's QR code loads that exact script (plan M56's sheets).
			for (const [i, page] of pages.entries()) {
				const codes = await readQrCodes(page.canvas).catch((e: unknown) => {
					importLog.add(`QR codes on page ${i + 1} could not be read: ${failureText(e)}`, 'failed');
					return [];
				});
				const hash = codes.map(scannedScriptHash).find((h) => h !== undefined);
				importLog.add(
					hash
						? `QR code on page ${i + 1} is a script link: loading it`
						: codes.length
							? `${codes.length} QR code(s) on page ${i + 1}, none a script link`
							: `No QR code on page ${i + 1}`
				);
				if (!hash) continue;
				open = false;
				// The script travels in the hash, which never reaches the server; the path is resolved.
				// eslint-disable-next-line svelte/no-navigation-without-resolve
				await goto(`${resolve('/play')}${hash}`);
				return;
			}
			const read: PhotoLine[] = [];
			for (const [i, page] of pages.entries()) {
				const share = (s: number) => (progress = Math.max(progress, (i + s) / pages.length));
				const started = Date.now();
				const pageLines =
					page.lines ?? (await readPhotoLines(page.canvas, share, (t) => importLog.add(t)));
				if (!page.lines) {
					const took = ((Date.now() - started) / 1000).toFixed(1);
					importLog.add(`Page ${i + 1}: ${pageLines.length} lines read in ${took}s`);
				}
				read.push(...pageLines);
			}
			lines = [...lines, ...read];
			logReading();
		} catch (e) {
			failed = true;
			importLog.add(`Failed: ${failureText(e)}`, 'failed');
			reportError(e, { area: 'scripts', notify: false });
		} finally {
			reading = false;
		}
	}

	/** Logs how every line read so far was matched, and the script the sheet looks like. */
	function logReading(): void {
		importLog.add(`Matching ${lines.length} lines against ${pool.length} characters`);
		const reading = readScriptLines(lines, pool, (l) => logLine(l, lines[l.index]?.confidence));
		const close = reading.found.filter((f) => f.kind === 'close').length;
		importLog.add(
			`Found ${reading.found.length} (${close} close), ${reading.unmatched.length} not matched, title "${reading.title}", author "${reading.author}"`
		);
		const ids = reading.found.map((f) => f.character.id);
		const same = knownScriptFor(ids, reading.title, known);
		importLog.add(
			same
				? `Looks like ${same.name}`
				: `No known script holds all of them with ${Math.round(SAME_SCRIPT * 100)}% read`
		);
	}

	/** Starts again with no photos read. */
	export function reset(): void {
		lines = [];
		left.clear();
		picks = {};
		failed = false;
	}

	function toggle(id: CharacterId) {
		if (left.has(id)) left.delete(id);
		else left.add(id);
	}

	function onFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (file) void addPhoto(file);
	}

	function confirm() {
		if (!data) return;
		open = false;
		if (match) {
			importLog.add(`Confirmed: loading ${match.name}`);
			onconfirm(match.key);
			return;
		}
		const name = result.title;
		const json = photoScriptJson(name, chosen, result.author);
		const loaded = loadScript(json, data);
		importLog.add(
			`Confirmed: "${name}" with ${chosen.length} characters, ${loaded.problems.length} problem(s)`
		);
		for (const p of loaded.problems) {
			importLog.add(`${p.where}: ${p.message}`, p.severity === 'error' ? 'failed' : 'step');
		}
		if (loaded.script) onconfirm(loaded.script);
	}

	const heading = $derived(
		reading
			? t('scripts.photo.reading', { percent: Math.round(progress * 100) })
			: failed
				? t('scripts.photo.failed')
				: match
					? t('scripts.photo.looksLike', { name: match.name })
					: result.author
						? t('scripts.photo.titleBy', {
								title: result.title || t('common.none'),
								author: result.author
							})
						: result.title || t('common.none')
	);
	const summary = $derived(
		t('scripts.photo.summary', { found: result.found.length, check: closeCount })
	);
</script>

<Dialog bind:open title={t('scripts.photo.title')}>
	<input
		bind:this={fileInput}
		class="file"
		type="file"
		accept={PHOTO_ACCEPT}
		aria-label={t('scripts.photo.another')}
		onchange={onFile}
	/>
	<div class="banner" data-testid="photo-banner">
		<div class="said" aria-live="polite">
			<p class="name">{heading}</p>
			<p class="summary">{summary}</p>
		</div>
		<!-- What happened, step by step (Trevor, 2026-11-06), in a window of its own. -->
		<IconButton
			icon="importLog"
			label={t('scripts.photo.log')}
			disabled={importLog.entries.length === 0}
			onclick={() => (logOpen = true)}
		/>
	</div>
	{#each groups as group (group.type)}
		<section>
			<h3 data-type-band={typeTone(group.type)}>{TYPE_PLURALS[group.type]}</h3>
			<ul>
				{#each group.characters as c (c.id)}
					<li data-character={c.id}>
						<CharacterPiece
							template="name"
							character={c}
							withCheck
							checked={!left.has(c.id)}
							onclick={() => toggle(c.id)}
						>
							{#snippet marks()}
								{#if kinds.get(c.id) === 'close'}<span
										class="check"
										title={t('scripts.photo.closeMark')}
										data-testid="close-mark">?</span
									>{/if}
							{/snippet}
						</CharacterPiece>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
	<section>
		<h3 data-type-band="outline">{t('scripts.photo.unmatched')}</h3>
		{#if result.unmatched.length}
			<ul class="unmatched">
				{#each result.unmatched as read, i (i)}
					<li>
						<Combobox
							label={t('scripts.photo.read', { text: read })}
							value={picks[i] ?? LEAVE_OUT}
							options={pickOptions}
							empty={t('common.none')}
							onChange={(v: string) => (picks = { ...picks, [i]: v })}
							testid="photo-pick"
						/>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="none">{t('common.none')}</p>
		{/if}
	</section>
	{#snippet actions()}
		<ModalActions
			onCancel={() => (open = false)}
			onConfirm={confirm}
			disabled={reading || chosen.length === 0}
			confirmLabel={match ? t('scripts.photo.load', { name: match.name }) : t('scripts.picker.add')}
		>
			{#snippet start()}
				<Button variant="quiet" icon="photo" disabled={reading} onclick={() => fileInput?.click()}
					>{t('scripts.photo.another')}</Button
				>
			{/snippet}
		</ModalActions>
	{/snippet}
</Dialog>

<ImportLogDialog bind:open={logOpen} />

<style>
	.file {
		position: absolute;
		width: 1px; /* px-ok: an offscreen file input, as Add script's */
		height: 1px; /* px-ok: an offscreen file input, as Add script's */
		opacity: 0;
		pointer-events: none;
	}
	.banner {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
	}
	.said {
		flex: 1;
		min-width: 0;
	}
	.banner p {
		margin: 0;
	}
	.name {
		font-weight: 700;
	}
	.summary {
		color: var(--on-surface-muted);
	}
	h3 {
		margin: var(--space-3) 0 var(--space-1);
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-md);
		background: var(--type-band);
		box-shadow: var(--type-band-ring, none);
		color: var(--on-type-band);
		font-size: 0.9rem;
	}
	ul {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.check {
		display: inline-grid;
		place-items: center;
		min-width: 1.4em;
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: var(--on-accent);
		font-weight: 800;
	}
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
