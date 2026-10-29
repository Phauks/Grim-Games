/**
 * The custom info card editor's fields (CustomTokenEditor): each thing a card asks for is
 * set on its own (Trevor, 2026-10-18), and turned back into what the card asks for on save.
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import type { InfoTokenAsks, InfoTokenValue } from '#lib/core/data/info-tokens.ts';
import { cleanChoices, type CustomInfoToken } from './custom-tokens.ts';

export type InputKind = 'none' | InfoTokenValue['kind'];
/** How many characters a card shows: none, an exact count, or a range (Trevor, 2026-10-18). */
export type CharacterCount = 'none' | 'exact' | 'range';

export interface EditorFields {
	id?: string;
	text: string;
	characterIds: CharacterId[];
	input: InputKind;
	min: string;
	max: string;
	choices: string[];
	count: CharacterCount;
	/** The exact count, or a range's most. */
	characters: number;
	/** A range's least. */
	fewest: number;
	notInPlay: boolean;
	answerOnly: boolean;
}

export function blankEditor(): EditorFields {
	return {
		text: '',
		characterIds: [],
		input: 'none',
		min: '',
		max: '',
		choices: ['', ''],
		count: 'none',
		characters: 1,
		fewest: 1,
		notInPlay: false,
		answerOnly: false
	};
}

/** The editor's fields for a card, or blank for a new one. */
export function editorFor(token?: CustomInfoToken): EditorFields {
	const value = token?.asks?.value;
	return {
		...blankEditor(),
		id: token?.id,
		text: token?.text ?? '',
		characterIds: [...(token?.characterIds ?? [])],
		input: value?.kind ?? 'none',
		min: value?.kind === 'number' && value.min !== undefined ? String(value.min) : '',
		max: value?.kind === 'number' && value.max !== undefined ? String(value.max) : '',
		choices: value?.kind === 'choices' ? [...value.options] : ['', ''],
		count: countOf(token?.asks),
		characters: token?.asks?.characters ?? 1,
		fewest: token?.asks?.fewest ?? 1,
		notInPlay: token?.asks?.notInPlay === true,
		answerOnly: token?.answerOnly === true
	};
}

function countOf(asks: InfoTokenAsks | undefined): CharacterCount {
	if (!asks?.characters) return 'none';
	const from = asks.exactly ? asks.characters : (asks.fewest ?? 1);
	return from < asks.characters ? 'range' : 'exact';
}

/** A whole number as typed: digits, with a minus sign only in front. */
export const wholeNumber = (text: string) =>
	(text.trimStart().startsWith('-') ? '-' : '') + text.replace(/\D/g, '');

/** What the editor's fields ask for; the store drops what can't be asked (one answer). */
export function editorAsks(fields: EditorFields): InfoTokenAsks {
	const whole = (text: string) => (/^-?\d+$/.test(text.trim()) ? Number(text) : undefined);
	const value: InfoTokenValue | undefined =
		fields.input === 'text'
			? { kind: 'text' }
			: fields.input === 'number'
				? { kind: 'number', min: whole(fields.min), max: whole(fields.max) }
				: fields.input === 'choices'
					? { kind: 'choices', options: cleanChoices(fields.choices) }
					: undefined;
	const shows = fields.count !== 'none';
	const range = fields.count === 'range' && fields.fewest < fields.characters;
	return {
		characters: shows ? fields.characters : undefined,
		exactly: shows && !range ? true : undefined,
		fewest: range && fields.fewest > 1 ? fields.fewest : undefined,
		notInPlay: (shows && fields.notInPlay) || undefined,
		value
	};
}

/** The preview's filled-in part, showing where it goes. */
export function editorDetail(fields: EditorFields): string | undefined {
	return fields.input === 'none'
		? undefined
		: fields.input === 'choices'
			? (cleanChoices(fields.choices)[0] ?? '…')
			: fields.input === 'number'
				? fields.min.trim() || '0'
				: '…';
}
