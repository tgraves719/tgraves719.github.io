// Audio Configuration
// Edit these settings to customize the sound experience

export const AUDIO_CONFIG = {
  // Master volume settings
  masterVolume: -10,
  
  // Synth configurations - easy to edit!
  synths: {
    hover: {
      type: 'fatsine2',
      volume: -24,
      envelope: {
        attack: 0.1,
        decay: 0.2,
        sustain: 0.3,
        release: 0.8
      }
    },
    
    click: {
      type: 'fatsine4', 
      volume: -10,
      envelope: {
        attack: 0.01,
        decay: 0.1,
        sustain: 0,
        release: 0.3
      }
    },
    
    highClick: {
      type: 'sine',
      volume: -14,
      envelope: {
        attack: 0.01,
        decay: 0.05,
        sustain: 0,
        release: 0.2
      }
    },
    
    pad: {
      type: 'AMSynth',
      volume: -20,
      envelope: {
        attack: 2.0,
        decay: 1.0,
        sustain: 0.8,
        release: 4.0
      }
    },
    
    melody: {
      type: 'triangle8',
      volume: -18,
      envelope: {
        attack: 0.1,
        decay: 0.2,
        sustain: 0.5,
        release: 1.0
      }
    },
    
    loading: {
      type: 'FMSynth',
      volume: -6,
      harmonicity: 2,
      modulationIndex: 10,
      envelope: {
        attack: 0.05,
        decay: 0.1,
        sustain: 0.2,
        release: 0.5
      }
    }
  },
  
  // Effects settings
  effects: {
    reverb: {
      roomSize: 3,
      wetness: 0.4
    },
    
    filter: {
      frequency: "2m", // AutoFilter frequency
      baseFrequency: 400,
      octaves: 2
    }
  },
  
  // Musical scales and notes
  NOTE_COLORS: {
    'C': 0xff2a2a, 'C#': 0xff8000, 'D': 0xffff00, 'D#': 0x40ff00,
    'E': 0x00ffff, 'F': 0x0080ff, 'F#': 0x8000ff, 'G': 0xff00ff,
    'G#': 0xff2a2a, 'A': 0xff8000, 'A#': 0xffff00, 'B': 0x40ff00
  },
  
  CHROMATIC_SCALE: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  
  // Tone rows for different pages
  TONE_ROWS: [
    ['G4', 'F#4', 'A4', 'C#5', 'D#4', 'B4', 'C4', 'E4', 'F4', 'G#4', 'A#4', 'D4'],
    ['A4', 'G#4', 'B4', 'D#5', 'F#4', 'C#4', 'D4', 'F4', 'G4', 'A#4', 'C5', 'E4'],
    ['C4', 'D4', 'B3', 'E4', 'F#4', 'G#4', 'A#4', 'C#5', 'D#5', 'F5', 'G5', 'A5'],
    ['F#4', 'E4', 'G4', 'D#4', 'C#4', 'A#3', 'A3', 'C4', 'D4', 'F4', 'G#4', 'B4'],
    ['D4', 'E4', 'C#4', 'F#4', 'G#4', 'A#4', 'B4', 'D#5', 'F5', 'G5', 'A5', 'C5']
  ],
  
  // Whole tone scales for ambient melodies
  WHOLE_TONE_SCALES: [
    ['C', 'D', 'E', 'F#', 'G#', 'A#'],
    ['C#', 'D#', 'F', 'G', 'A', 'B']
  ],
  
  // Timing settings
  timing: {
    melodyNoteLength: "8n",
    padNoteLength: "4m", 
    sequenceInterval: "4n"
  }
};