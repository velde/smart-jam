// MVP: Real-Time Music Mate (React + Tone.js + Pitchy)
// This version includes a metronome, mic input, pitch detection, and basic chord logging

import React, { useState, useRef, useEffect } from "react";
import * as Tone from "tone";
import { PitchDetector } from "pitchy";
import MIDIManager from './MIDIManager';
import MusicGrid from './components/MusicGrid';
import AudioBuffer from './AudioBuffer';
import MidiWriter from 'midi-writer-js';

// Add note conversion utilities
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function frequencyToNote(frequency) {
  if (!frequency) return { note: '-', octave: '-' };
  const a4 = 440;
  const c0 = a4 * Math.pow(2, -4.75);
  const h = Math.round(12 * Math.log2(frequency / c0));
  const octave = Math.floor(h / 12);
  const noteIndex = h % 12;
  return {
    note: NOTE_NAMES[noteIndex],
    octave: octave
  };
}

export default function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [pitchHz, setPitchHz] = useState(null);
  const [error, setError] = useState(null);
  const [browserInfo, setBrowserInfo] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);
  const [isDetectingSound, setIsDetectingSound] = useState(false);
  const [availableMics, setAvailableMics] = useState([]);
  const [selectedMic, setSelectedMic] = useState(null);
  const [currentNote, setCurrentNote] = useState({ note: '-', octave: '-' });
  const [waveformData, setWaveformData] = useState(new Float32Array(1024));
  const canvasRef = useRef(null);
  const [isAudibleClick, setIsAudibleClick] = useState(false);
  const visualClickRef = useRef(null);
  const playheadPositionRef = useRef(0);
  const [playheadPosition, setPlayheadPosition] = useState(0);

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const bufferRef = useRef(new Float32Array(2048));
  const detectorRef = useRef(null);
  const metronomeRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isRunningRef = useRef(false);

  const [midiManager] = useState(() => {
    try {
      return new MIDIManager();
    } catch (error) {
      console.error('Error initializing MIDI manager:', error);
      return null;
    }
  });
  const [midiOutputs, setMidiOutputs] = useState([]);
  const [selectedMidiOutput, setSelectedMidiOutput] = useState(null);
  const [isMidiConnected, setIsMidiConnected] = useState(false);

  const [numberOfBars, setNumberOfBars] = useState(4);
  const [hasMidiSupport, setHasMidiSupport] = useState(false);
  const audioBufferRef = useRef(new AudioBuffer());

  // Add new state for quantized notes
  const [userNotes, setUserNotes] = useState([]);

  // Add new state for continuous note tracking
  const [currentNoteState, setCurrentNoteState] = useState({
    isActive: false,
    pitch: null,
    startTime: null,
    startPosition: null,
    lastUpdateTime: null
  });

  // Add constants for thresholds
  const VOLUME_THRESHOLD = 0.1; // Minimum volume for note detection
  const BEATS_PER_BAR = 4;
  const SUBDIVISIONS = 8; // 32nd notes

  // Get available microphones
  const getMicrophones = async () => {
    try {
      // First request microphone permission to get full device list
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Then enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(device => device.kind === 'audioinput');
      
      console.log('Available microphones:', mics.map(mic => ({
        deviceId: mic.deviceId,
        label: mic.label,
        groupId: mic.groupId
      })));
      
      setAvailableMics(mics);
      
      // Set default mic if none selected
      if (!selectedMic && mics.length > 0) {
        setSelectedMic(mics[0].deviceId);
      }
    } catch (err) {
      console.error('Error getting microphones:', err);
      setError('Error getting microphone list. Please check your microphone permissions.');
    }
  };

  // Check browser compatibility and permissions on component mount
  useEffect(() => {
    const checkBrowserSupport = async () => {
      const userAgent = navigator.userAgent;
      let browserName = "Unknown";
      
      if (userAgent.indexOf("Chrome") > -1) {
        browserName = "Chrome";
      } else if (userAgent.indexOf("Firefox") > -1) {
        browserName = "Firefox";
      } else if (userAgent.indexOf("Safari") > -1) {
        browserName = "Safari";
      } else if (userAgent.indexOf("Edge") > -1) {
        browserName = "Edge";
      }

      const info = {
        browserName,
        userAgent,
        hasMediaDevices: !!navigator.mediaDevices,
        hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        isSecureContext: window.isSecureContext,
        firefoxVersion: browserName === "Firefox" ? userAgent.match(/Firefox\/(\d+)/)?.[1] : null
      };
      setBrowserInfo(info);

      // Check for permissions API support
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
          setPermissionStatus(permissionStatus.state);
          
          permissionStatus.onchange = () => {
            setPermissionStatus(permissionStatus.state);
          };
        } catch (e) {
          console.log('Permissions API not supported');
        }
      }
      
      if (!info.hasMediaDevices) {
        setError(`Your browser (${browserName}) doesn't support the MediaDevices API. Please try using Chrome, Firefox, or Edge.`);
      } else if (!info.hasGetUserMedia) {
        setError(`Your browser (${browserName}) doesn't support getUserMedia. Please try using Chrome, Firefox, or Edge.`);
      } else if (info.protocol !== 'https:' && info.hostname !== 'localhost' && info.hostname !== '127.0.0.1') {
        setError("Audio input requires a secure context (HTTPS) or localhost. Please run the app on localhost or deploy it with HTTPS.");
      }

      // Check MIDI support without showing error
      if (navigator.requestMIDIAccess && midiManager) {
        setHasMidiSupport(true);
        try {
          const connected = await midiManager.connect();
          setIsMidiConnected(connected);
          if (connected) {
            setMidiOutputs(midiManager.getOutputs());
          }
        } catch (error) {
          console.error('MIDI connection error:', error);
          setIsMidiConnected(false);
        }
      } else {
        console.log('MIDI is not supported in this browser');
        setHasMidiSupport(false);
      }

      // Get available microphones
      await getMicrophones();
    };

    checkBrowserSupport();
  }, [midiManager]);

  // Add function to calculate position in subdivisions
  const calculatePosition = (time) => {
    const secondsPerBeat = 60 / bpm;
    const secondsPerSubdivision = secondsPerBeat / SUBDIVISIONS;
    const position = Math.round(time / secondsPerSubdivision);
    return position % (numberOfBars * BEATS_PER_BAR * SUBDIVISIONS);
  };

  // Add function to handle note start
  const handleNoteStart = (pitch, time) => {
    console.log('Starting new note:', { pitch, time });
    const position = calculatePosition(time);
    
    // Only start a new note if we don't have an active note
    if (!currentNoteState.isActive) {
      setCurrentNoteState({
        isActive: true,
        pitch,
        startTime: time,
        startPosition: position,
        lastUpdateTime: time
      });
    } else {
      // If we have an active note, check if pitch change is significant
      const currentMidiNote = Math.round(69 + 12 * Math.log2(currentNoteState.pitch / 440));
      const newMidiNote = Math.round(69 + 12 * Math.log2(pitch / 440));
      const pitchDifference = Math.abs(newMidiNote - currentMidiNote);
      
      if (pitchDifference >= 1) {
        // End current note and start new one
        handleNoteEnd(time);
        setCurrentNoteState({
          isActive: true,
          pitch,
          startTime: time,
          startPosition: position,
          lastUpdateTime: time
        });
      }
    }
  };

  // Add function to handle note end
  const handleNoteEnd = (time) => {
    if (currentNoteState.isActive) {
      const endPosition = calculatePosition(time);
      const note = {
        pitch: Math.round(69 + 12 * Math.log2(currentNoteState.pitch / 440)),
        startPosition: currentNoteState.startPosition,
        endPosition: endPosition,
        startTime: currentNoteState.startTime,
        endTime: time
      };
      
      console.log('Ending note:', note);
      // Add the completed note to userNotes
      setUserNotes(prev => {
        const newNotes = [...prev, note];
        console.log('Updated userNotes array:', newNotes);
        return newNotes;
      });
      
      // Reset the current note state
      setCurrentNoteState({
        isActive: false,
        pitch: null,
        startTime: null,
        startPosition: null,
        lastUpdateTime: null
      });
    }
  };

  // Add function to quantize a note to the nearest 32nd note
  const quantizeNote = (pitch, time) => {
    const secondsPerBeat = 60 / bpm;
    const secondsPerSubdivision = secondsPerBeat / SUBDIVISIONS;
    
    // Calculate the position in subdivisions
    const position = Math.round(time / secondsPerSubdivision);
    
    // Convert frequency to MIDI note number using the standard formula
    const midiNote = Math.round(69 + 12 * Math.log2(pitch / 440));
    // Clamp to valid MIDI range (0-127)
    const clampedMidiNote = Math.max(0, Math.min(127, midiNote));
    
    return {
      pitch: clampedMidiNote,
      startPosition: position % (numberOfBars * BEATS_PER_BAR * SUBDIVISIONS),
      endPosition: (position + 1) % (numberOfBars * BEATS_PER_BAR * SUBDIVISIONS),
      time: time
    };
  };

  const listen = () => {
    if (!analyserRef.current || !detectorRef.current) {
      console.error('Analyser or detector not initialized');
      return;
    }
    
    const buffer = bufferRef.current;
    
    let frameCount = 0;
    let silenceStartTime = null;
    const SILENCE_THRESHOLD = 0.2;
    let lastNoteTime = 0;
    let lastNotePosition = -1;

    const loop = () => {
      if (!isRunningRef.current) {
        console.log('Analysis loop stopped');
        return;
      }
      
      frameCount++;

      try {
        // Get time domain data for waveform
        analyserRef.current.getFloatTimeDomainData(buffer);
        
        // Calculate current energy (RMS)
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += Math.abs(buffer[i]) * Math.abs(buffer[i]);
        }
        const currentEnergy = Math.sqrt(sum / buffer.length);
        
        // Get frequency data for visualization
        const frequencyData = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(frequencyData);
        setWaveformData(frequencyData);
        
        // Update input level for visualization
        const normalizedLevel = Math.min(1, currentEnergy * 2);
        setInputLevel(normalizedLevel);

        // Simple volume detection
        const isSoundDetected = currentEnergy > VOLUME_THRESHOLD;
        setIsDetectingSound(isSoundDetected);

        const currentTime = Tone.now();
        const currentPosition = Math.round(currentTime / (60 / bpm / SUBDIVISIONS));

        // Handle note detection
        if (isSoundDetected) {
          const [pitch, clarity] = detectorRef.current.findPitch(buffer, audioCtxRef.current.sampleRate);
          
          if (pitch && clarity > 0.7) {
            // Only add a note if we're at a new position
            if (currentPosition !== lastNotePosition) {
              const quantized = quantizeNote(pitch, currentTime);
              
              // Add the note to userNotes
              setUserNotes(prev => {
                const newNotes = [...prev, quantized];
                return newNotes;
              });
              
              lastNotePosition = currentPosition;
              lastNoteTime = currentTime;
            }
            
            setPitchHz(pitch.toFixed(2));
            setCurrentNote(frequencyToNote(pitch));
          } else {
            setPitchHz(null);
            setCurrentNote({ note: '-', octave: '-' });
          }
        } else {
          // No sound detected
          setPitchHz(null);
          setCurrentNote({ note: '-', octave: '-' });
          
          // Start silence timer if we have an active note
          if (currentNoteState.isActive && !silenceStartTime) {
            silenceStartTime = currentTime;
          }
          
          // End note if silence duration exceeds threshold
          if (silenceStartTime && (currentTime - silenceStartTime) > SILENCE_THRESHOLD) {
            handleNoteEnd(silenceStartTime);
            silenceStartTime = null;
          }
        }
      } catch (error) {
        console.error('Error in analysis loop:', error);
        return;
      }

      // Continue the loop
      animationFrameRef.current = requestAnimationFrame(loop);
    };
    
    // Start the loop
    animationFrameRef.current = requestAnimationFrame(loop);
  };

  const requestMicrophonePermission = async () => {
    setIsCheckingPermissions(true);
    try {
      // Ensure mediaDevices is available (Firefox specific)
      if (!navigator.mediaDevices) {
        navigator.mediaDevices = {};
      }
      
      // Some browsers partially implement mediaDevices. We can't just assign an object
      // with getUserMedia as it would overwrite existing properties.
      if (!navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia = function(constraints) {
          // First get ahold of the legacy getUserMedia, if present
          const getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
          
          // Some browsers just don't implement it - return a rejected promise with an error
          if (!getUserMedia) {
            return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
          }
          
          // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
          return new Promise(function(resolve, reject) {
            getUserMedia.call(navigator, constraints, resolve, reject);
          });
        }
      }

      // Request microphone access with specific device and higher quality settings
      const constraints = {
        audio: selectedMic ? {
          deviceId: { exact: selectedMic },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100,
          channelCount: 1
        } : {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100,
          channelCount: 1
        }
      };

      console.log('Requesting microphone with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('Got stream:', stream.getAudioTracks().map(track => ({
        label: track.label,
        settings: track.getSettings()
      })));

      setError(null);
      return stream;
    } catch (err) {
      console.error("Microphone error:", err);
      if (err.name === 'NotAllowedError') {
        setError("Microphone access was denied. Please allow microphone access in your browser settings and try again.");
      } else if (err.name === 'NotFoundError') {
        setError("No microphone found. Please connect a microphone and try again.");
      } else {
        setError(`Error accessing microphone: ${err.message}. Please try using Chrome or check Firefox settings.`);
      }
      throw err;
    } finally {
      setIsCheckingPermissions(false);
    }
  };

  const startMetronome = async () => {
    try {
      // Ensure Tone.js is initialized
      console.log('Starting metronome initialization...');
      console.log('Tone.js version:', Tone.version);
      console.log('Tone.js context state:', Tone.context.state);
      
      // Wait for context to be ready
      if (Tone.context.state !== 'running') {
        console.log('Waiting for Tone.js context to be ready...');
        await Tone.start();
        console.log('Tone.js context state after start:', Tone.context.state);
      }
      
      // Create a new synth
      console.log('Creating membrane synth...');
      const synth = new Tone.MembraneSynth();
      console.log('Membrane synth created:', synth);
      console.log('Synth methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(synth)));
      
      console.log('Connecting synth to destination...');
      synth.toDestination();
      console.log('Synth connected to destination');
      
      metronomeRef.current = { synth };
      console.log('Metronome reference set');
      
      // Set initial tempo
      console.log('Setting initial tempo:', bpm);
      Tone.Transport.bpm.value = bpm;
      
      // Track total positions
      const totalPositions = numberOfBars * 4;
      let position = 0;
      let lastUpdateTime = 0;
      console.log('Initial playhead position:', position, 'total positions:', totalPositions);
      
      // Schedule the metronome
      console.log('Scheduling metronome...');
      Tone.Transport.scheduleRepeat((time) => {
        // Only update if enough time has passed (prevent multiple updates)
        if (time - lastUpdateTime >= 0.25) { // 0.25 seconds = quarter note at 60 BPM
          if (isAudibleClick) {
            synth.triggerAttackRelease("C2", "8n", time);
          }
          
          // Update position
          position = (position + 1) % totalPositions;
          console.log('Updating playhead position:', position, 'at time:', time);
          setPlayheadPosition(position);
          lastUpdateTime = time;
          
          // Trigger visual click
          if (visualClickRef.current) {
            visualClickRef.current.style.backgroundColor = '#4CAF50';
            setTimeout(() => {
              if (visualClickRef.current) {
                visualClickRef.current.style.backgroundColor = '#eee';
              }
            }, 50);
          }
        }
      }, "4n");
      
      console.log('Starting transport...');
      Tone.Transport.start();
      console.log('Transport started');
    } catch (err) {
      console.error('Error in startMetronome:', err);
      console.error('Error stack:', err.stack);
      throw err;
    }
  };

  const stopMetronome = () => {
    Tone.Transport.cancel();
    Tone.Transport.stop();
    if (metronomeRef.current) {
      metronomeRef.current.synth.dispose();
      metronomeRef.current = null;
    }
  };

  const handleTempoChange = (event) => {
    const newBpm = parseInt(event.target.value);
    setBpm(newBpm);
    
    // Update tempo in real-time if metronome is running
    if (isRunning) {
      Tone.Transport.bpm.value = newBpm;
    }
  };

  const toggleJam = async () => {
    try {
      if (!isRunning) {
        // Starting
        console.log('Starting jam...');
        
        // Ensure context is running
        if (Tone.context.state !== 'running') {
          console.log('Starting Tone.js context...');
          await Tone.start();
        }
        
        // Start metronome
        await startMetronome();
        
        // Start audio analysis
        await startAudioAnalysis();
        
        setIsRunning(true);
        console.log('Jam started');
      } else {
        // Stopping
        console.log('Stopping jam...');
        
        // Stop metronome
        stopMetronome();
        
        // Stop audio analysis
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        
        // Disconnect audio source but don't close context
        if (sourceRef.current) {
          sourceRef.current.disconnect();
          sourceRef.current = null;
        }
        
        // Reset state
        setError(null);
        setInputLevel(0);
        setIsDetectingSound(false);
        setIsRunning(false);
        console.log('Jam stopped');
      }
    } catch (err) {
      console.error('Error in toggleJam:', err);
      setError(`Error ${isRunning ? 'stopping' : 'starting'} jam: ${err.message}`);
    }
  };

  const startAudioAnalysis = async () => {
    try {
      // Clear notes when starting a new jam
      setUserNotes([]);
      
      // Use Tone.js's context
      audioCtxRef.current = Tone.context;
      console.log('Audio context created:', audioCtxRef.current);
      
      // Request microphone access
      console.log('Requesting microphone access...');
      const stream = await requestMicrophonePermission();
      console.log('Microphone access granted, stream:', stream);
      
      // Create a new audio processing chain
      console.log('Creating audio processing chain...');
      sourceRef.current = audioCtxRef.current.createMediaStreamSource(stream);
      console.log('Media stream source created:', sourceRef.current);
      
      // Create a gain node to boost the input signal
      const gainNode = audioCtxRef.current.createGain();
      gainNode.gain.value = 20.0;
      console.log('Gain node created:', gainNode);
      
      // Create analyzer after gain
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;
      console.log('Analyzer created:', analyserRef.current);
      
      // Connect the nodes
      sourceRef.current.connect(gainNode);
      gainNode.connect(analyserRef.current);
      console.log('Audio nodes connected');
      
      // Initialize audio buffer
      console.log('Initializing audio buffer...');
      const bufferSize = 2048;
      bufferRef.current = new Float32Array(bufferSize);
      audioBufferRef.current = audioCtxRef.current.createBuffer(1, bufferSize, audioCtxRef.current.sampleRate);
      console.log('Audio buffer initialized:', audioBufferRef.current);
      
      // Initialize pitch detector
      console.log('Initializing pitch detector...');
      detectorRef.current = PitchDetector.forFloat32Array(bufferSize);
      console.log('Pitch detector initialized:', detectorRef.current);
      
      setError(null);
      
      // Ensure audio context is running
      if (audioCtxRef.current.state === 'suspended') {
        console.log('AudioContext is suspended, attempting to resume...');
        await audioCtxRef.current.resume();
        console.log('AudioContext resumed, new state:', audioCtxRef.current.state);
      }
      
      console.log('Starting analysis loop...');
      listen();
    } catch (err) {
      console.error('Error in startAudioAnalysis:', err);
      throw err;
    }
  };

  // Add waveform drawing function
  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    
    const barWidth = (width / waveformData.length) * 2.5;
    let barHeight;
    let x = 0;
    
    for (let i = 0; i < waveformData.length; i++) {
      barHeight = waveformData[i] / 2;
      
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, '#4CAF50');
      gradient.addColorStop(1, '#2196F3');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x, height - barHeight, barWidth, barHeight);
      
      x += barWidth + 1;
    }
  };

  // Add effect to draw waveform
  useEffect(() => {
    if (isRunning) {
      const animationId = requestAnimationFrame(drawWaveform);
      return () => cancelAnimationFrame(animationId);
    }
  }, [waveformData, isRunning]);

  // Add new function to handle MIDI output selection
  const handleMidiOutputChange = (event) => {
    setSelectedMidiOutput(event.target.value);
  };

  // Modify the playNote function to also send MIDI
  const playNote = (note) => {
    if (isMidiConnected && selectedMidiOutput) {
      midiManager.sendNoteOn(note, 100, 0, selectedMidiOutput);
      setTimeout(() => {
        midiManager.sendNoteOff(note, 0, selectedMidiOutput);
      }, 500);
    }
  };

  // Add this after the tempo control section
  const barCountOptions = [2, 4, 8];

  const handleBarCountChange = (event) => {
    const newBarCount = Number(event.target.value);
    setNumberOfBars(newBarCount);
    // Ensure current bar is within the new range
    setPlayheadPosition(playheadPosition % newBarCount);
  };

  // Modify the exportMIDI function to include both tracks
  const exportMIDI = () => {
    if (!userNotes.length) return;

    const midi = new MidiWriter.Writer();
    const track = midi.addTrack();

    // Add user notes to track
    userNotes.forEach(note => {
      track.addNote({
        midi: note.pitch,
        time: note.startTime,
        duration: note.endTime - note.startTime,
        velocity: 80
      });
    });

    // Download the MIDI file
    const blob = new Blob([midi.buildFile()], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jam-session.mid';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Add cleanup effect
  useEffect(() => {
    return () => {
      // Cleanup function that runs when component unmounts
      console.log('Cleaning up audio resources...');
      
      // Stop metronome
      stopMetronome();
      
      // Stop audio analysis
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // Disconnect audio source
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      
      // Close Tone.js context
      if (Tone.context.state !== 'closed') {
        console.log('Closing Tone.js context...');
        Tone.context.close();
      }
    };
  }, []); // Empty dependency array means this runs only on mount/unmount

  return (
    <div style={{ textAlign: "center", marginTop: 50 }}>
      <h1>Music Mate MVP</h1>
      <p style={{ 
        maxWidth: "600px", 
        margin: "0 auto 20px", 
        color: "#666",
        lineHeight: "1.5"
      }}>
        A real-time musical companion that detects your playing and helps you create music. 
        Start by selecting your input device and adjusting the tempo. 
        When you're ready, click Start to begin jamming!
      </p>
      
      {availableMics.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="mic-select" style={{ marginRight: 10 }}>
            Select Microphone:
          </label>
          <select
            id="mic-select"
            value={selectedMic || ''} 
            onChange={(e) => setSelectedMic(e.target.value)}
            style={{ padding: "5px 10px" }}
          >
            {availableMics.map((mic) => (
              <option key={mic.deviceId} value={mic.deviceId}>
                {mic.label || `Microphone ${mic.deviceId.slice(0, 5)}...`}
              </option>
            ))}
          </select>
        </div>
      )}

      {hasMidiSupport && midiOutputs.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="midi-select" style={{ marginRight: 10 }}>
            Select MIDI Output:
          </label>
          <select
            id="midi-select"
            value={selectedMidiOutput || ''} 
            onChange={handleMidiOutputChange}
            style={{ padding: "5px 10px" }}
          >
            <option value="">None</option>
            {midiOutputs.map((output) => (
              <option key={output.id} value={output.id}>
                {output.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <label htmlFor="bars" style={{ marginRight: 10 }}>
          Number of Bars:
        </label>
        <select
          id="bars"
          value={numberOfBars}
          onChange={handleBarCountChange}
          style={{ padding: "5px 10px" }}
          disabled={isRunning}
        >
          {barCountOptions.map(num => (
            <option key={num} value={num}>
              {num} Bars
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 20, maxWidth: "400px", margin: "20px auto" }}>
        <label htmlFor="tempo" style={{ display: "block", marginBottom: 10 }}>
          Tempo: {bpm} BPM
        </label>
        <input
          type="range"
          id="tempo"
          min="40"
          max="200"
          value={bpm}
          onChange={handleTempoChange}
          style={{ width: "100%" }}
          disabled={isRunning}
        />
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          fontSize: "0.8em", 
          color: "#666",
          marginTop: 5
        }}>
          <span>40 BPM</span>
          <span>200 BPM</span>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          <input
            type="checkbox"
            checked={isAudibleClick}
            onChange={(e) => setIsAudibleClick(e.target.checked)}
            disabled={isRunning}
          />
          Audible Metronome
        </label>
        <div style={{ height: "40px" }}> {/* Fixed height container */}
          {isAudibleClick && (
            <p style={{ 
              margin: "5px 0 0 0",
              fontSize: "0.9em",
              color: "#666",
              fontStyle: "italic"
            }}>
              🎧 Tip: For best results, use headphones to prevent the metronome from being detected by the microphone.
            </p>
          )}
        </div>
      </div>

      <button 
        onClick={toggleJam} 
        disabled={isCheckingPermissions}
        style={{
          padding: "10px 20px",
          fontSize: "1.2em",
          backgroundColor: isRunning ? "#ff4444" : "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer"
        }}
      >
        {isCheckingPermissions ? "Checking Permissions..." : (isRunning ? "Stop" : "Start")} Jam
      </button>

      <div style={{ 
        marginTop: 20, 
        maxWidth: "600px", 
        margin: "20px auto",
        padding: "20px",
        border: "1px solid #ccc",
        borderRadius: "10px",
        backgroundColor: "#f9f9f9",
        opacity: isRunning ? 1 : 0.7
      }}>
        <div style={{ 
          height: "30px", 
          backgroundColor: "#eee",
          borderRadius: "15px",
          overflow: "hidden",
          marginBottom: "15px",
          boxShadow: "inset 0 1px 3px rgba(0,0,0,0.2)"
        }}>
          <div style={{
            height: "100%",
            width: `${inputLevel * 100}%`,
            backgroundColor: isDetectingSound ? "#4CAF50" : "#2196F3",
            transition: "width 0.1s ease-out, background-color 0.3s ease"
          }} />
        </div>
        
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "15px"
        }}>
          <div style={{ textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: "1.2em", fontWeight: "bold" }}>
              {isRunning ? (isDetectingSound ? "🎵 Detecting sound..." : "🎤 Waiting for input...") : "🎤 Microphone Input"}
            </p>
            <p style={{ margin: "5px 0 0 0", fontSize: "0.9em", color: "#666" }}>
              Level: {(inputLevel * 100).toFixed(1)}%
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: "2em", fontWeight: "bold" }}>
              {currentNote.note}<span style={{ fontSize: "0.5em", verticalAlign: "super" }}>{currentNote.octave}</span>
            </p>
            <p style={{ margin: "5px 0 0 0", fontSize: "0.9em", color: "#666" }}>
              {pitchHz ? `${pitchHz} Hz` : "--"}
            </p>
          </div>
        </div>

        <div 
          ref={visualClickRef}
          style={{
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            backgroundColor: "#eee",
            margin: "0 auto",
            transition: "background-color 0.05s ease-out"
          }}
        />

        <canvas
          ref={canvasRef}
          width={600}
          height={100}
          style={{
            width: "100%",
            height: "100px",
            backgroundColor: "#000",
            borderRadius: "5px",
            marginTop: "10px"
          }}
        />
      </div>

      <div style={{ marginTop: 20, maxWidth: "800px", margin: "20px auto" }}>
        <MusicGrid
          numberOfBars={numberOfBars}
          playheadPosition={playheadPosition}
          userNotes={userNotes}
          bpm={bpm}
        />
        <button
          onClick={exportMIDI}
          disabled={!userNotes.length}
          style={{
            padding: "10px 20px",
            fontSize: "1em",
            backgroundColor: userNotes.length > 0 ? "#2196F3" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: userNotes.length > 0 ? "pointer" : "not-allowed",
            marginTop: "10px"
          }}
        >
          Export MIDI
        </button>
      </div>

      {error && (
        <div style={{ color: "red", marginTop: 10, maxWidth: "600px", margin: "10px auto" }}>
          <p><strong>Error:</strong> {error}</p>
          {browserInfo && (
            <div style={{ textAlign: "left", fontSize: "0.8em", marginTop: "10px" }}>
              <p><strong>Browser Info:</strong></p>
              <ul style={{ listStyle: "none", padding: 0 }}>
                <li>Browser: {browserInfo.browserName}</li>
                {browserInfo.firefoxVersion && (
                  <li>Firefox Version: {browserInfo.firefoxVersion}</li>
                )}
                <li>Protocol: {browserInfo.protocol}</li>
                <li>Hostname: {browserInfo.hostname}</li>
                <li>Is Secure Context: {browserInfo.isSecureContext ? "Yes" : "No"}</li>
                <li>Has MediaDevices: {browserInfo.hasMediaDevices ? "Yes" : "No"}</li>
                <li>Has getUserMedia: {browserInfo.hasGetUserMedia ? "Yes" : "No"}</li>
                {permissionStatus && (
                  <li>Microphone Permission: {permissionStatus}</li>
                )}
              </ul>
            </div>
          )}
          <div style={{ marginTop: "20px", textAlign: "left" }}>
            <p><strong>To fix this in Firefox:</strong></p>
            <ol>
              <li>Try using Chrome instead (recommended for audio applications)</li>
              <li>If you want to use Firefox:
                <ul>
                  <li>Go to about:config</li>
                  <li>Search for and enable these settings:
                    <ul>
                      <li>media.devices.insecure.enabled (set to true)</li>
                      <li>media.navigator.enabled (set to true)</li>
                      <li>media.navigator.streams.fake (set to false)</li>
                      <li>media.getusermedia.screensharing.enabled (set to true)</li>
                      <li>media.getusermedia.audiocapture.enabled (set to true)</li>
                    </ul>
                  </li>
                  <li>Restart Firefox</li>
                  <li>Go to about:preferences#privacy</li>
                  <li>Scroll to "Permissions" section</li>
                  <li>Click "Settings" next to "Microphone"</li>
                  <li>Add localhost to the allowed sites</li>
                </ul>
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}