/**
 * Day and night sound (plan U3, Trevor 2026-10-26): one field recording plays under the night
 * and one under the day, each looped without a seam. Trevor heard layered parts first and
 * found they "sound bad overlapping", so it is one recording at a time; these are the ones he
 * kept from a listening page of public domain recordings. Every recording is public domain
 * (the repository is public, so nothing with a licence that bars sharing the raw files) and is
 * credited in About. The files live in `static/sounds/ambience/` and are stored on a device
 * only once they play.
 */

/** What a recording is of: a night, a day, or weather or a fire that suits either. */
export type AmbienceKind = 'night' | 'day' | 'weather' | 'fire';

/** The night or the day, each with its own recording. */
export type AmbienceScene = 'night' | 'day';

export interface AmbienceMix {
	/** Also its file name in `AMBIENCE_PATH`, with `.mp3`. */
	id: string;
	kind: AmbienceKind;
	/** What it is, as the drop-downs list it. */
	name: string;
	/** Where it was recorded. */
	place: string;
	/** Who recorded it, when the source names them. */
	recordist?: string;
	source: 'National Park Service' | 'Internet Archive';
	page: string;
}

const AMBIENCE_PATH = '/sounds/ambience';

const ROMO = 'https://www.nps.gov/romo/learn/photosmultimedia/sounds-ambient-soundscapes.htm';
const YELL = 'https://www.nps.gov/yell/learn/photosmultimedia/sounds-soundscapes.htm';
const ARCHIVE = 'https://archive.org/details/';

/** An Internet Archive recording, most of them from Radio Aporee's public domain sound map. */
function archive(
	id: string,
	kind: AmbienceKind,
	name: string,
	place: string,
	item: string,
	recordist?: string
): AmbienceMix {
	return { id, kind, name, place, recordist, source: 'Internet Archive', page: ARCHIVE + item };
}

function nps(id: string, kind: AmbienceKind, name: string, place: string, page: string) {
	return { id, kind, name, place, source: 'National Park Service', page } satisfies AmbienceMix;
}

export const AMBIENCE_MIXES: readonly AmbienceMix[] = [
	nps('night-meadow', 'night', 'Evening meadow', 'Moraine Park, Rocky Mountain', ROMO),
	nps('night-loons', 'night', 'Lake with loons', 'Yellowstone Lake', YELL),
	nps('night-coyotes-elk', 'night', 'Coyotes and elk', 'Yellowstone Lake', YELL),
	archive(
		'night-frogs-foxes',
		'night',
		'Frogs, crickets, birds and foxes',
		'Dullstroom, South Africa',
		'nighttime-natural-ambience-frogs-crickets-birds-foxes-2',
		'Diffie Bosman'
	),
	archive(
		'night-frogs-bats',
		'night',
		'Frogs, birds and bats',
		'Dullstroom, South Africa',
		'1_20250112_20250112_1019',
		'Diffie Bosman'
	),
	archive(
		'night-beach',
		'night',
		'Beach after dark',
		'Scheveningen, Netherlands',
		'aporee_22007_25563',
		'Thijs Geritz'
	),
	archive(
		'night-bogs',
		'night',
		'Bogs at night',
		'Wharton State Forest, New Jersey',
		'aporee_27464_31650'
	),
	archive('night-virginia', 'night', 'Night sounds', 'Leesburg, Virginia', 'aporee_29355_33780'),
	archive(
		'night-tink-frogs',
		'night',
		'Tink frogs',
		'Costa Rica',
		'aporee_32354_37200',
		'Matt Rogalsky'
	),
	archive(
		'night-field',
		'night',
		'Night field crossing',
		'Downe, New Jersey',
		'aporee_33186_38154'
	),
	archive('night-brazil', 'night', 'Infinite night', 'Iracambi, Brazil', 'aporee_37285_42710'),
	archive(
		'night-prairie-coyote',
		'night',
		'Coyote on the prairie',
		'Tallgrass Prairie, Oklahoma',
		'aporee_38611_44124',
		'Felix Blume'
	),
	archive(
		'night-insects',
		'night',
		'Night forest insects',
		'Los Gatos, California',
		'aporee_41451_47281'
	),
	archive(
		'night-coastal-forest',
		'night',
		'Coastal forest at night',
		'Atiu, Cook Islands',
		'aporee_54114_61850',
		'Matthias Feuersenger'
	),
	archive(
		'night-tawny-owl',
		'night',
		'A lone tawny owl',
		'Chediston, Suffolk',
		'aporee_68716_81482',
		'Peter Cusack'
	),
	nps('day-forest', 'day', 'Forest', 'Lawn Lake, Rocky Mountain', ROMO),
	nps('day-morning-lake', 'day', 'Morning by a lake', 'Finch Lake, Rocky Mountain', ROMO),
	nps('day-stream', 'day', 'Stream', 'Black Canyon Trail, Rocky Mountain', ROMO),
	nps('day-lake-birds', 'day', 'Lake with birds and ducks', 'Yellowstone Lake', YELL),
	archive(
		'day-thrush',
		'day',
		'Song thrush and woodpecker',
		'Vogelsang, Germany',
		'aporee_27852_32098',
		'Peter Cusack'
	),
	archive('day-early-morning', 'day', 'Early morning', 'Nijlen, Belgium', 'aporee_28257_32551'),
	archive(
		'day-countryside',
		'day',
		'Birds in the countryside',
		'Tallgrass Prairie, Oklahoma',
		'aporee_38588_44101',
		'Felix Blume'
	),
	archive(
		'day-rattling-bird',
		'day',
		'Forest with a rattling bird',
		'Sucholewski forest, Poland',
		'aporee_40350_46083',
		'Maciej Janasik'
	),
	archive(
		'day-spring-forest',
		'day',
		'Spring forest',
		'Gogulec reserve, Poland',
		'aporee_45242_51389',
		'Maciej Janasik'
	),
	archive(
		'day-doves',
		'day',
		'Doves, grackles and blackbirds',
		'South River, Ontario',
		'aporee_67844_78533',
		'NAISA'
	),
	nps('weather-storm-rockies', 'weather', 'Thunderstorm', 'Hollowell Park, Rocky Mountain', ROMO),
	archive(
		'weather-storm-ireland',
		'weather',
		'Thunderstorm by a lake',
		'Mountshannon, Ireland',
		'aporee_19000_22038',
		'Softday'
	),
	archive(
		'weather-storm-field',
		'weather',
		'Thunderstorm over a field',
		'Illinois',
		'aporee_38612_44125',
		'Felix Blume'
	),
	archive(
		'weather-rain-wood',
		'weather',
		'Rain in a wood',
		'Hemsworth, Yorkshire',
		'aporee_25787_29851',
		'Rory Smith'
	),
	archive(
		'weather-light-rain',
		'weather',
		'Light rain in a forest',
		'Kiel, Germany',
		'aporee_43527_49569'
	),
	archive('fire-fireplace', 'fire', 'Fireplace', 'Stabulankiai, Lithuania', 'aporee_19997_23285'),
	archive(
		'fire-lagoon',
		'fire',
		'Campfire by a lagoon',
		'Royal National Park, Australia',
		'aporee_40321_46050',
		'Jeremy Hegge'
	),
	archive(
		'fire-campfire',
		'fire',
		'Quiet campfire at night',
		'Åkersberga, Sweden',
		'aporee_44529_50624'
	),
	archive(
		'fire-crackle',
		'fire',
		'Fireplace hiss and crackle',
		'Kłodzko, Poland',
		'aporee_60408_69385',
		'Piotrek Zyla'
	)
];

/** What a new device plays: the National Park Service's quietest night and day. */
export const DEFAULT_AMBIENCE: Readonly<Record<AmbienceScene, string>> = {
	night: 'night-meadow',
	day: 'day-forest'
};

/** A recording's URL. */
export function ambienceUrl(mix: AmbienceMix): string {
	return `${AMBIENCE_PATH}/${mix.id}.mp3`;
}

export function ambienceMix(id: string): AmbienceMix | undefined {
	return AMBIENCE_MIXES.find((mix) => mix.id === id);
}

/**
 * The recordings a scene can play, in the drop-down's order: the scene's own first, then
 * weather and fire, which suit a night or a day alike.
 */
export function ambienceOptions(scene: AmbienceScene): AmbienceMix[] {
	const order: readonly AmbienceKind[] = [scene, 'weather', 'fire'];
	return order.flatMap((kind) => AMBIENCE_MIXES.filter((mix) => mix.kind === kind));
}

/** A scene's stored recording, as any build saved it; an unknown one becomes the default. */
export function parseAmbience(scene: AmbienceScene, raw: unknown): string {
	return ambienceOptions(scene).some((mix) => mix.id === raw)
		? (raw as string)
		: DEFAULT_AMBIENCE[scene];
}
