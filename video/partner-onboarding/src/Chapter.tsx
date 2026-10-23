import React from 'react';
import {AbsoluteFill, Audio, Easing, Freeze, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ChapterData, INTRO, OUTRO, Seg, Win, chapters} from './data';
import {C, Eyebrow, INTER, LeafMark, PLAYFAIR, Phone, PHONE_SCREEN, Rich, Sprout, useIn} from './ui';
import {CardBeat} from './Cards';

// ---- Layout --------------------------------------------------------------------------------
const TOP = 84; // header strip above the browser frame
const BAR = 40; // browser top bar
const BOTTOM = 40;
const VH = 1080 - TOP - BAR - BOTTOM;
const VW = Math.round(VH * 1.6);
const FX = (1920 - VW) / 2;

// bed.wav is -34 LUFS; with the voice near -18 LUFS this keeps the bed around -34 between lines and -38 under
// the voice (a 0.18 gain would leave it near -49 LUFS: inaudible).
const MUSIC = {base: 1, ducked: 0.6};

// ---- Footage: camera + rings ---------------------------------------------------------------
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const useCam = (cams: {f: number; win: Win}[]): Win => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	let win = cams[0].win;
	for (let i = 1; i < cams.length && cams[i].f <= frame; i++) {
		const p = spring({frame: frame - cams[i].f, fps, config: {damping: 200}, durationInFrames: 18});
		const to = cams[i].win;
		win = {x: lerp(win.x, to.x, p), y: lerp(win.y, to.y, p), w: lerp(win.w, to.w, p), h: lerp(win.h, to.h, p)};
	}
	return win;
};

const Footage: React.FC<{seg: Extract<Seg, {kind: 'run'}>; w: number; h: number}> = ({seg, w, h}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const win = useCam(seg.cams);
	const k = w / win.w;
	return (
		<div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
			<Freeze frame={seg.video - 1} active={frame >= seg.video}>
				<OffthreadVideo
					src={staticFile(seg.src)}
					trimBefore={seg.trimBefore}
					muted
					style={{position: 'absolute', left: -win.x * k, top: -win.y * k, width: seg.css.width * k, height: seg.css.height * k, maxWidth: 'none'}}
				/>
			</Freeze>
			{seg.rings
				.filter((r) => frame >= r.f && frame < r.end + 10)
				.map((r) => {
					const pop = spring({frame: frame - r.f, fps, config: {damping: 14, mass: 0.6}});
					const out = interpolate(frame, [r.end, r.end + 9], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
					// +8 px padding, kept 4 px inside the frame so edge-to-edge targets (a phone's bottom bar) stay visible.
					const pad = 8, m = 4;
					const x = Math.max(m, (r.rect.x - win.x) * k - pad);
					const y = Math.max(m, (r.rect.y - win.y) * k - pad);
					const rw = Math.min(w - m, (r.rect.x + r.rect.width - win.x) * k + pad) - x;
					const rh = Math.min(h - m, (r.rect.y + r.rect.height - win.y) * k + pad) - y;
					return (
						<div
							key={r.f}
							style={{
								position: 'absolute',
								left: x,
								top: y,
								width: rw,
								height: rh,
								borderRadius: Math.min(14, rh / 2),
								border: `3px solid ${C.teal}`,
								boxShadow: `0 0 0 5px rgba(8,127,140,0.16), 0 0 26px 6px rgba(8,127,140,0.32), 0 0 0 4000px rgba(30,59,40,${0.12 * Math.min(pop, 1)})`,
								opacity: Math.min(pop, 1) * out,
								transform: `scale(${interpolate(pop, [0, 1], [1.12, 1])})`,
							}}
						/>
					);
				})}
		</div>
	);
};

const fadeIn = (frame: number, n = 8) => interpolate(frame, [0, n], [0, 1], {extrapolateRight: 'clamp'});

// ---- Desktop: browser window + lower-third caption ------------------------------------------
const Browser: React.FC<{children: React.ReactNode}> = ({children}) => (
	<div style={{position: 'absolute', left: FX, top: TOP, width: VW, height: VH + BAR, borderRadius: 18, overflow: 'hidden', background: C.card, boxShadow: '0 30px 70px -28px rgba(20,50,35,0.28), 0 0 0 1px rgba(30,59,40,0.07)'}}>
		<div style={{height: BAR, display: 'flex', alignItems: 'center', padding: '0 18px', background: C.bg, borderBottom: `1px solid ${C.line}`, position: 'relative'}}>
			{[C.line, C.line, C.line].map((c, i) => (
				<div key={i} style={{width: 12, height: 12, borderRadius: 6, background: c, marginRight: 8, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)'}} />
			))}
			<div style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', padding: '5px 22px', borderRadius: 99, background: C.card, border: `1px solid ${C.line}`, fontFamily: INTER, fontSize: 15, color: C.muted, display: 'flex', gap: 8, alignItems: 'center'}}>
				<svg width={12} height={12} viewBox="0 0 24 24"><path d="M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z" stroke={C.muted} strokeWidth={2.4} fill="none" /></svg>
				Local Plant Supply · Partner portal
			</div>
		</div>
		<div style={{position: 'relative', width: VW, height: VH}}>{children}</div>
	</div>
);

const LowerThird: React.FC<{text: string}> = ({text}) => {
	const frame = useCurrentFrame();
	const p = interpolate(frame, [0, 6], [0, 1], {extrapolateRight: 'clamp', easing: Easing.in(Easing.quad)});
	return (
		<div style={{position: 'absolute', left: FX + 36, bottom: 22, display: 'flex', alignItems: 'stretch', background: C.card, borderRadius: 14, overflow: 'hidden', boxShadow: '0 18px 40px -16px rgba(20,40,30,0.35), 0 0 0 1px rgba(30,59,40,0.06)', opacity: p, transform: `translateY(${(1 - p) * 14}px)`}}>
			<div style={{width: 7, background: C.teal}} />
			<div style={{padding: '18px 30px 18px 24px', fontFamily: INTER, fontSize: 36, fontWeight: 500, color: C.ink, letterSpacing: -0.3}}>
				<Rich text={text} boldColor={C.teal} />
			</div>
		</div>
	);
};

// ---- Phone: mock-up left, big caption panel right ---------------------------------------------
const PhoneCaption: React.FC<{text: string | null}> = ({text}) => {
	const frame = useCurrentFrame();
	const p = interpolate(frame, [0, 8], [0, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
	if (!text) return null;
	return (
		<div style={{fontFamily: INTER, fontSize: 68, fontWeight: 500, lineHeight: 1.15, color: C.ink, letterSpacing: -1, opacity: p, transform: `translateY(${(1 - p) * 18}px)`}}>
			<Rich text={text} boldColor={C.teal} />
		</div>
	);
};

const PhoneLayout: React.FC<{n: number; title: string; children: React.ReactNode; beats: {from: number; dur: number; caption: string | null}[]}> = ({n, title, children, beats}) => (
	<AbsoluteFill>
		<Phone style={{position: 'absolute', left: 330, top: 100}}>{children}</Phone>
		<div style={{position: 'absolute', left: 960, top: 290, width: 800}}>
			<Eyebrow>Chapter {n}</Eyebrow>
			<div style={{fontFamily: PLAYFAIR, fontSize: 46, fontWeight: 500, color: C.ink, marginTop: 14, lineHeight: 1.2}}>{title}</div>
			<div style={{width: 72, height: 4, borderRadius: 2, background: C.teal, opacity: 0.5, margin: '40px 0 44px'}} />
			<div style={{position: 'relative'}}>
				{beats.map((b) => (
					<Sequence key={b.from} from={b.from} durationInFrames={b.dur} layout="none">
						<PhoneCaption text={b.caption} />
					</Sequence>
				))}
			</div>
		</div>
	</AbsoluteFill>
);

const Run: React.FC<{seg: Extract<Seg, {kind: 'run'}>; n: number; title: string}> = ({seg, n, title}) => {
	const frame = useCurrentFrame();
	const o = seg.fade ? fadeIn(frame) : 1;
	if (seg.device === 'P')
		return (
			<AbsoluteFill style={{opacity: o}}>
				<PhoneLayout n={n} title={title} beats={seg.beats}>
					<Footage seg={seg} w={PHONE_SCREEN.w} h={PHONE_SCREEN.h} />
				</PhoneLayout>
			</AbsoluteFill>
		);
	return (
		<AbsoluteFill style={{opacity: o}}>
			<Browser>
				<Footage seg={seg} w={VW} h={VH} />
			</Browser>
			{seg.beats.map((b) =>
				b.caption ? (
					<Sequence key={b.id} from={b.from} durationInFrames={b.dur}>
						<LowerThird text={b.caption} />
					</Sequence>
				) : null,
			)}
		</AbsoluteFill>
	);
};

// ---- Intro / outro -----------------------------------------------------------------------------
const Intro: React.FC<{n: number; title: string}> = ({n, title}) => {
	const frame = useCurrentFrame();
	const a = useIn(2);
	const b = useIn(7);
	const out = interpolate(frame, [INTRO - 7, INTRO], [1, 0], {extrapolateLeft: 'clamp'});
	return (
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: out}}>
			<Sprout size={110} delay={0} />
			<Eyebrow style={{marginTop: 22, opacity: a, transform: `translateY(${(1 - a) * 20}px)`}}>Chapter {n}</Eyebrow>
			<div style={{fontFamily: PLAYFAIR, fontWeight: 500, fontSize: 92, color: C.ink, marginTop: 18, letterSpacing: -1, textAlign: 'center', maxWidth: 1500, lineHeight: 1.1, opacity: b, transform: `translateY(${(1 - b) * 30}px)`}}>{title}</div>
		</AbsoluteFill>
	);
};

const Outro: React.FC<{next: string | null}> = ({next}) => {
	const a = useIn(0);
	const b = useIn(4);
	return (
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
			{next ? (
				<>
					<Eyebrow style={{opacity: a, transform: `translateY(${(1 - a) * 16}px)`}}>Next</Eyebrow>
					<div style={{fontFamily: PLAYFAIR, fontWeight: 500, fontSize: 72, color: C.ink, marginTop: 18, opacity: b, transform: `translateY(${(1 - b) * 24}px)`, textAlign: 'center', maxWidth: 1500}}>{next}</div>
				</>
			) : (
				<>
					<Sprout size={96} />
					<div style={{fontFamily: PLAYFAIR, fontWeight: 500, fontSize: 84, color: C.ink, marginTop: 18, opacity: b}}>You're all set</div>
				</>
			)}
		</AbsoluteFill>
	);
};

// ---- Chrome: header label + progress -------------------------------------------------------------
const Header: React.FC<{n: number; title: string}> = ({n, title}) => (
	<div style={{position: 'absolute', top: 0, left: FX, width: VW, height: TOP, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
		<div style={{display: 'flex', alignItems: 'center', gap: 12}}>
			<LeafMark size={32} />
			<span style={{fontFamily: PLAYFAIR, fontSize: 24, fontWeight: 600, color: C.ink}}>Local Plant Supply</span>
		</div>
		<div style={{fontFamily: INTER, fontSize: 19, color: C.muted, fontWeight: 500}}>
			<span style={{color: C.teal, fontWeight: 600}}>{n} / {chapters.length}</span> · {title}
		</div>
	</div>
);

const Progress: React.FC<{dur: number}> = ({dur}) => {
	const frame = useCurrentFrame();
	return (
		<div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 6, background: C.tint}}>
			<div style={{height: '100%', width: `${(frame / (dur - 1)) * 100}%`, background: C.teal}} />
		</div>
	);
};

// ---- Audio ----------------------------------------------------------------------------------------
const Sfx: React.FC<{f: number; name: string; vol: number}> = ({f, name, vol}) => (
	<Sequence from={f} durationInFrames={75} layout="none">
		<Audio src={staticFile(`sfx/${name}.wav`)} volume={vol} />
	</Sequence>
);

const Music: React.FC<{data: ChapterData}> = ({data}) => (
	<Audio
		src={staticFile('sfx/bed.wav')}
		loop
		allowAmplificationDuringRender
		volume={(f) => {
			const fade = Math.min(1, f / 30, (data.dur - f) / 30);
			// 0..1 duck amount with 6-frame ramps around each narration line.
			const duck = Math.max(0, ...data.vo.map((v) => Math.min(1, (f - v.f + 6) / 6, (v.f + v.dur + 6 - f) / 6)));
			return Math.max(0, fade) * lerp(MUSIC.base, MUSIC.ducked, duck);
		}}
	/>
);

// ---- Chapter -----------------------------------------------------------------------------------------
export const Chapter: React.FC<{data: ChapterData}> = ({data}) => {
	const {n, title} = data;
	return (
		<AbsoluteFill style={{background: C.bg}}>
			<Sequence durationInFrames={INTRO}>
				<Intro n={n} title={title} />
			</Sequence>
			<Sequence from={INTRO} durationInFrames={data.dur - INTRO - OUTRO} layout="none">
				<Header n={n} title={title} />
			</Sequence>
			{data.segs.map((s) => (
				<Sequence key={s.from} from={s.from} durationInFrames={s.dur}>
					{s.kind === 'run' ? <Run seg={s} n={n} title={title} /> : <CardBeat beat={s.beat} />}
					{s.kind === 'run' && s.sfx.map((x, i) => <Sfx key={i} {...x} />)}
				</Sequence>
			))}
			<Sequence from={data.dur - OUTRO}>
				<Outro next={data.next} />
			</Sequence>
			{data.vo.map((v) => (
				<Sequence key={v.id} from={v.f} durationInFrames={v.dur + 15} layout="none">
					<Audio src={staticFile(`vo/${v.id}.wav`)} volume={v.gain} allowAmplificationDuringRender />
				</Sequence>
			))}
			{data.sfx.map((x, i) => (
				<Sfx key={i} {...x} />
			))}
			<Music data={data} />
			<Progress dur={data.dur} />
		</AbsoluteFill>
	);
};

export const All: React.FC<{chapters: ChapterData[]}> = ({chapters: list}) => {
	let from = 0;
	return (
		<AbsoluteFill style={{background: C.bg}}>
			{list.map((d) => {
				const el = (
					<Sequence key={d.n} from={from} durationInFrames={d.dur}>
						<Chapter data={d} />
					</Sequence>
				);
				from += d.dur;
				return el;
			})}
		</AbsoluteFill>
	);
};
