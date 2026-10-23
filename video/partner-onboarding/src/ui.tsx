import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
import {loadFont as loadPlayfair} from '@remotion/google-fonts/PlayfairDisplay';

export const INTER = loadInter('normal', {weights: ['400', '500', '600', '700'], subsets: ['latin']}).fontFamily;
export const PLAYFAIR = loadPlayfair('normal', {weights: ['500', '600'], subsets: ['latin']}).fontFamily;

// The app's light-theme tokens (app/app/globals.css).
export const C = {
	ink: '#1E3B28', // foreground
	bg: '#F9FCF7',
	card: '#FFFFFF',
	teal: '#087F8C', // primary
	secondary: '#E4F1F2',
	secondaryFg: '#17646C',
	tint: '#E6F1E7', // muted
	muted: '#48594B', // muted-foreground
	accent: '#BDE7E5',
	line: '#DDEBDD', // border
};

// `**x**` → bold (optionally tinted).
export const Rich: React.FC<{text: string; boldColor?: string}> = ({text, boldColor}) => (
	<>
		{text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
			i % 2 ? (
				<strong key={i} style={{fontWeight: 700, color: boldColor}}>
					{part}
				</strong>
			) : (
				<React.Fragment key={i}>{part}</React.Fragment>
			),
		)}
	</>
);

// Entrance helper: spring 0→1 starting at `delay` frames.
export const useIn = (delay = 0, damping = 18) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	return spring({frame: frame - delay, fps, config: {damping, mass: 0.7}});
};

export const Eyebrow: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
	<div style={{fontFamily: INTER, fontWeight: 600, fontSize: 24, letterSpacing: 4, textTransform: 'uppercase', color: C.teal, ...style}}>{children}</div>
);

// A sprout that draws itself: stem grows, then two leaves unfurl. `delay` in frames.
export const Sprout: React.FC<{size?: number; delay?: number; color?: string}> = ({size = 96, delay = 0, color = C.teal}) => {
	const frame = useCurrentFrame() - delay;
	const stem = interpolate(frame, [0, 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
	const leafL = useIn(delay + 8, 12);
	const leafR = useIn(delay + 13, 12);
	return (
		<svg width={size} height={size} viewBox="0 0 100 100" style={{overflow: 'visible'}}>
			<path d="M50 92 C50 70 50 58 50 44" stroke={color} strokeWidth={5} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - stem} />
			<g transform={`translate(50 60) rotate(${-8 * (1 - leafL)}) scale(${leafL})`}>
				<path d="M0 0 C-6 -20 -26 -30 -42 -26 C-38 -8 -20 4 0 0 Z" fill={color} opacity={0.9} />
			</g>
			<g transform={`translate(50 46) rotate(${8 * (1 - leafR)}) scale(${leafR})`}>
				<path d="M0 0 C6 -22 26 -34 44 -30 C40 -10 22 4 0 0 Z" fill={color} />
			</g>
			<line x1={30} x2={70} y1={93} y2={93} stroke={color} strokeWidth={4} strokeLinecap="round" opacity={0.35 * stem} />
		</svg>
	);
};

export const SproutRow: React.FC<{count?: number; delay?: number; size?: number}> = ({count = 7, delay = 0, size = 64}) => (
	<div style={{display: 'flex', gap: size * 0.35, alignItems: 'flex-end'}}>
		{Array.from({length: count}, (_, i) => {
			const s = size * (0.72 + 0.28 * Math.sin((i / (count - 1)) * Math.PI));
			return <Sprout key={i} size={s} delay={delay + i * 4} color={i % 2 ? '#3F9A6B' : C.teal} />;
		})}
	</div>
);

export const LeafMark: React.FC<{size?: number}> = ({size = 34}) => (
	<div style={{width: size, height: size, borderRadius: size / 2, background: C.teal, display: 'grid', placeItems: 'center'}}>
		<svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24">
			<path d="M5 19 C5 10 11 5 20 4 C20 13 14 19 5 19 Z M5 19 L13 11" stroke="white" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	</div>
);

// Dark phone mock-up; children fill the screen (390x844 aspect).
export const PHONE_H = 960;
const BEZEL = 16;
export const PHONE_SCREEN = {h: PHONE_H - BEZEL * 2, w: Math.round(((PHONE_H - BEZEL * 2) * 390) / 844)};
export const Phone: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
	<div
		style={{
			width: PHONE_SCREEN.w + BEZEL * 2,
			height: PHONE_H,
			borderRadius: 72,
			background: '#17191A',
			padding: BEZEL,
			boxShadow: '0 40px 80px -30px rgba(20,40,30,0.35), 0 0 0 2px #2A2D2E inset',
			...style,
		}}
	>
		<div style={{position: 'relative', width: PHONE_SCREEN.w, height: PHONE_SCREEN.h, borderRadius: 56, overflow: 'hidden', background: 'white'}}>{children}</div>
	</div>
);
