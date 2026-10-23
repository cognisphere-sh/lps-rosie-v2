import React from 'react';
import {Composition} from 'remotion';
import {All, Chapter} from './Chapter';
import {ChapterData, FPS, buildChapter, chapters, loadMarks, withVoiceGains} from './data';

const load = async (n: number) => withVoiceGains(buildChapter(n, await loadMarks(n)));
const base = {fps: FPS, width: 1920, height: 1080};

export const Root: React.FC = () => (
	<>
		{chapters.map((c) => (
			<Composition
				key={c.n}
				id={`ch${c.n}`}
				component={Chapter}
				{...base}
				durationInFrames={1}
				defaultProps={{data: null as unknown as ChapterData}}
				calculateMetadata={async () => {
					const data = await load(c.n);
					return {durationInFrames: data.dur, props: {data}};
				}}
			/>
		))}
		<Composition
			id="all"
			component={All}
			{...base}
			durationInFrames={1}
			defaultProps={{chapters: [] as ChapterData[]}}
			calculateMetadata={async () => {
				const list = await Promise.all(chapters.map((c) => load(c.n)));
				return {durationInFrames: list.reduce((a, d) => a + d.dur, 0), props: {chapters: list}};
			}}
		/>
	</>
);
