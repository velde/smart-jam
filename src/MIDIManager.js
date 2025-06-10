class MIDIManager {
  constructor() {
    this.outputs = new Map();
    this.routes = new Map();
    this.isConnected = false;
  }

  async connect() {
    try {
      const midiAccess = await navigator.requestMIDIAccess();
      this.isConnected = true;
      
      // Store all available outputs
      if (midiAccess.outputs) {
        for (const output of midiAccess.outputs.values()) {
          this.outputs.set(output.id, output);
          console.log('MIDI Output:', output.name, output.id);
        }
      }

      // Set up input handlers if needed
      if (midiAccess.inputs) {
        for (const input of midiAccess.inputs.values()) {
          if (input) {
            input.onmidimessage = this.handleMIDIMessage.bind(this);
            console.log('MIDI Input:', input.name, input.id);
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Error connecting to MIDI:', error);
      this.isConnected = false;
      return false;
    }
  }

  handleMIDIMessage(event) {
    // Handle incoming MIDI messages if needed
    console.log('MIDI Message:', event.data);
  }

  sendNoteOn(note, velocity, channel = 0, outputId = null) {
    if (!this.isConnected) return;
    
    const message = [0x90 + channel, note, velocity];
    this.sendMessage(message, outputId);
  }

  sendNoteOff(note, channel = 0, outputId = null) {
    if (!this.isConnected) return;
    
    const message = [0x80 + channel, note, 0];
    this.sendMessage(message, outputId);
  }

  sendMessage(message, outputId = null) {
    if (!this.isConnected) return;
    
    if (outputId) {
      // Send to specific output
      const output = this.outputs.get(outputId);
      if (output) {
        output.send(message);
      }
    } else {
      // Send to all outputs
      for (const output of this.outputs.values()) {
        output.send(message);
      }
    }
  }

  // Send a sequence of notes
  sendSequence(notes, options = {}) {
    const {
      channel = 0,
      outputId = null,
      velocity = 100,
      duration = 500, // in milliseconds
      delay = 0
    } = options;

    notes.forEach((note, index) => {
      setTimeout(() => {
        this.sendNoteOn(note, velocity, channel, outputId);
        setTimeout(() => {
          this.sendNoteOff(note, channel, outputId);
        }, duration);
      }, index * delay);
    });
  }

  // Get list of available outputs
  getOutputs() {
    return Array.from(this.outputs.entries()).map(([id, output]) => ({
      id,
      name: output.name || `MIDI Output ${id}`
    }));
  }

  disconnect() {
    this.outputs.clear();
    this.isConnected = false;
  }
}

export default MIDIManager; 