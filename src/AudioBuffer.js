class AudioBuffer {
  constructor(sampleRate = 44100) {
    this.sampleRate = sampleRate;
    // Calculate buffer size for 8 bars at 40 BPM (our worst case)
    const secondsPerBeat = 60 / 40; // 1.5 seconds per beat at 40 BPM
    const totalBeats = 8 * 4; // 8 bars * 4 beats
    const totalSeconds = secondsPerBeat * totalBeats;
    this.bufferSize = Math.ceil(totalSeconds * sampleRate);
    
    // Create the buffer
    this.buffer = new Float32Array(this.bufferSize);
    
    // Initialize pointers
    this.writeHead = 0;
    this.readHead = 0;
    this.isRecording = false;
  }

  // Write audio data to the buffer
  write(data) {
    if (!this.isRecording) return;

    for (let i = 0; i < data.length; i++) {
      this.buffer[this.writeHead] = data[i];
      this.writeHead = (this.writeHead + 1) % this.bufferSize;
    }
  }

  // Read audio data from the buffer
  read(length) {
    const result = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      result[i] = this.buffer[this.readHead];
      this.readHead = (this.readHead + 1) % this.bufferSize;
    }
    return result;
  }

  // Start recording
  start() {
    this.isRecording = true;
    this.writeHead = 0;
    this.readHead = 0;
  }

  // Stop recording
  stop() {
    this.isRecording = false;
  }

  // Clear the buffer
  clear() {
    this.buffer.fill(0);
    this.writeHead = 0;
    this.readHead = 0;
  }

  // Get the current buffer size
  getSize() {
    return this.bufferSize;
  }

  // Get the current write position
  getWritePosition() {
    return this.writeHead;
  }

  // Get the current read position
  getReadPosition() {
    return this.readHead;
  }
}

export default AudioBuffer; 