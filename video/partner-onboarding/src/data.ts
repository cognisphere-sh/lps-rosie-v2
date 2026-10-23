import {staticFile} from 'remotion';
import {getAudioData} from '@remotion/media-utils';
import narration from '../narration.json';
import vo from '../vo.json';

export const FPS = 30;
export const INTRO = 48; // 1.6 s
export const OUTRO = 36; // 1.2 s
const TAIL = 0.45; // air after a card beat's narration
const HOLD_AIR = 0.3; // min air after narration when footage is too short (last frame is frozen)
const RING_MIN = 18; // rings that would show for less than this (frames) are dropped
const RING_HOLD = 36; // a ring near the end of a take keeps at least this many frames (last frame frozen)

type Rect = {x: number; y: number; width: number; height: number};
type Take = {device: 'D' | 'P'; file: string; css: {width: number; height: number}; dpr: number; duration: number};
type Marks = {
	takes: Record<string, Take>;
	beats: {id: string; take: string | null; t: number}[];
	events: {take: string; t: number; kind: string; rect?: Rect; scale?: number; duration?: number}[];
};

export type Beat = {id: string; text: string; caption: string | null; from: number; dur: number; voFrames: number};
// Camera window in CSS px of the take viewport: the visible part of the page.
export type Win = {x: number; y: number; w: number; h: number};
export type Seg =
	| {kind: 'card'; from: number; dur: number; beat: Beat}
	| {
			kind: 'run';
			from: number;
			dur: number;
			src: string;
			device: 'D' | 'P';
			css: {width: number; height: number};
			trimBefore: number; // source frame
			video: number; // frames of real footage; the rest of `dur` holds the last frame
			fade: boolean; // fade the whole layout in (after a card or a device switch); else hard cut
			beats: Beat[]; // from relative to run start
			cams: {f: number; win: Win}[]; // camera keyframes, f relative to run
			rings: {f: number; end: number; rect: Rect}[];
			sfx: {f: number; name: string; vol: number}[];
	  };
export type ChapterData = {n: number; title: string; next: string | null; dur: number; segs: Seg[]; sfx: {f: number; name: string; vol: number}[]; vo: {id: string; f: number; dur: number; gain: number}[]};

export const chapters = narration as {n: number; title: string; beats: {id: string; text: string; caption: string | null}[]}[];
const voSec = vo as Record<string, number>;
export const SUCCESS = ['3.6', '4.9', '5.4', '7.6', '7.8', '7.9', '6.7'];
export const DING = ['2.9', '8.5', '8.7', '6.3', '6.4', '6.6']; // 6.x: LPS replies land (6.5's reply lands with 6.6's, one ding)

const fr = (s: number) => Math.round(s * FPS);

export const loadMarks = async (n: number): Promise<Marks | null> => {
	const res = await fetch(staticFile(`footage/ch${n}/marks.json`)).catch(() => null);
	if (!res || !res.ok) return null;
	return res.json().catch(() => null);
};

// Zoom window: aim at the zoom rect and keep all of it in frame, pushing in less (down to 1x) when it is
// wide; a rect covering the whole viewport is just an aim point. Rings shown while zoomed also stay in view
// (shrinking the scale if their union is wider than the zoomed window).
const zoomWin = (rect: Rect, scale: number, rings: Rect[], W: number, H: number): Win => {
	const pad = 40;
	const fit = Math.min(W / (rect.width + pad * 2), H / (rect.height + pad * 2));
	const wholePage = rect.width >= W * 0.95 && rect.height >= H * 0.95;
	let s = wholePage ? scale : Math.max(1, Math.min(scale, fit));
	let cx = rect.x + rect.width / 2;
	let cy = rect.y + rect.height / 2;
	if (rings.length) {
		const x0 = Math.min(...rings.map((r) => r.x)) - pad;
		const y0 = Math.min(...rings.map((r) => r.y)) - pad;
		const x1 = Math.max(...rings.map((r) => r.x + r.width)) + pad;
		const y1 = Math.max(...rings.map((r) => r.y + r.height)) + pad;
		s = Math.max(1, Math.min(s, W / (x1 - x0), H / (y1 - y0)));
		const w = W / s, h = H / s;
		cx = Math.min(Math.max(cx, x1 - w / 2), x0 + w / 2);
		cy = Math.min(Math.max(cy, y1 - h / 2), y0 + h / 2);
	}
	const w = W / s, h = H / s;
	return {x: Math.min(Math.max(cx - w / 2, 0), W - w), y: Math.min(Math.max(cy - h / 2, 0), H - h), w, h};
};

// Narration lines are about -21.7 LUFS; lift them toward -18 LUFS, but never past -1 dBFS peak.
const VOICE = 1.5;
export const withVoiceGains = async (d: ChapterData): Promise<ChapterData> => ({
	...d,
	vo: await Promise.all(
		d.vo.map(async (v) => {
			const {channelWaveforms} = await getAudioData(staticFile(`vo/${v.id}.wav`));
			let peak = 0;
			for (const x of channelWaveforms[0]) peak = Math.max(peak, Math.abs(x));
			return {...v, gain: Math.min(VOICE, 0.89 / (peak || 1))};
		}),
	),
});

export const buildChapter = (n: number, marks: Marks | null): ChapterData => {
	const ch = chapters.find((c) => c.n === n)!;
	const nextCh = chapters.find((c) => c.n === n + 1);
	const segs: Seg[] = [];
	const sfx: ChapterData['sfx'] = [{f: 0, name: 'whoosh', vol: 0.5}, {f: 12, name: 'chime', vol: 0.45}];
	const voList: ChapterData['vo'] = [];
	let cursor = INTRO;
	const mb = (id: string) => marks?.beats.find((b) => b.id === id && b.take && marks.takes[b.take]);

	// End of a footage beat: next beat start in the same take, else take end.
	const beatEnd = (take: string, t: number) =>
		Math.min(marks!.takes[take].duration, ...marks!.beats.filter((b) => b.take === take && b.t > t + 1e-6).map((b) => b.t));

	let i = 0;
	while (i < ch.beats.length) {
		const b = ch.beats[i];
		const m = mb(b.id);
		const voFrames = Math.ceil((voSec[b.id] ?? 3) * FPS);
		if (!m) {
			const dur = Math.ceil(((voSec[b.id] ?? 3) + TAIL) * FPS);
			const beat = {...b, from: 0, dur, voFrames};
			segs.push({kind: 'card', from: cursor, dur, beat});
			voList.push({id: b.id, f: cursor, dur: voFrames, gain: 1});
			if (SUCCESS.includes(b.id)) sfx.push({f: cursor + 15, name: 'chime', vol: 0.45});
			if (DING.includes(b.id)) sfx.push({f: cursor + 15, name: 'ding', vol: 0.5});
			cursor += dur;
			i++;
			continue;
		}
		// Gather the contiguous run of beats from the same take.
		const take = m.take!;
		const tk = marks!.takes[take];
		const t0 = m.t;
		const runBeats: {b: (typeof ch.beats)[number]; t: number; end: number}[] = [];
		while (i < ch.beats.length) {
			const mm = mb(ch.beats[i].id);
			const prevEnd = runBeats.length ? runBeats[runBeats.length - 1].end : t0;
			if (!mm || mm.take !== take || Math.abs(mm.t - prevEnd) > 0.05) break;
			const end = beatEnd(take, mm.t);
			runBeats.push({b: ch.beats[i], t: mm.t, end});
			i++;
			// A segment shorter than its narration ends the run; the last frame is held (below).
			if (end - mm.t < (voSec[ch.beats[i - 1].id] ?? 3) + HOLD_AIR) break;
		}
		const t1 = runBeats[runBeats.length - 1].end;
		const video = fr(t1 - t0);
		const beats: Beat[] = runBeats.map((r) => ({
			...r.b,
			from: fr(r.t - t0),
			dur: fr(r.end - t0) - fr(r.t - t0),
			voFrames: Math.ceil((voSec[r.b.id] ?? 3) * FPS),
		}));
		// Rings/zooms logged right at a beat boundary can carry a t a hair before the beat: shift that slack to
		// the run that starts there (clamped to its first frame).
		const SLACK = 0.25;
		const boundary = (k: string) => k === 'ring' || k === 'zoom' || k === 'unzoom';
		const cutEnd = t1 < tk.duration - 1e-6 ? SLACK : 0;
		const evs = marks!.events
			.filter((e) => e.take === take && (boundary(e.kind) ? e.t >= t0 - SLACK && e.t < t1 - cutEnd : e.t >= t0 && e.t < t1))
			.map((e) => ({...e, f: Math.max(0, fr(e.t - t0))}));
		const W = tk.css.width, H = tk.css.height;
		const full: Win = {x: 0, y: 0, w: W, h: H};
		const cams: {f: number; win: Win}[] = [{f: 0, win: full}];
		const rings: {f: number; end: number; rect: Rect}[] = [];
		const runSfx: {f: number; name: string; vol: number}[] = [];
		evs.forEach((e, k) => {
			if (e.kind === 'zoom' && e.rect) {
				const stop = evs.slice(k + 1).find((x) => x.kind === 'zoom' || x.kind === 'unzoom')?.f ?? video;
				const zr = evs.filter((x) => x.kind === 'ring' && x.rect && x.f >= e.f && x.f < stop).map((x) => x.rect!);
				cams.push({f: e.f, win: zoomWin(e.rect, e.scale ?? 1.5, zr, W, H)});
			} else if (e.kind === 'unzoom') cams.push({f: e.f, win: full});
			else if (e.kind === 'ring' && e.rect) {
				// A ring holds ~1.8 s, until the next ring, or until the page navigates away under it.
				const cut = evs.slice(k + 1).find((x) => x.kind === 'ring' || x.kind === 'nav')?.f ?? Infinity;
				if (cut - e.f < RING_MIN) return; // replaced or navigated away almost at once: skip the flash
				// It also ends with its beat (but gets at least ~0.9 s), so it doesn't sit under the next beat's caption.
				const beatEnd = beats.map((b) => b.from).find((f) => f > e.f) ?? Infinity;
				rings.push({f: e.f, end: Math.min(e.f + 54, cut, Math.max(beatEnd, e.f + 28)), rect: e.rect});
				runSfx.push({f: e.f, name: 'pop', vol: 0.18});
			} else if (e.kind === 'click') runSfx.push({f: e.f, name: 'click', vol: 0.5});
			else if (e.kind === 'nav') runSfx.push({f: e.f, name: 'whoosh', vol: 0.35});
			else if (e.kind === 'reply') runSfx.push({f: e.f, name: 'ding', vol: 0.45}); // an LPS reply lands on screen
			else if (e.kind === 'type') for (let s = 0; s <= (e.duration ?? 0) + 1e-6; s += 0.07) runSfx.push({f: e.f + fr(s), name: 'tick', vol: 0.25});
		});
		// Hold the last frame for narration that outlasts the footage, and so a ring logged right before the
		// take ends still shows for RING_HOLD frames.
		const last = beats[beats.length - 1];
		const hold = Math.max(0, last.from + last.voFrames + fr(HOLD_AIR) - video, ...rings.map((r) => Math.min(r.end, r.f + RING_HOLD) - video));
		last.dur = video + hold - last.from;
		const dur = video + hold;
		for (const r of rings) r.end = Math.min(r.end, dur);
		// Success chimes / dings land just after the beat's last click (or early in the beat).
		for (const bt of beats) {
			const name = SUCCESS.includes(bt.id) ? 'chime' : DING.includes(bt.id) ? 'ding' : null;
			if (!name) continue;
			// A logged `reply` event already times this beat's ding exactly.
			if (name === 'ding' && evs.some((e) => e.kind === 'reply' && e.f >= bt.from && e.f < bt.from + bt.dur)) continue;
			const clicks = evs.filter((e) => e.kind === 'click' && e.f >= bt.from && e.f < bt.from + bt.dur);
			runSfx.push({f: (clicks.length ? clicks[clicks.length - 1].f : bt.from + 6) + 9, name, vol: 0.45});
		}
		const prev = segs[segs.length - 1];
		segs.push({
			kind: 'run',
			from: cursor,
			dur,
			src: `footage/ch${n}/${tk.file}`,
			device: tk.device,
			css: tk.css,
			trimBefore: fr(t0),
			video,
			fade: !(prev?.kind === 'run' && prev.device === tk.device),
			beats,
			cams,
			rings,
			sfx: runSfx,
		});
		for (const bt of beats) voList.push({id: bt.id, f: cursor + bt.from, dur: bt.voFrames, gain: 1});
		cursor += dur;
	}
	return {n, title: ch.title, next: nextCh?.title ?? null, dur: cursor + OUTRO, segs, sfx, vo: voList};
};
