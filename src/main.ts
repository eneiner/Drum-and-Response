import './style.css';
import { mount, register, go } from './ui/router';
import { homeScreen } from './ui/screens/home';
import { challengeScreen } from './ui/screens/challenge';
import { freedomScreen } from './ui/screens/freedom';
import { calibrateScreen } from './ui/screens/calibrate';
import { settingsScreen } from './ui/screens/settings';
import { statsScreen } from './ui/screens/stats';

register('home', homeScreen);
register('challenge', challengeScreen);
register('freedom', freedomScreen);
register('calibrate', calibrateScreen);
register('settings', settingsScreen);
register('stats', statsScreen);

mount(document.getElementById('app')!);

if (import.meta.env.DEV) {
  // Handles for browser tests.
  void Promise.all([import('./audio/engine'), import('./audio/mic')]).then(([e, m]) => {
    Object.assign(globalThis, { __drAudio: e.audio, __drMic: m.mic });
  });
}
go('home');

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support is optional */
    });
  });
}
