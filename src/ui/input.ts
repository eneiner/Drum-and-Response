import { audio } from '../audio/engine';
import { mic, micSupported } from '../audio/mic';
import { saveSettings, settings } from '../storage';
import { modal } from './modal';

let explained = false;

/**
 * Get audio (and the mic, in mic mode) ready. Call from a tap handler.
 * Returns false if the player backed out.
 */
export async function prepareInput(): Promise<boolean> {
  await audio.unlock();
  await audio.loadKit(settings.kit);
  if (settings.inputMode === 'tap') return true;

  if (!micSupported()) {
    await modal('Microphone not available', ['This browser can\'t listen for claps. You can still play by tapping the screen.'], [
      { label: 'Use screen taps', primary: true, value: 'tap' },
    ]);
    settings.inputMode = 'tap';
    saveSettings();
    return true;
  }

  if (!mic.active && !explained) {
    const choice = await modal(
      'Let\'s hear you clap',
      [
        'Drum & Response listens through your microphone to hear your claps and taps.',
        'Sound is analyzed on your phone and never recorded or sent anywhere.',
        'Tip: headphones help, so the mic only hears you.',
      ],
      [
        { label: 'Tap screen instead', value: 'tap' },
        { label: 'Allow microphone', primary: true, value: 'mic' },
      ],
    );
    explained = true;
    if (choice === 'tap') {
      settings.inputMode = 'tap';
      saveSettings();
      return true;
    }
  }

  try {
    await mic.start(settings.sensitivity);
    return true;
  } catch {
    const choice = await modal(
      'Microphone blocked',
      ['We couldn\'t use the microphone. Check your browser\'s site settings, or play by tapping the screen.'],
      [
        { label: 'Cancel', value: 'cancel' },
        { label: 'Use screen taps', primary: true, value: 'tap' },
      ],
    );
    if (choice === 'tap') {
      settings.inputMode = 'tap';
      saveSettings();
      return true;
    }
    return false;
  }
}

export function currentOffset(): number {
  return settings.inputMode === 'mic' ? settings.micOffset : settings.tapOffset;
}
