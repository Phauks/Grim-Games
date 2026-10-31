import { describe, expect, it } from 'vitest';
import { pictureSize, unpackPicture } from './picked-picture.ts';

/** A 40×20 JPEG, red left and blue right, marked by its camera as turned a quarter clockwise. */
const TURNED =
	'/9j/4AAQSkZJRgABAQAAAQABAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAYAAAAAAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAUACgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD50ooor8MP9Uzgfir/AMwv/tr/AOyVwFd/8Vf+YX/21/8AZK4Cv9VPBL/kgMu/7i/+n6h/mv4v/wDJb4//ALh/+maYUUUV+5H44e+0UUV/hyf7FnA/FX/mF/8AbX/2SuAoor/VTwS/5IDLv+4v/p+of5r+L/8AyW+P/wC4f/pmmFFFFfuR+OH/2Q==';

const turned = () =>
	new Blob([Uint8Array.from(atob(TURNED), (c) => c.charCodeAt(0))], { type: 'image/jpeg' });

/** A photo-sized JPEG, as a phone's camera gives. */
function photo(width: number, height: number): Promise<Blob> {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = 'rgb(0, 128, 0)';
	ctx.fillRect(0, 0, width, height);
	return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9));
}

/** The colour at a point of what was unpacked. */
function colourAt(image: CanvasImageSource, width: number, height: number, x: number, y: number) {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d')!;
	ctx.drawImage(image, 0, 0);
	const [r, , b] = ctx.getImageData(x, y, 1, 1).data;
	return r > b ? 'red' : 'blue';
}

describe('unpackPicture', () => {
	it('unpacks a large photo at a fraction of its size, but no smaller than asked', async () => {
		const picture = await unpackPicture(await photo(4000, 3000), 500);
		expect(picture.width).toBeLessThan(4000);
		expect(Math.max(picture.width, picture.height)).toBeGreaterThanOrEqual(500);
		expect(picture.width / picture.height).toBeCloseTo(4 / 3, 1);
		expect(picture.scale).toBeCloseTo(picture.width / 4000, 5);
		picture.close();
	});

	it('turns a photo upright as its camera marked it', async () => {
		expect(await pictureSize(turned())).toEqual({ width: 20, height: 40 });
		const picture = await unpackPicture(turned(), 15);
		// Unpacked small, not whole, and not on its side.
		expect(picture.height).toBeLessThan(40);
		expect(picture.height).toBeGreaterThanOrEqual(15);
		expect(picture.height).toBe(picture.width * 2);
		expect(picture.scale).toBeLessThan(1);
		const { image, width, height } = picture;
		// A quarter turn clockwise puts the left (red) half on top.
		expect(colourAt(image, width, height, width / 2, 2)).toBe('red');
		expect(colourAt(image, width, height, width / 2, height - 2)).toBe('blue');
		picture.close();
	});

	it('cuts a square from the upright picture', async () => {
		const picture = await unpackPicture(turned(), 15);
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = 4;
		const ctx = canvas.getContext('2d')!;
		// The bottom half's middle: blue once upright.
		ctx.drawImage(picture.image, 2, picture.height - 6, 4, 4, 0, 0, 4, 4);
		const [r, , b] = ctx.getImageData(2, 2, 1, 1).data;
		expect(b).toBeGreaterThan(r);
		picture.close();
	});

	it('unpacks a picture no larger than asked whole', async () => {
		const picture = await unpackPicture(await photo(300, 200), 500);
		expect([picture.width, picture.height, picture.scale]).toEqual([300, 200, 1]);
		picture.close();
	});
});
