/* global mm */
import * as Tone from 'tone';

class MagentaManager {
  constructor() {
    this.model = null;
    this.isInitialized = false;
    this.config = {
      validNoteRange: {
        min: 48, // C3
        max: 83  // B5
      }
    };
  }

  getValidNoteRange() {
    return this.config.validNoteRange;
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    console.log('Initializing Magenta...');
    try {
      // Wait for Magenta to be available
      if (!window.mm) {
        console.log('Waiting for Magenta to load...');
        await new Promise(resolve => {
          const checkMagenta = () => {
            if (window.mm) {
              resolve();
            } else {
              setTimeout(checkMagenta, 100);
            }
          };
          checkMagenta();
        });
      }

      // Initialize the MusicRNN model
      this.model = new mm.MusicRNN(
        'https://storage.googleapis.com/download.magenta.tensorflow.org/' +
        'tfjs_checkpoints/music_rnn/basic_rnn'
      );
      await this.model.initialize();
      this.isInitialized = true;
      console.log('Magenta model initialized');
    } catch (error) {
      console.error('Error initializing Magenta model:', error);
      throw error;
    }
  }

  async generateResponse(notes, temperature = 1.0) {
    if (!this.isInitialized) {
      throw new Error('Magenta not initialized. Please call initialize() first.');
    }

    try {
      console.log('Converting notes to Magenta format...');
      // Filter out notes outside the valid range
      const validNotes = notes.filter(note => {
        const isValid = note.pitch >= this.config.validNoteRange.min && 
                       note.pitch <= this.config.validNoteRange.max;
        if (!isValid) {
          console.log(`Note ${note.pitch} is outside valid range (${this.config.validNoteRange.min}-${this.config.validNoteRange.max})`);
        }
        return isValid;
      });

      if (validNotes.length === 0) {
        console.log('No valid notes to send to Magenta');
        return [];
      }

      // Convert notes to Magenta format
      const magentaNotes = validNotes.map(note => ({
        pitch: note.pitch,
        startTime: note.startTime,
        endTime: note.endTime,
        velocity: 100 // Default velocity
      }));

      // Create a sequence with totalTime
      const sequence = {
        notes: magentaNotes,
        totalTime: Math.max(...magentaNotes.map(n => n.endTime)),
        timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
        tempos: [{ time: 0, qpm: 120 }]
      };
      console.log('Created sequence:', sequence);

      // Quantize the sequence
      console.log('Quantizing sequence...');
      const quantized = mm.sequences.quantizeNoteSequence(sequence, 4);
      console.log('Quantized sequence:', quantized);

      // Generate continuation
      console.log('Generating continuation...');
      const response = await this.model.continueSequence(
        quantized,
        32, // steps
        temperature
      );
      console.log('Got response:', response);

      // Convert response back to our format
      const convertedResponse = response.notes.map(note => {
        // Calculate time based on steps and tempo
        const secondsPerStep = 60 / (120 * 4); // 120 BPM, 4 steps per quarter note
        return {
          pitch: note.pitch,
          startTime: note.quantizedStartStep * secondsPerStep,
          endTime: note.quantizedEndStep * secondsPerStep,
          velocity: note.velocity || 100
        };
      });
      console.log('Converted response:', convertedResponse);

      return convertedResponse;
    } catch (error) {
      console.error('Error in generateResponse:', error);
      throw error;
    }
  }

  async playSequence(notes, synth) {
    if (!synth) {
      synth = new Tone.PolySynth(Tone.Synth).toDestination();
    }

    const now = Tone.now();
    notes.forEach(note => {
      const duration = note.endTime - note.startTime;
      synth.triggerAttackRelease(
        Tone.Frequency(note.pitch, "midi").toNote(),
        duration,
        now + note.startTime,
        note.velocity / 127
      );
    });
  }
}

export default MagentaManager; 