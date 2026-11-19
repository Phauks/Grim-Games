<script lang="ts">
	import NoneState from '#lib/ui/primitives/NoneState.svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import {
		loadScript,
		type Character,
		type CharacterId,
		type GameData,
		type LoadedScript
	} from '#lib/core/data/index.ts';
	import { typeTone } from '#lib/core/data/character-type.ts';
	import {
		photoScriptJson,
		readScriptLines,
		type PhotoLine,
		type PhotoLineTrace
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
	import ScanPicturesDialog, { type LineMark, type ScanPicture } from './ScanPicturesDialog.svelte';
	import ScriptNameFields from './ScriptNameFields.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { describeFile, failureText, importLog, logLine } from './import-log.svelte.ts';

	/**
	 * A script read from photos of its printed sheet (plan M54, Trevor picked layout 3A on
	 * 2026-11-05): what was found, by type, each row ticked to keep it; a close match marked
	 * "?"; a name the app doesn't know as a row to pick a character for. The script is what
	 * was read and kept, named from the sheet's title: never swapped for a script the device
	 * knows, since a sheet may differ slightly from it (Trevor, 2026-11-10).
	 */
	interface Props {
		open?: boolean;
		/** Called with the script to add, once Confirm is pressed. */
		onconfirm: (script: LoadedScript) => void;
		/** What looked wrong with a live scan's picture, each a reason to scan again. */
		issues?: readonly string[];
		/** Scans again, offered beside `issues`. */
		onrescan?: () => void;
	}

	let { open = $bindable(false), onconfirm, issues = [], onrescan }: Props = $props();

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
	let picturesOpen = $state(false);
	/** Each picture read, and which of `lines` it gave. */
	let read = $state.raw<(Omit<ScanPicture, 'marks'> & { from: number; count: number })[]>([]);
	/** The name, author and version as typed over what was read (Trevor, 2026-11-10). */
	let typed = $state<{ name?: string; author?: string; version?: string }>({});
	/**
	 * Names the app doesn't know become new custom characters, with the ability read beside
	 * them and the sheet's night order (Trevor, 2026-11-14, picked A: decided after the scan,
	 * from what was already read, so it never needs a rescan).
	 */
	let customOn = $state(false);

	const LEAVE_OUT = '';
	/** How each way a line was read is marked on its picture; blank lines are not. */
	const MARKS: Record<PhotoLineTrace['outcome'], LineMark | undefined> = {
		name: 'character',
		ability: 'character',
		close: 'close',
		title: 'title',
		author: 'title',
		unmatched: 'unknown',
		unnamed: 'unused',
		tail: 'unused',
		empty: undefined
	};

	/** The user's own scripts, whose custom characters a line may also name. */
	const own = $derived.by((): LoadedScript[] => {
		if (!data) return [];
		return recentScripts.list
			.filter((s) => !s.edition)
			.map((s) => reloadSavedScript(s, data!))
			.filter((s): s is LoadedScript => !!s);
	});

	/** Characters a line may name: every official one, and the custom ones on the user's scripts. */
	const pool = $derived.by((): Character[] => {
		if (!data) return [];
		const all = [...data.characters.filter((c) => c.edition), ...own.flatMap((s) => s.characters)];
		return all.filter((c, i) => all.findIndex((o) => o.id === c.id) === i);
	});

	const traces = $derived.by(() => {
		const all: PhotoLineTrace[] = [];
		readScriptLines(lines, pool, (t) => all.push(t));
		return all;
	});
	const result = $derived(readScriptLines(lines, pool));
	/** The pictures with each line read marked by how it was used. */
	const pictures = $derived(
		read.map(({ from, count, ...picture }) => ({
			...picture,
			marks: traces.flatMap((t) => {
				const box = lines[t.index]?.box;
				const mark = MARKS[t.outcome];
				return box && mark && t.index >= from && t.index < from + count
					? [{ box, mark, text: t.text }]
					: [];
			})
		}))
	);
	const name = $derived(typed.name ?? result.title);
	const author = $derived(typed.author ?? result.author);
	const version = $derived(typed.version ?? '');
	const kept = $derived(result.found.filter((f) => !left.has(f.character.id)));
	const customs = $derived(customOn ? result.customs.map((c) => c.character) : []);
	const customIds = $derived(new Set(customs.map((c) => c.id)));
	/** Unmatched lines with their place in `result.unmatched`, which picks are kept by. */
	const unmatched = $derived(
		result.unmatched
			.map((read, i) => ({ read, i }))
			.filter(({ read }) => !customOn || !result.customReads.includes(read))
	);
	const picked = $derived(
		unmatched.map(({ i }) => pool.find((c) => c.id === picks[i])).filter((c): c is Character => !!c)
	);
	const chosen = $derived.by(() => {
		const all = [
			...kept.map((f) => f.character),
			...customs.filter((c) => !left.has(c.id)),
			...picked
		];
		return all.filter((c, i) => all.findIndex((o) => o.id === c.id) === i);
	});
	const groups = $derived(groupByType([...result.found.map((f) => f.character), ...customs]));
	const closeCount = $derived(result.found.filter((f) => f.kind === 'close').length);
	const kinds = $derived(new Map(result.found.map((f) => [f.character.id, f.kind])));
	const pickOptions = $derived([
		{ value: LEAVE_OUT, label: t('scripts.photo.leaveOut') },
		...pool
			.filter((c) => !kinds.has(c.id))
			.toSorted((a, b) => a.name.localeCompare(b.name))
			.map((c) => ({ value: c.id as string, label: c.name }))
	]);

	/** Adds lines read by the live scan (Take a Photo) to what was read. */
	export async function addLines(
		read: readonly PhotoLine[],
		/** The picture they were read from, shown with each line marked. */
		picture?: HTMLCanvasElement,
		/** How the picture was taken, for the read log. */
		notes: readonly string[] = []
	): Promise<void> {
		if (lines.length === 0) importLog.start(`Scan: ${read.length} lines read`);
		else importLog.add(`Another scan: ${read.length} lines read`);
		for (const note of notes) importLog.add(note);
		data ??= await loadOfficialData();
		if (picture) await keepPicture(picture, read.length);
		lines = [...lines, ...read];
		logReading();
	}

	/**
	 * Keeps a picture read, to show with its lines marked (Trevor, 2026-11-15): the next
	 * `count` lines after those already read are its own.
	 */
	async function keepPicture(canvas: HTMLCanvasElement, count: number, from = lines.length) {
		const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.85));
		if (!blob) return;
		const { width, height } = canvas;
		read = [...read, { url: URL.createObjectURL(blob), width, height, from, count }];
	}

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
			const added: PhotoLine[] = [];
			for (const [i, page] of pages.entries()) {
				const share = (s: number) => (progress = Math.max(progress, (i + s) / pages.length));
				const started = Date.now();
				const pageLines =
					page.lines ?? (await readPhotoLines(page.canvas, share, (t) => importLog.add(t)));
				if (!page.lines) {
					const took = ((Date.now() - started) / 1000).toFixed(1);
					importLog.add(`Page ${i + 1}: ${pageLines.length} lines read in ${took}s`);
				}
				await keepPicture(page.canvas, pageLines.length, lines.length + added.length);
				added.push(...pageLines);
			}
			lines = [...lines, ...added];
			logReading();
		} catch (e) {
			failed = true;
			importLog.add(`Failed: ${failureText(e)}`, 'failed');
			reportError(e, { area: 'scripts', notify: false });
		} finally {
			reading = false;
		}
	}

	/** Logs how every line read so far was matched. */
	function logReading(): void {
		importLog.add(`Matching ${lines.length} lines against ${pool.length} characters`);
		const reading = readScriptLines(lines, pool, (l) => logLine(l, lines[l.index]?.confidence));
		const close = reading.found.filter((f) => f.kind === 'close').length;
		importLog.add(
			`Found ${reading.found.length} (${close} close), ${reading.unmatched.length} not matched, title "${reading.title}", author "${reading.author}"`
		);
		for (const c of reading.customs) {
			importLog.add(`Custom character if switched on: ${c.read}, ${c.character.type}`);
		}
		const night = reading.night;
		if (night) {
			importLog.add(
				`Night order read: first night ${night.first.join(', ') || 'none'}; other nights ${night.other.join(', ') || 'none'}`
			);
		}
	}

	/** Starts again with no photos read. */
	export function reset(): void {
		for (const p of read) URL.revokeObjectURL(p.url);
		read = [];
		lines = [];
		left.clear();
		picks = {};
		typed = {};
		customOn = false;
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
		const json = photoScriptJson(
			name.trim(),
			chosen,
			author.trim(),
			version.trim(),
			customOn ? result.night : undefined
		);
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
				: customOn
					? t('scripts.photo.summaryCustom', {
							found: result.found.length,
							check: closeCount,
							custom: customs.length,
							night: result.night ? t('scripts.photo.nightRead') : ''
						})
					: t('scripts.photo.summary', { found: result.found.length, check: closeCount })
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
		</div>
		<!-- What happened, step by step (Trevor, 2026-11-06), in a window of its own. -->
		<!-- The pictures with each line read marked (Trevor, 2026-11-15), in a window of their own. -->
		<IconButton
			icon="scanPictures"
			label={t('scripts.photo.pictures')}
			disabled={read.length === 0}
			onclick={() => (picturesOpen = true)}
		/>
		<IconButton
			icon="importLog"
			label={t('scripts.photo.log')}
			disabled={importLog.entries.length === 0}
			onclick={() => (logOpen = true)}
		/>
	</div>
	{#if issues.length}
		<div class="issues" role="alert" data-testid="live-scan-issues">
			<ul>
				{#each issues as issue (issue)}<li>{issue}</li>{/each}
			</ul>
			{#if onrescan}<Button onclick={onrescan}>{t('scripts.photo.rescan')}</Button>{/if}
		</div>
	{/if}
	<div class="details">
		<ScriptNameFields
			{name}
			{author}
			{version}
			disabled={reading}
			onName={(v) => (typed = { ...typed, name: v })}
			onAuthor={(v) => (typed = { ...typed, author: v })}
			onVersion={(v) => (typed = { ...typed, version: v })}
		/>
		<Toggle
			label={t('scripts.photo.custom')}
			checked={customOn}
			disabled={reading}
			onChange={(on) => (customOn = on)}
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
							ability={customIds.has(c.id)}
							withCheck
							checked={!left.has(c.id)}
							onclick={() => toggle(c.id)}
						>
							{#snippet marks()}
								{#if customIds.has(c.id)}<span
										class="check"
										title={t('scripts.photo.newTitle')}
										data-testid="new-mark">{t('scripts.photo.new')}</span
									>{/if}
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
		{#if unmatched.length}
			<ul class="unmatched">
				{#each unmatched as { read, i } (i)}
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
			<NoneState />
		{/if}
	</section>
	{#snippet actions()}
		<ModalActions
			onCancel={() => (open = false)}
			onConfirm={confirm}
			disabled={reading || chosen.length === 0}
			confirmLabel={t('scripts.picker.add')}
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
<ScanPicturesDialog bind:open={picturesOpen} {pictures} />

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
	.details {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-3);
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
	.issues {
		margin-top: var(--space-3);
		padding: var(--space-2) var(--space-3);
		border: calc(0.125 * var(--u)) solid var(--evil);
		border-radius: var(--radius-md);
	}
	.issues ul {
		margin: 0 0 var(--space-2);
		padding-inline-start: var(--space-4);
	}
</style>
