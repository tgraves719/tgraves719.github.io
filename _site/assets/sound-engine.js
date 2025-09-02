// Sound Engine Module
// Handles all audio functionality for the Graves site

import { AUDIO_CONFIG } from './audio-config.js';

export class SoundEngine {
  constructor() {
    this.synths = {};
    this.effects = {};
    this.melodySequence = null;
    this.isSetup = false;
    this.isEnabled = false;
    this.currentToneRowIndex = 0;
    this.wholeToneStartIndex = 0;
    this.wholeToneDirection = 1;
  }

  async setup() {
    if (this.isSetup) return;
    
    try {
      // Start Tone.js context
      await Tone.start();
      
      // Create effects chain
      this.effects.reverb = new Tone.Reverb(AUDIO_CONFIG.effects.reverb.roomSize).toDestination();
      this.effects.reverb.wet.value = AUDIO_CONFIG.effects.reverb.wetness;
      
      this.effects.filter = new Tone.AutoFilter(AUDIO_CONFIG.effects.filter.frequency)
        .connect(this.effects.reverb).start();
      
      // Create synths based on config
      this.synths.hover = new Tone.Synth({
        oscillator: { type: AUDIO_CONFIG.synths.hover.type },
        envelope: AUDIO_CONFIG.synths.hover.envelope,
        volume: AUDIO_CONFIG.synths.hover.volume
      }).connect(this.effects.reverb);
      
      this.synths.click = new Tone.Synth({
        oscillator: { type: AUDIO_CONFIG.synths.click.type },
        envelope: AUDIO_CONFIG.synths.click.envelope,
        volume: AUDIO_CONFIG.synths.click.volume
      }).connect(this.effects.reverb);
      
      this.synths.highClick = new Tone.Synth({
        oscillator: { type: AUDIO_CONFIG.synths.highClick.type },
        envelope: AUDIO_CONFIG.synths.highClick.envelope,
        volume: AUDIO_CONFIG.synths.highClick.volume
      }).connect(this.effects.reverb);
      
      this.synths.pad = new Tone.PolySynth(Tone.AMSynth, {
        envelope: AUDIO_CONFIG.synths.pad.envelope,
        volume: AUDIO_CONFIG.synths.pad.volume
      }).connect(this.effects.filter);
      
      this.synths.melody = new Tone.Synth({
        oscillator: { type: AUDIO_CONFIG.synths.melody.type },
        envelope: AUDIO_CONFIG.synths.melody.envelope,
        volume: AUDIO_CONFIG.synths.melody.volume
      }).connect(this.effects.filter);
      
      this.synths.loading = new Tone.FMSynth({
        harmonicity: AUDIO_CONFIG.synths.loading.harmonicity,
        modulationIndex: AUDIO_CONFIG.synths.loading.modulationIndex,
        envelope: AUDIO_CONFIG.synths.loading.envelope,
        volume: AUDIO_CONFIG.synths.loading.volume
      }).connect(this.effects.reverb);
      
      this.isSetup = true;
      console.log('🎵 Sound Engine initialized');
      
    } catch (error) {
      console.error('❌ Sound Engine setup failed:', error);
    }
  }

  enable() {
    if (!this.isSetup) {
      console.warn('Sound engine not setup yet');
      return;
    }
    
    this.isEnabled = true;
    Tone.Destination.mute = false;
    this.startSoundscape();
    document.body.classList.add('sound-is-on');
    console.log('🔊 Sound enabled');
  }

  disable() {
    this.isEnabled = false;
    if (this.isSetup) {
      Tone.Destination.mute = true;
      this.stopSoundscape();
    }
    document.body.classList.remove('sound-is-on');
    console.log('🔇 Sound disabled');
  }

  toggle() {
    if (this.isEnabled) {
      this.disable();
    } else {
      this.enable();
    }
    return this.isEnabled;
  }

  startSoundscape() {
    if (!this.isEnabled || !this.isSetup) return;
    
    // Start ambient pad tones
    const now = Tone.now();
    this.synths.pad.triggerAttackRelease(['A2', 'C3', 'E3', 'G3'], AUDIO_CONFIG.timing.padNoteLength, now);
    this.synths.pad.triggerAttack(['D2', 'F#2', 'A2', 'C3'], now + Tone.Time(AUDIO_CONFIG.timing.padNoteLength).toSeconds());
    
    // Start ambient hover tone
    this.synths.hover.triggerAttack('D2');
    
    Tone.Transport.start();
    this.setMelodyForPage('hero');
  }

  stopSoundscape() {
    if (!this.isSetup) return;
    
    this.synths.pad.releaseAll();
    this.synths.hover.volume.rampTo(-60, 0.1);
    
    if (this.melodySequence) {
      this.melodySequence.stop().dispose();
      this.melodySequence = null;
    }
    
    Tone.Transport.stop();
  }

  setMelodyForPage(pageId, visualQueue = []) {
    if (!this.isEnabled || !this.isSetup) return;
    
    // Clean up existing sequence
    if (this.melodySequence) {
      this.melodySequence.stop().dispose();
      this.melodySequence = null;
    }
    
    let notes;
    
    if (pageId === 'work' || pageId === 'hero') {
      // Use tone rows for main pages
      notes = AUDIO_CONFIG.TONE_ROWS[this.currentToneRowIndex];
    } else {
      // Use whole tone scales for sub-pages
      const startNoteName = AUDIO_CONFIG.CHROMATIC_SCALE[this.wholeToneStartIndex];
      const scale = AUDIO_CONFIG.WHOLE_TONE_SCALES[0].includes(startNoteName) 
        ? AUDIO_CONFIG.WHOLE_TONE_SCALES[0] 
        : AUDIO_CONFIG.WHOLE_TONE_SCALES[1];
      
      const startIndexInScale = scale.indexOf(startNoteName);
      notes = [];
      
      for (let i = 0; i < 12; i++) {
        const step = i < 6 ? i : 10 - i;
        const noteIndex = (startIndexInScale + step + scale.length) % scale.length;
        const noteBase = scale[noteIndex];
        const octave = (i < 6 || i === 10) ? '5' : '4';
        notes.push(noteBase + octave);
      }
      
      // Update whole tone progression
      this.wholeToneStartIndex += this.wholeToneDirection;
      if (this.wholeToneStartIndex >= 11) {
        this.wholeToneDirection = -1;
        this.wholeToneStartIndex = 11;
      } else if (this.wholeToneStartIndex <= 0) {
        this.wholeToneDirection = 1;
        this.wholeToneStartIndex = 0;
      }
    }
    
    // Create new sequence
    this.melodySequence = new Tone.Sequence((time, note) => {
      this.synths.melody.triggerAttackRelease(note, AUDIO_CONFIG.timing.melodyNoteLength, time);
      
      // Queue visual effects if provided
      if (visualQueue) {
        Tone.Draw.schedule(() => {
          visualQueue.push(note);
        }, time);
      }
    }, notes, AUDIO_CONFIG.timing.sequenceInterval).start(0);
    
    this.melodySequence.loop = true;
  }

  playSound(synthName, note, duration = '0.5') {
    if (!this.isEnabled || !this.isSetup) return;
    
    if (this.synths[synthName]) {
      this.synths[synthName].triggerAttackRelease(note, duration);
    }
  }

  // Convenience methods for common sounds
  playHoverSound() {
    if (this.synths.hover && this.isEnabled) {
      this.synths.hover.volume.rampTo(AUDIO_CONFIG.synths.hover.volume + 36, 0.5);
    }
  }

  stopHoverSound() {
    if (this.synths.hover && this.isEnabled) {
      this.synths.hover.volume.rampTo(-60, 0.8);
    }
  }

  playClickSound() {
    this.playSound('click', 'G3', '0.5');
    this.playSound('highClick', 'G5', '0.5');
  }

  playLoadingSequence(posts = []) {
    if (!this.isEnabled || !posts.length) return;
    
    const now = Tone.now();
    posts.slice(0, 12).forEach((post, i) => {
      const note = post.title.substring(0, 2) + '5';
      this.synths.loading.triggerAttackRelease(note, '16n', now + i * 0.15);
    });
  }

  // Update tone row index for page transitions
  advanceToneRow() {
    this.currentToneRowIndex = (this.currentToneRowIndex + 1) % AUDIO_CONFIG.TONE_ROWS.length;
  }
}