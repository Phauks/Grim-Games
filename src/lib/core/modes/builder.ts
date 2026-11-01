/**
 * The Mode builder's form, drawn from the format guide itself (Trevor, 2026-10-31: "an
 * interactive mode creator that automatically builds and updates depending upon the actual
 * framework of the modes"; he picked a form built from the guide). Every part, kind and field
 * the guide lists (mode-guide.ts, rule-guide.ts) becomes a control here, so a part or field
 * added to the format, which `format-guide.test.ts` makes the guide describe, appears in the
 * builder with no further work. A field whose shape has no control of its own is edited as
 * JSON, so nothing in the format is ever out of reach.
 */
import { CITE, GAME_MODE_REVISION, IDS, INSTRUCTIONS, TYPES } from './guide-fields.ts';
import type { GuideField, GuidePart } from './guide-fields.ts';
import { GUIDE_PARTS, GUIDE_TOP } from './mode-guide.ts';
import { RULE_GUIDE_PARTS, RULE_GUIDE_TOP } from './rule-guide.ts';
import { GAME_MODE_FORMAT, SPECIAL_RULE_FORMAT, STACKING_PARTS } from './types.ts';

/** What the builder makes: a game mode, or a special rule that stacks on one. */
export type BuildKind = 'game-mode' | 'special-rule';

/** How a field is edited, read from the guide's description of its type. */
export type FieldControl =
	| { kind: 'text' }
	| { kind: 'choice'; values: readonly string[] }
	| { kind: 'whole' }
	| { kind: 'boolean' }
	| { kind: 'texts' }
	| { kind: 'numbers' }
	| { kind: 'choices'; values: readonly string[] }
	| { kind: 'characters' }
	| { kind: 'links' }
	| { kind: 'link' }
	| { kind: 'counts' }
	| { kind: 'range' }
	| { kind: 'json' };

/** The guide's type wordings with a control of their own; any other is edited as JSON. */
const CONTROLS: Record<string, (field: GuideField) => FieldControl> = {
	text: (f) => (f.values?.length ? { kind: 'choice', values: f.values } : { kind: 'text' }),
	number: () => ({ kind: 'whole' }),
	'whole number': () => ({ kind: 'whole' }),
	'true or false': () => ({ kind: 'boolean' }),
	'list of text': () => ({ kind: 'texts' }),
	'list of whole numbers': () => ({ kind: 'numbers' }),
	'list of character types': (f) => ({ kind: 'choices', values: f.values ?? TYPES }),
	'list of part names': (f) => ({ kind: 'choices', values: f.values ?? [] }),
	[IDS]: () => ({ kind: 'characters' }),
	'list of links': () => ({ kind: 'links' }),
	'https link': () => ({ kind: 'link' }),
	'object of counts by type': () => ({ kind: 'counts' }),
	'object { "min", "max" }': () => ({ kind: 'range' })
};

/**
 * Type wordings edited as JSON on purpose: shapes too rare to need a control yet. A wording
 * in neither list fails `builder.test.ts`, so a new one is a choice, never an accident.
 */
export const JSON_TYPES: ReadonlySet<string> = new Set([
	'object',
	'{ afterDay, together, winner }',
	'list of { characterId, type }',
	'list of lists of character ids'
]);

export function fieldControl(field: GuideField): FieldControl {
	return CONTROLS[field.type]?.(field) ?? { kind: 'json' };
}

/** Whether the guide's type wording has a control (or is knowingly JSON). */
export function knownType(type: string): boolean {
	return type in CONTROLS || JSON_TYPES.has(type);
}

/** Top-level fields the builder fills in itself: the kind, format, revision and parts. */
const AUTOMATIC = new Set(['kind', 'format', 'revision', 'parts']);

/** The file's own fields (id, name, sources and the rest), as the guide lists them. */
export function topFields(kind: BuildKind): GuideField[] {
	return (kind === 'game-mode' ? GUIDE_TOP : RULE_GUIDE_TOP).filter((f) => !AUTOMATIC.has(f.name));
}

/** The parts a file of this kind may set: a rule's own, then the mode parts it may stack. */
export function buildParts(kind: BuildKind): GuidePart[] {
	if (kind === 'game-mode') return GUIDE_PARTS;
	const stacking: readonly string[] = STACKING_PARTS;
	return [...RULE_GUIDE_PARTS, ...GUIDE_PARTS.filter((p) => stacking.includes(p.part))];
}

/** A part whose items are plain lines (a rule's `text`): no fields and no kinds. */
export function isLinesPart(part: GuidePart): boolean {
	return part.list && part.fields.length === 0 && part.kinds.length === 0;
}

/** The fields of one part, or one item of a list part, of the chosen kind. */
export function partFields(part: GuidePart, kind: string | undefined): GuideField[] {
	const own = part.kinds.find((k) => k.kind === kind)?.fields ?? [];
	return [...part.fields, ...own, CITE, INSTRUCTIONS];
}

/** A new, empty file of this kind: nothing but what every file needs. */
export function emptyFile(kind: BuildKind): Record<string, unknown> {
	return {
		...(kind === 'special-rule' ? { kind } : {}),
		format: kind === 'game-mode' ? GAME_MODE_FORMAT : SPECIAL_RULE_FORMAT,
		revision: GAME_MODE_REVISION,
		id: '',
		name: '',
		sources: [],
		parts: {}
	};
}

/** What a file is, from its own `kind`. */
export function buildKindOf(file: Record<string, unknown>): BuildKind {
	return file.kind === 'special-rule' ? 'special-rule' : 'game-mode';
}

/** A new part or list item: its first kind, or no fields at all. */
export function newPartValue(part: GuidePart): unknown {
	if (isLinesPart(part)) return '';
	return part.kinds.length ? { kind: part.kinds[0].kind } : {};
}

export type Path = readonly (string | number)[];

/** The path as validate.ts writes it in a problem: `parts.nightSteps[0].when`. */
export function pathText(path: Path): string {
	return path.reduce<string>(
		(text, key) =>
			typeof key === 'number' ? `${text}[${key}]` : text ? `${text}.${key}` : String(key),
		''
	);
}

/**
 * The value with `value` set at `path`, copying only what changes; `undefined` removes the
 * key (an optional field left empty is left out of the file).
 */
export function setAt(target: unknown, path: Path, value: unknown): unknown {
	if (path.length === 0) return value;
	const [key, ...rest] = path;
	if (typeof key === 'number') {
		const list = Array.isArray(target) ? [...target] : [];
		const next = setAt(list[key], rest, value);
		if (next === undefined && rest.length === 0) list.splice(key, 1);
		else list[key] = next;
		return list;
	}
	const object: Record<string, unknown> =
		typeof target === 'object' && target !== null && !Array.isArray(target)
			? { ...(target as Record<string, unknown>) }
			: {};
	const next = setAt(object[key], rest, value);
	if (next === undefined) delete object[key];
	else object[key] = next;
	return object;
}

/** A problem line split into where it is and what is wrong. */
export function splitIssue(issue: string): { path: string; message: string } {
	const at = issue.indexOf(': ');
	return at < 0
		? { path: '', message: issue }
		: { path: issue.slice(0, at), message: issue.slice(at + 2) };
}

/** The problems at a field, or anywhere inside it (a list's rows, an object's keys). */
export function issuesAt(issues: readonly string[], path: Path): string[] {
	const here = pathText(path);
	return issues.flatMap((issue) => {
		const { path: at, message } = splitIssue(issue);
		return at === here || at.startsWith(`${here}.`) || at.startsWith(`${here}[`)
			? [at === here ? message : `${at.slice(here.length).replace(/^\./, '')}: ${message}`]
			: [];
	});
}

/**
 * A part's Source and Storyteller instructions: on every part, but set on few, so the builder
 * adds them per part from its header rather than as a row on each (Trevor, 2026-11-01: "find a
 * better way to make it so it can be added per rule change").
 */
export const PART_NOTES: readonly GuideField[] = [CITE, INSTRUCTIONS];
const NOTE_NAMES: ReadonlySet<string> = new Set(PART_NOTES.map((f) => f.name));

/** The fields of one part, or one list item, less its Source and Storyteller instructions. */
export function ownPartFields(part: GuidePart, kind: string | undefined): GuideField[] {
	return partFields(part, kind).filter((f) => !NOTE_NAMES.has(f.name));
}

/**
 * The part with one setting changed. A part the file leaves out is added first, so changing
 * any of its settings turns it on (Trevor, 2026-11-01: "while something is disabled, you
 * should still be able to open the menus").
 */
export function setPartAt(part: GuidePart, current: unknown, path: Path, value: unknown): unknown {
	return setAt(current === undefined ? newPartValue(part) : current, path, value);
}

/**
 * Of the places on the form (`paths`, as problems write them), the one a problem at `path` is
 * shown at: the same path, else the nearest one holding it, else the file's details.
 */
export function closestPath(path: string, paths: readonly string[]): string | undefined {
	let best: string | undefined;
	for (const p of paths) {
		const holds = path === p || path.startsWith(`${p}.`) || path.startsWith(`${p}[`);
		if (holds && (best === undefined || p.length > best.length)) best = p;
	}
	return best;
}

/** One run of a file's JSON: the lines of one part (`part`), or of what is around them. */
export interface JsonChunk {
	text: string;
	part?: string;
}

/**
 * The file as it is downloaded (two-space JSON), split so each part's lines are one chunk:
 * the builder's output makes a part's lines a link to its settings. The chunks joined are
 * the file's JSON exactly, whatever order its keys are in.
 */
export function jsonChunks(file: Record<string, unknown>): JsonChunk[] {
	const lines = JSON.stringify(file, null, 2).split('\n');
	const chunks: JsonChunk[] = [];
	let around: string[] = [];
	let part: { name: string; lines: string[] } | undefined;
	let inParts = false;
	const flushAround = () => {
		if (around.length) chunks.push({ text: around.join('\n') });
		around = [];
	};
	const flushPart = () => {
		if (part) chunks.push({ text: part.lines.join('\n'), part: part.name });
		part = undefined;
	};
	for (const line of lines) {
		if (!inParts) {
			around.push(line);
			if (line === '  "parts": {') inParts = true;
			continue;
		}
		const start = /^ {4}"((?:[^"\\]|\\.)*)": /.exec(line);
		if (start) {
			flushAround();
			flushPart();
			part = { name: JSON.parse(`"${start[1]}"`) as string, lines: [line] };
		} else if (/^ {2}\}/.test(line)) {
			flushPart();
			inParts = false;
			around.push(line);
		} else if (part) part.lines.push(line);
		else around.push(line);
	}
	flushPart();
	flushAround();
	// Each chunk after the first starts on a new line.
	return chunks.map((c, i) => (i === 0 ? c : { ...c, text: `\n${c.text}` }));
}
