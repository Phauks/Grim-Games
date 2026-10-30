/**
 * Turns stack frames in the build's minified files (`/_app/immutable/chunks/SwMh2NRa.js:1:2468`)
 * back into the source they came from (`src/lib/features/grimoire/Board.svelte:120:5`), so a
 * report names the file, line and function that failed (Trevor, 2026-10-30: "those chunk values
 * are impossible to understand").
 *
 * The build writes a hidden source map beside each file (vite.config.ts `build.sourcemap`): the
 * files carry no `sourceMappingURL`, so browsers never download them, and the maps hold only
 * names and positions, not the source text. The device that saw a problem is running the build
 * that threw it, so it fetches that build's maps from its own origin. A map it can't get (offline,
 * or a build the server no longer has) leaves those frames as they were.
 */
import type { TraceMap } from '@jridgewell/trace-mapping';
import { fetchJson } from '#lib/ui/fetch.ts';

/** A frame's position in one of the build's own files, as `scrubUrls` leaves it. */
const BUILT_FRAME = /(\/_app\/immutable\/[^\s:()'"]+\.js):(\d+):(\d+)/;

/** Chrome's `at name (place)` or `at place`; Firefox and Safari's `name@place`. */
const CHROME_FRAME = /^at (?:(.+?) \()?(.+?)\)?$/;
const OTHER_FRAME = /^(.*?)@(.+)$/;

interface Frame {
	name?: string;
	file: string;
	line: number;
	column: number;
}

/** Where a built position came from: a source path, its line and column, and the name there. */
export interface SourcePosition {
	source: string;
	line: number;
	column: number;
	name?: string;
}

/** The source position of `line` (1-based) and `column` (0-based) in a built file, if mapped. */
export type Locate = (file: string, line: number, column: number) => SourcePosition | undefined;

function parseFrame(text: string): Frame | undefined {
	const match = CHROME_FRAME.exec(text) ?? OTHER_FRAME.exec(text);
	const place = match ? match[2] : text;
	const built = place && BUILT_FRAME.exec(place);
	if (!built) return undefined;
	return {
		...(match?.[1] ? { name: match[1] } : {}),
		file: built[1],
		line: Number(built[2]),
		// Stack columns count from 1, source map columns from 0.
		column: Number(built[3]) - 1
	};
}

/**
 * A source path as the map names it (`../../../src/lib/x.ts`, `../../../node_modules/svelte/...`),
 * from the project folder down.
 */
export function sourcePath(source: string): string {
	const path = source.replace(/^[a-z]+:\/\//i, '').replace(/\\/g, '/');
	const from = path.search(/(?:^|\/)(?:src|node_modules)\//);
	return from > 0 ? path.slice(from + 1) : path.replace(/^(?:\.\.?\/)+/, '');
}

/** The built files `stack` has frames in, so their maps can be fetched first. */
export function builtFiles(stack: string): string[] {
	const files = new Set<string>();
	for (const line of stack.split('\n')) {
		const frame = parseFrame(line.trim());
		if (frame) files.add(frame.file);
	}
	return [...files];
}

/**
 * `stack` with every frame `locate` can place rewritten as `at name (source:line:column)`.
 * A frame's own function name is the name its caller's frame maps to (the identifier called
 * there), since a minified frame names only the minified function; the outermost frame keeps
 * no name. Frames `locate` can't place, and lines that aren't frames, stay as they were.
 */
export function resolveStack(stack: string, locate: Locate): string {
	const lines = stack.split('\n');
	const frames = lines.map((line) => parseFrame(line.trim()));
	const found = frames.map((frame) =>
		frame ? locate(frame.file, frame.line, frame.column) : undefined
	);
	return lines
		.map((line, i) => {
			const at = found[i];
			if (!at) return line;
			const name = found[i + 1]?.name;
			const place = `${sourcePath(at.source)}:${at.line}:${at.column + 1}`;
			return name ? `at ${name} (${place})` : `at ${place}`;
		})
		.join('\n');
}

/** True when `stack` still has frames in built files, which a later try may resolve. */
export function hasBuiltFrames(stack: string | undefined): boolean {
	return !!stack && builtFiles(stack).length > 0;
}

/** Maps fetched this visit, by built file; `null` when a file has none to fetch. */
const maps = new Map<string, Promise<TraceMap | null>>();

async function loadMap(file: string): Promise<TraceMap | null> {
	try {
		// An address the server doesn't have can come back as the app's own page, not JSON.
		const { response, body: raw } = await fetchJson(`${file}.map`);
		if (!response.ok || !raw || typeof raw !== 'object' || !('mappings' in raw)) return null;
		const { TraceMap } = await import('@jridgewell/trace-mapping');
		return new TraceMap(raw as ConstructorParameters<typeof TraceMap>[0]);
	} catch {
		return null;
	}
}

/**
 * `stack` resolved against this build's source maps, fetched once per file each visit. Gives
 * `stack` back unchanged when nothing could be resolved, and never throws.
 */
export async function resolveBuiltStack(stack: string): Promise<string> {
	try {
		const files = builtFiles(stack);
		if (files.length === 0) return stack;
		for (const file of files) {
			// A map that failed (offline) is tried again on a later call.
			if (!maps.has(file))
				maps.set(
					file,
					loadMap(file).then((map) => {
						if (!map) maps.delete(file);
						return map;
					})
				);
		}
		const loaded = new Map<string, TraceMap>();
		for (const file of files) {
			const map = await maps.get(file);
			if (map) loaded.set(file, map);
		}
		if (loaded.size === 0) return stack;
		const { originalPositionFor } = await import('@jridgewell/trace-mapping');
		return resolveStack(stack, (file, line, column) => {
			const map = loaded.get(file);
			if (!map) return undefined;
			const at = originalPositionFor(map, { line, column });
			if (at.source === null || at.line === null || at.column === null) return undefined;
			return {
				source: at.source,
				line: at.line,
				column: at.column,
				...(at.name ? { name: at.name } : {})
			};
		});
	} catch {
		return stack;
	}
}
