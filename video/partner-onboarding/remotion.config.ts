import {Config} from '@remotion/cli/config';

Config.setEntryPoint('src/index.ts');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
// ponytail: fixed port; localhost:3000 is often taken by another dev server that Remotion's free-port probe misses.
Config.setPort(3399);
// The bundled headless shell never fires requestAnimationFrame on this macOS; Chrome for Testing works.
Config.setChromeMode('chrome-for-testing');
