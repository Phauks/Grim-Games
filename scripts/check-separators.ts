/**
 * Lint: no em dash `—` or pipe `|` in text people see (Trevor, 2026-10-31: they read as
 * machine written; the middle dot and hyphens are fine). Say it in words instead: a comma,
 * "to", "None", or separate elements.
 *
 * `—` is never code, so it fails in any string or template text under src. `|` is code too
 * (regex, lookup keys, a Markdown table), so it fails only where people read it: catalog
 * messages (src/lib/i18n/messages) and Svelte template text, including the attributes people
 * read or hear (aria-label, title, placeholder, alt, label). vite.config.ts is checked too: it
 * writes the build line into the static error page. Comments, CSS, tests and official game
 * text (TPI data, wiki text fetched live) are not checked. A symbol that must stay says why on
 * the same line: a comment containing `sep-ok:`. Run by `npm run lint`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'svelte/compiler';
import ts from 'typescript';

const root = fileURLToPath(new URL('..', import.meta.url));
const ALWAYS = /—/;
const IN_TEXT = /[—|]/;
const TEXT_ATTRIBUTES = new Set(['aria-label', 'title', 'placeholder', 'alt', 'label']);
const SKIPPED_ELEMENTS = new Set(['code', 'pre', 'svg']);

export type SeparatorProblem = { line: number; text: string };

function okLines(source: string): Set<number> {
	const ok = new Set<number>();
	source.split('\n').forEach((text, index) => {
		if (text.includes('sep-ok:')) ok.add(index + 1);
	});
	return ok;
}

function lineAt(source: string, offset: number): number {
	return source.slice(0, offset).split('\n').length;
}

/** Problems in TypeScript source. `text` checks `|` too (catalog files). */
function scanScript(
	code: string,
	firstLine: number,
	text: boolean,
	found: SeparatorProblem[]
): void {
	const pattern = text ? IN_TEXT : ALWAYS;
	const file = ts.createSourceFile('x.ts', code, ts.ScriptTarget.Latest, true);
	const visit = (node: ts.Node): void => {
		if (
			ts.isStringLiteral(node) ||
			ts.isNoSubstitutionTemplateLiteral(node) ||
			ts.isTemplateHead(node) ||
			ts.isTemplateMiddle(node) ||
			ts.isTemplateTail(node)
		) {
			// Imports and string literal types are code, never shown.
			const parent = node.parent;
			const shown = !ts.isImportDeclaration(parent) && !ts.isLiteralTypeNode(parent);
			if (shown && pattern.test(node.text)) {
				const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line;
				found.push({ line: firstLine + line, text: node.text });
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(file);
}

/** Problems in a TypeScript file. Catalog files are text throughout. */
export function findInScript(source: string, catalog = false): SeparatorProblem[] {
	const found: SeparatorProblem[] = [];
	scanScript(source, 1, catalog, found);
	const ok = okLines(source);
	return found.filter((problem) => !ok.has(problem.line));
}

type Node = { type?: string; name?: string; data?: string; start?: number; [key: string]: unknown };

/** Problems in a Svelte file: its scripts, template text and string literals in expressions. */
export function findInSvelte(source: string): SeparatorProblem[] {
	const ast = parse(source, { modern: true }) as unknown as {
		fragment: Node;
		instance?: { content: { start: number; end: number } };
		module?: { content: { start: number; end: number } };
	};
	const found: SeparatorProblem[] = [];
	for (const script of [ast.instance, ast.module]) {
		if (!script) continue;
		const { start, end } = script.content;
		scanScript(source.slice(start, end), lineAt(source, start), false, found);
	}
	const add = (text: string, start: number, pattern: RegExp) => {
		if (pattern.test(text)) found.push({ line: lineAt(source, start), text: text.trim() });
	};
	const visit = (node: unknown, pattern: RegExp): void => {
		if (Array.isArray(node)) {
			for (const child of node) visit(child, pattern);
			return;
		}
		if (!node || typeof node !== 'object') return;
		const n = node as Node;
		if (n.type === 'RegularElement' && n.name && SKIPPED_ELEMENTS.has(n.name)) return;
		if (n.type === 'Text' && typeof n.data === 'string') return add(n.data, n.start ?? 0, pattern);
		if (n.type === 'Literal' && typeof n.value === 'string')
			return add(n.value, n.start ?? 0, ALWAYS);
		if (n.type === 'TemplateElement') {
			const value = n.value as { cooked?: string } | undefined;
			return add(value?.cooked ?? '', n.start ?? 0, ALWAYS);
		}
		if (n.type === 'Attribute') {
			// Text people read or hear is text; class, href, id and the like are code.
			const text = n.name !== undefined && TEXT_ATTRIBUTES.has(n.name);
			return visit(n.value, text ? IN_TEXT : ALWAYS);
		}
		for (const [key, child] of Object.entries(n)) {
			if (key === 'metadata' || key === 'parent') continue;
			if (child && typeof child === 'object') visit(child, pattern);
		}
	};
	visit(ast.fragment, IN_TEXT);
	const ok = okLines(source);
	return found.filter((problem) => !ok.has(problem.line));
}

function* files(dir: string): Generator<string> {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* files(path);
		else if (/\.(ts|svelte)$/.test(entry.name) && !/\.(test|e2e)\.ts$/.test(entry.name)) yield path;
	}
}

if (process.argv.includes('--run')) {
	let problems = 0;
	// vite.config.ts writes the build line into the static error page.
	for (const path of [...files(join(root, 'src')), join(root, 'vite.config.ts')]) {
		const file = relative(root, path).split(sep).join('/');
		const source = readFileSync(path, 'utf8');
		const found = file.endsWith('.svelte')
			? findInSvelte(source)
			: findInScript(source, file.startsWith('src/lib/i18n/messages/'));
		for (const { line, text } of found) {
			console.error(`${file}:${line}  ${JSON.stringify(text.slice(0, 80))}`);
			problems++;
		}
	}
	if (problems) {
		console.error(
			`\n${problems} em dash(es) or pipe(s) in interface text.` +
				' Say it in words: a comma, "to", "None", or separate elements.'
		);
		process.exit(1);
	}
}
