import React from 'react';
import {AbsoluteFill, Audio, Easing, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Beat} from './data';
import {C, Eyebrow, INTER, PLAYFAIR, Phone, PHONE_SCREEN, Rich, Sprout, SproutRow, useIn} from './ui';

const Sfx: React.FC<{at: number; name: string; vol: number}> = ({at, name, vol}) => (
	<Sequence from={at} durationInFrames={75} layout="none">
		<Audio src={staticFile(`sfx/${name}.wav`)} volume={vol} />
	</Sequence>
);

// `cover` hides the chapter header (for the wordmark cards, which would otherwise show the name twice).
const Center: React.FC<{children: React.ReactNode; cover?: boolean; style?: React.CSSProperties}> = ({children, cover, style}) => {
	const frame = useCurrentFrame();
	const o = interpolate(frame, [0, 8], [0, 1], {extrapolateRight: 'clamp'});
	return (
		<AbsoluteFill style={{background: cover ? C.bg : undefined}}>
			<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: o, ...style}}>{children}</AbsoluteFill>
		</AbsoluteFill>
	);
};

const Rise: React.FC<{delay?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({delay = 0, children, style}) => {
	const p = useIn(delay);
	return <div style={{opacity: Math.min(p, 1), transform: `translateY(${(1 - p) * 26}px)`, ...style}}>{children}</div>;
};

const Wordmark: React.FC<{size?: number}> = ({size = 132}) => (
	<div style={{fontFamily: PLAYFAIR, fontWeight: 500, fontSize: size, color: C.ink, letterSpacing: -2, lineHeight: 1}}>Local Plant Supply</div>
);

const TitleCard: React.FC = () => (
	<Center cover>
		<Rise>
			<Eyebrow style={{textAlign: 'center'}}>Partner portal</Eyebrow>
		</Rise>
		<Rise delay={4} style={{marginTop: 28}}>
			<Wordmark />
		</Rise>
		<div style={{marginTop: 54}}>
			<SproutRow delay={10} />
		</div>
	</Center>
);

const EndCard: React.FC = () => (
	<Center cover>
		<Rise>
			<Wordmark size={112} />
		</Rise>
		<div style={{marginTop: 46}}>
			<SproutRow delay={6} size={56} />
		</div>
		<Rise delay={18} style={{marginTop: 54, fontFamily: INTER, fontSize: 40, color: C.muted}}>
			Questions? Message us in <strong style={{color: C.teal, fontWeight: 600}}>Chat</strong>.
		</Rise>
		<Sfx at={20} name="chime" vol={0.4} />
	</Center>
);

const TipsCard: React.FC = () => (
	<Center>
		<Sprout size={110} />
		<Rise delay={4} style={{marginTop: 26}}>
			<Eyebrow style={{textAlign: 'center'}}>A few last things</Eyebrow>
		</Rise>
		<Rise delay={8} style={{fontFamily: PLAYFAIR, fontWeight: 500, fontSize: 120, color: C.ink, marginTop: 18, letterSpacing: -2}}>
			Handy tips
		</Rise>
	</Center>
);

// 1.3: the hand-over message from LPS, with a highlight sweeping the three login rows.
const ROWS: [string, string][] = [
	['', 'Hill Country Growers — your Local Plant Supply partner portal'],
	['Sign in', '[your sign-in link]'],
	['Username', 'jordan'],
	['Password', 'k7mq-x2pn-r4tz-w8hd'],
	['', 'Availability requests from us arrive here; answer them and press Submit availability.'],
];
const MessageCard: React.FC<{caption: string | null}> = ({caption}) => {
	const frame = useCurrentFrame();
	const sweepAt = [0, 26, 70, 114, 0];
	return (
		<Center>
			<Rise>
				<Eyebrow style={{textAlign: 'center', marginBottom: 34}}>{caption}</Eyebrow>
			</Rise>
			<Rise delay={3}>
				<div style={{width: 1180, background: C.card, borderRadius: 28, padding: '34px 44px 40px', boxShadow: '0 40px 90px -40px rgba(20,50,35,0.35), 0 0 0 1px rgba(30,59,40,0.06)'}}>
					<div style={{display: 'flex', alignItems: 'center', gap: 16, marginBottom: 26}}>
						<div style={{width: 52, height: 52, borderRadius: 26, background: C.teal, color: 'white', display: 'grid', placeItems: 'center', fontFamily: INTER, fontWeight: 700, fontSize: 17}}>LPS</div>
						<div style={{fontFamily: INTER}}>
							<div style={{fontSize: 22, fontWeight: 600, color: C.ink}}>Your Local Plant Supply contact</div>
							<div style={{fontSize: 18, color: C.muted}}>Message · just now</div>
						</div>
					</div>
					{ROWS.map(([label, value], i) => {
						const sweep = sweepAt[i] ? interpolate(frame, [sweepAt[i], sweepAt[i] + 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)}) : 0;
						return (
							<div key={i} style={{position: 'relative', padding: '12px 18px', margin: '0 -18px', fontFamily: INTER, fontSize: i === 0 ? 27 : 29, lineHeight: 1.35, color: C.ink, fontWeight: i === 0 ? 600 : 400}}>
								<div style={{position: 'absolute', left: 0, top: 4, bottom: 4, width: `${sweep * 100}%`, background: C.secondary, borderRadius: 12, borderLeft: sweep ? `4px solid ${C.teal}` : undefined}} />
								<span style={{position: 'relative'}}>
									{label ? <strong style={{fontWeight: 600}}>{label}: </strong> : null}
									<span style={{fontFamily: label === 'Password' ? 'ui-monospace, Menlo, monospace' : INTER, color: label ? C.teal : i === 4 ? C.muted : C.ink}}>{value}</span>
								</span>
							</div>
						);
					})}
				</div>
			</Rise>
			{sweepAt.filter(Boolean).map((at) => (
				<Sfx key={at} at={at} name="pop" vol={0.22} />
			))}
		</Center>
	);
};

// 9.7: a phone home screen; the "Plant Supply" icon is tapped, the portal opens, the Alerts badge pulses.
const HomeScreen: React.FC<{caption: string | null}> = ({caption}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const TAP = 30, OPEN = 40, BADGE = 58;
	const press = interpolate(frame, [TAP - 3, TAP, TAP + 6], [1, 0.88, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const ripple = interpolate(frame, [TAP, TAP + 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const open = spring({frame: frame - OPEN, fps, config: {damping: 20}});
	const badge = spring({frame: frame - BADGE, fps, config: {damping: 9}});
	const pulse = frame > BADGE + 12 ? 1 + 0.12 * Math.max(0, Math.sin(((frame - BADGE - 12) / fps) * Math.PI * 2)) : 1;
	const W = PHONE_SCREEN.w;
	const icon = 92;
	const pastel = ['#DCE6E0', '#E9E2D8', '#DDE3EC', '#ECE0E3', '#E2E8D8', '#E4DEEC'];
	const iconPos = {col: 1, row: 2};
	const gap = (W - icon * 4) / 5;
	const ix = gap + iconPos.col * (icon + gap);
	const iy = 130 + iconPos.row * (icon + 54);
	return (
		<Center style={{paddingTop: 76}}>
			<div style={{display: 'flex', alignItems: 'center', gap: 150}}>
				<Phone>
					<div style={{position: 'absolute', inset: 0, background: C.accent}}>
						<div style={{position: 'absolute', top: 22, left: 0, right: 0, textAlign: 'center', fontFamily: INTER, fontWeight: 600, fontSize: 20, color: C.ink}}>9:41</div>
						{Array.from({length: 16}, (_, k) => {
							const col = k % 4, row = Math.floor(k / 4);
							const mine = col === iconPos.col && row === iconPos.row;
							return (
								<div key={k} style={{position: 'absolute', left: gap + col * (icon + gap), top: 130 + row * (icon + 54), width: icon, textAlign: 'center'}}>
									<div style={{width: icon, height: icon, borderRadius: 24, background: mine ? C.teal : pastel[k % pastel.length], display: 'grid', placeItems: 'center', transform: mine ? `scale(${press})` : undefined, boxShadow: mine ? '0 10px 24px -10px rgba(8,127,140,0.6)' : undefined}}>
										{mine ? <Sprout size={64} color="white" /> : null}
									</div>
									<div style={{fontFamily: INTER, fontSize: 15, marginTop: 8, color: C.ink, opacity: mine ? 1 : 0}}>Plant Supply</div>
								</div>
							);
						})}
						<div style={{position: 'absolute', left: ix + icon / 2 - 70, top: iy + icon / 2 - 70, width: 140, height: 140, borderRadius: 70, border: `4px solid rgba(255,255,255,${0.9 * (1 - ripple)})`, transform: `scale(${0.4 + ripple})`, opacity: frame >= TAP ? 1 : 0}} />
					</div>
					{/* the portal opening from the icon */}
					<div style={{position: 'absolute', inset: 0, background: C.bg, transformOrigin: `${ix + icon / 2}px ${iy + icon / 2}px`, transform: `scale(${open})`, opacity: Math.min(1, open * 1.5), borderRadius: 56 * (1 - open)}}>
						<div style={{padding: '70px 26px 0', fontFamily: INTER}}>
							<div style={{fontSize: 30, fontWeight: 700, color: C.ink}}>Availability Requests</div>
							{[0, 1, 2].map((k) => (
								<div key={k} style={{marginTop: k ? 16 : 26, background: C.card, borderRadius: 18, padding: 20, boxShadow: '0 0 0 1px rgba(30,59,40,0.07)'}}>
									<div style={{height: 16, width: '70%', borderRadius: 8, background: C.line}} />
									<div style={{height: 12, width: '45%', borderRadius: 6, background: C.tint, marginTop: 12}} />
								</div>
							))}
						</div>
						<div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 96, background: C.card, borderTop: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-around', alignItems: 'center', fontFamily: INTER, fontSize: 15, color: C.muted}}>
							{['Requests', 'Orders', 'Chat', 'Alerts'].map((t) => (
								<div key={t} style={{position: 'relative', textAlign: 'center', color: t === 'Alerts' ? C.teal : C.muted, fontWeight: t === 'Alerts' ? 600 : 400}}>
									<div style={{width: 26, height: 26, borderRadius: 8, margin: '0 auto 6px', border: `2.5px solid currentColor`}} />
									{t}
									{t === 'Alerts' ? (
										<div style={{position: 'absolute', top: -10, right: -4, width: 26, height: 26, borderRadius: 13, background: '#E5822B', color: 'white', fontSize: 15, fontWeight: 700, display: 'grid', placeItems: 'center', transform: `scale(${badge * pulse})`}}>1</div>
									) : null}
								</div>
							))}
						</div>
					</div>
				</Phone>
				<div style={{width: 640, fontFamily: INTER, fontSize: 68, fontWeight: 500, lineHeight: 1.15, color: C.ink, letterSpacing: -1}}>
					<Rise delay={4}>{caption ? <Rich text={caption} boldColor={C.teal} /> : null}</Rise>
				</div>
			</div>
			<Sfx at={TAP} name="click" vol={0.5} />
			<Sfx at={BADGE} name="ding" vol={0.45} />
		</Center>
	);
};

const Generic: React.FC<{beat: Beat}> = ({beat}) => (
	<Center>
		<div style={{width: 1400, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
			<Sprout size={80} />
			{beat.caption ? (
				<>
					<Rise delay={3} style={{fontFamily: PLAYFAIR, fontWeight: 500, fontSize: 92, color: C.ink, marginTop: 26, letterSpacing: -1.5, lineHeight: 1.1}}>
						<Rich text={beat.caption} boldColor={C.teal} />
					</Rise>
					<Rise delay={8} style={{fontFamily: INTER, fontSize: 36, color: C.muted, marginTop: 34, lineHeight: 1.4, maxWidth: 1100}}>
						{beat.text}
					</Rise>
				</>
			) : (
				<Rise delay={3} style={{fontFamily: PLAYFAIR, fontWeight: 500, fontSize: 72, color: C.ink, marginTop: 30, letterSpacing: -1, lineHeight: 1.2}}>
					{beat.text}
				</Rise>
			)}
		</div>
	</Center>
);

export const CardBeat: React.FC<{beat: Beat}> = ({beat}) => {
	if (beat.id === '1.1') return <TitleCard />;
	if (beat.id === '1.3') return <MessageCard caption={beat.caption} />;
	if (beat.id === '9.1') return <TipsCard />;
	if (beat.id === '9.7') return <HomeScreen caption={beat.caption} />;
	if (beat.id === '9.8') return <EndCard />;
	return <Generic beat={beat} />;
};
