<script lang="ts" module>
	import type { LineBox } from '#lib/core/photo/script-photo.ts';

	/** How a line read was used, which sets its mark's look. */
	export type LineMark = 'character' | 'close' | 'title' | 'unknown' | 'unused';

	/** One picture read, with each line read marked where it sits. */
	export interface ScanPicture {
		/** An object URL of the picture as it was read. */
		url: string;
		width: number;
		height: number;
		marks: { box: LineBox; mark: LineMark; text: string }[];
	}
</script>

<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	/**
	 * The pictures a script was read from, each read line outlined on them (Trevor, 2026-11-15:
	 * "show the picture to the users, so that they can see what issues may arise"). A window of
	 * its own, opened from the review, so the review never moves.
	 */
	interface Props {
		open?: boolean;
		pictures: readonly ScanPicture[];
	}

	let { open = $bindable(false), pictures }: Props = $props();

	const KEY: readonly LineMark[] = ['character', 'close', 'title', 'unknown', 'unused'];
</script>

<Dialog bind:open title={t('scripts.photo.picturesTitle')} size="full">
	<ul class="key" aria-label={t('scripts.photo.picturesKey')}>
		{#each KEY as mark (mark)}
			<li><span class="swatch" data-mark={mark}></span>{t(`scripts.photo.mark.${mark}`)}</li>
		{/each}
	</ul>
	{#each pictures as picture, i (picture.url)}
		<figure data-testid="scan-picture">
			<div class="frame" style:aspect-ratio="{picture.width} / {picture.height}">
				<img src={picture.url} alt={t('scripts.photo.pictureAlt', { n: i + 1 })} />
				<svg viewBox="0 0 {picture.width} {picture.height}" aria-hidden="true">
					{#each picture.marks as m, j (j)}
						<rect
							data-mark={m.mark}
							x={m.box.x0}
							y={m.box.y0}
							width={m.box.x1 - m.box.x0}
							height={m.box.y1 - m.box.y0}
							vector-effect="non-scaling-stroke"
						>
							<title>{m.text}</title>
						</rect>
					{/each}
				</svg>
			</div>
		</figure>
	{:else}
		<p class="none">{t('common.none')}</p>
	{/each}
</Dialog>

<style>
	.key {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-3);
		margin: 0 0 var(--space-2);
		padding: 0;
		list-style: none;
		font-size: 0.85rem;
	}
	.key li {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.swatch {
		width: 1.2em;
		height: 0.8em;
		border: 0.15em solid var(--mark);
		/* On paper, as the marks are on the sheet. */
		background: var(--print-paper);
		border-radius: var(--radius-sm);
	}
	.swatch[data-mark='unused'] {
		border-style: dashed;
	}
	figure {
		margin: 0 0 var(--space-3);
	}
	.frame {
		position: relative;
		width: 100%;
	}
	img,
	svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	img {
		border-radius: var(--radius-md);
	}
	rect {
		fill: none;
		stroke: var(--mark);
		stroke-width: 0.1rem;
	}
	rect[data-mark='unused'] {
		stroke-dasharray: 0.3rem 0.2rem;
	}
	[data-mark='character'] {
		--mark: var(--good);
	}
	/* The fixed team and rule colours, the same in every theme, so the key always matches. */
	[data-mark='close'] {
		--mark: var(--count-warn);
	}
	[data-mark='title'] {
		--mark: var(--loric);
	}
	[data-mark='unknown'] {
		--mark: var(--evil);
	}
	[data-mark='unused'] {
		--mark: var(--fabled);
	}
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
