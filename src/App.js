// MVP: Real-Time Smart Jam (React + Tone.js + Pitchy)
// This version includes MIDI export functionality

import React, { useState, useRef, useEffect } from "react";
import * as Tone from "tone";
import { PitchDetector } from "pitchy";
import MusicGrid from './components/MusicGrid';
import AIMusicGrid from './components/AIMusicGrid';
import AudioBuffer from './AudioBuffer';
import { Midi } from '@tonejs/midi';
import MagentaManager from './MagentaManager';

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
  const [playheadPosition, setPlayheadPosition] = useState(0);
  const [isAddMode, setIsAddMode] = useState(true);
  const [aiNotes, setAiNotes] = useState([]);
  const [isWaitingForMagenta, setIsWaitingForMagenta] = useState(false);
  const previousNotesRef = useRef([]); // Add ref to track latest previous notes
  const modeRef = useRef({ isAddMode: true }); // Add ref to track mode state

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const bufferRef = useRef(new Float32Array(2048));
  const detectorRef = useRef(null);
  const metronomeRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isRunningRef = useRef(false);

  const [numberOfBars, setNumberOfBars] = useState(4);
  const [gridDivision, setGridDivision] = useState(8); // 8 = 32nd notes
  const [maxNoteDuration, setMaxNoteDuration] = useState(32); // 32 = whole note (in 32nd notes)
  const [hasMidiSupport, setHasMidiSupport] = useState(false);

  // Add new state for quantized notes
  const [userNotes, setUserNotes] = useState([]);
  const userNotesRef = useRef([]); // Add ref to track latest notes

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

  // Add constants for grid settings
  const GRID_DIVISION_OPTIONS = [
    { value: 8, label: '32nd notes' },
    { value: 4, label: '16th notes' },
    { value: 2, label: '8th notes' }
  ];

  const MAX_DURATION_OPTIONS = [
    { value: 2, label: '32nd note' },
    { value: 4, label: '16th note' },
    { value: 8, label: '8th note' },
    { value: 16, label: 'Quarter note' },
    { value: 32, label: 'Half note' },
    { value: 64, label: 'Whole note' }
  ];

  // Update Tone.js references
  const [midiSynth] = useState(() => new Tone.PolySynth(Tone.Synth).toDestination());

  // Initialize MagentaManager
  useEffect(() => {
    const initMagenta = async () => {
      try {
        const manager = new MagentaManager();
        await manager.initialize();
        window.magentaManager = manager;
        console.log('MagentaManager initialized and attached to window');
      } catch (error) {
        console.error('Failed to initialize MagentaManager:', error);
      }
    };

    initMagenta();
  }, []);

  // Get available microphones
  const getMicrophones = async () => {
    try {
      // First request microphone permission to get full device list
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Then enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(device => device.kind === 'audioinput');
      
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
      if (navigator.requestMIDIAccess) {
        setHasMidiSupport(true);
      } else {
        console.log('MIDI is not supported in this browser');
        setHasMidiSupport(false);
      }

      // Get available microphones
      await getMicrophones();
    };

    checkBrowserSupport();
  }, []);

  // Add function to calculate position in subdivisions
  const calculatePosition = (time) => {
    const secondsPerBeat = 60 / bpm;
    const secondsPerSubdivision = secondsPerBeat / gridDivision;
    const position = Math.round(time / secondsPerSubdivision);
    return position % (numberOfBars * BEATS_PER_BAR * gridDivision);
  };

  // Add function to handle note start
  const handleNoteStart = (pitch, time) => {
    console.log('Starting new note:', { pitch, time });
    const position = calculatePosition(time);
    console.log('Calculated position:', position);
    
    // Only start a new note if we don't have an active note
    if (!currentNoteState.isActive) {
      console.log('No active note, starting new one');
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
      
      console.log('Active note exists, checking pitch difference:', {
        currentMidiNote,
        newMidiNote,
        pitchDifference
      });
      
      if (pitchDifference >= 1) {
        // End current note and start new one
        console.log('Pitch change significant, ending current note');
        handleNoteEnd(time);
        setCurrentNoteState({
          isActive: true,
          pitch,
          startTime: time,
          startPosition: position,
          lastUpdateTime: time
        });
      } else {
        // Check if we need to split the note due to maximum duration
        const currentDuration = time - currentNoteState.startTime;
        const secondsPerBeat = 60 / bpm;
        const maxDurationInSeconds = (maxNoteDuration / gridDivision) * secondsPerBeat;
        
        if (currentDuration >= maxDurationInSeconds) {
          // End current note and start new one with same pitch
          console.log('Maximum duration reached, splitting note');
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
    }
  };

  // Add function to handle note end
  const handleNoteEnd = (time) => {
    if (currentNoteState.isActive) {
      const endPosition = calculatePosition(time);
      console.log('Current note state:', currentNoteState);
      console.log('End position:', endPosition);
      
      const note = {
        pitch: Math.round(69 + 12 * Math.log2(currentNoteState.pitch / 440)),
        startPosition: currentNoteState.startPosition,
        endPosition: endPosition,
        startTime: currentNoteState.startTime,
        endTime: time
      };
      
      console.log('Created note:', note);
      // Add the completed note to userNotes
      setUserNotes(prev => {
        const newNotes = modeRef.current.isAddMode ? 
          (prev.some(n => n.startPosition === note.startPosition && n.pitch === note.pitch) ? prev : [...prev, note]) :
          [...prev.filter(n => n.startPosition !== note.startPosition), note];
        console.log('Previous notes:', prev);
        console.log('New notes array:', newNotes);
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
    } else {
      console.log('No active note to end');
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
      startTime: time,
      endTime: time + secondsPerSubdivision,
      velocity: 100  // Add velocity for MIDI compatibility
    };
  };

  const listen = () => {
    if (!analyserRef.current) {
      console.error('Analyser not initialized');
      return;
    }
    
    const buffer = bufferRef.current;
    
    let frameCount = 0;
    let silenceStartTime = null;
    const SILENCE_THRESHOLD = 0.2;
    let lastNotePosition = -1;
    let lastLoopEndPosition = -1;
    let lastBeatTime = 0;
    let startTime = null;

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

        // Use real-time for audio analysis
        const currentTime = Tone.now();
        
        // Initialize start time if not set
        if (startTime === null) {
          startTime = currentTime;
        }
        
        // Calculate time relative to start
        const relativeTime = currentTime - startTime;
        const secondsPerBeat = 60 / bpm;
        const currentBeat = Math.floor(relativeTime / secondsPerBeat);
        
        // Check if we've crossed a beat boundary
        if (currentBeat > lastBeatTime) {
          lastBeatTime = currentBeat;
          // Synchronize with Transport position at beat boundaries
          const transportPosition = Math.floor(Tone.Transport.position.split(':')[0]);
          if (transportPosition !== currentBeat % (numberOfBars * BEATS_PER_BAR)) {
            console.log('Resynchronizing with Transport at beat:', currentBeat);
            Tone.Transport.position = `${currentBeat % (numberOfBars * BEATS_PER_BAR)}:0:0`;
          }
        }

        // Calculate position for note detection relative to start time
        const currentPosition = Math.floor(relativeTime / (60 / bpm / gridDivision));
        const totalPositions = numberOfBars * BEATS_PER_BAR * gridDivision;
        const normalizedPosition = currentPosition % totalPositions;

        // Check for loop end - only when crossing from last position to 0
        if (normalizedPosition === 0 && (lastLoopEndPosition === totalPositions - 1 || lastLoopEndPosition === -1)) {
          console.log('Loop end detected at normalized position:', normalizedPosition, 'total positions:', totalPositions);
          console.log('Current userNotes:', userNotes);
          
          // Compare current and previous notes using the two-buffer approach
          console.log('userNotesRef.current:', userNotesRef.current);
          console.log('previousNotesRef.current:', previousNotesRef.current);
          console.log('JSON string of userNotesRef:', JSON.stringify(userNotesRef.current));
          console.log('JSON string of previousNotes:', JSON.stringify(previousNotesRef.current));
          const hasBufferChanged = JSON.stringify(userNotesRef.current) !== JSON.stringify(previousNotesRef.current);
          console.log('hasBufferChanged:', hasBufferChanged);
          
          if (hasBufferChanged && !isWaitingForMagenta) {
            console.log('Buffer changed, sending to Magenta...');
            
            // Combine consecutive notes of the same pitch
            const combinedNotes = [];
            let currentNote = null;

            userNotesRef.current.forEach(note => {
              if (!currentNote) {
                currentNote = { ...note };
              } else if (note.pitch === currentNote.pitch) {
                // Extend the current note
                currentNote.endTime = note.endTime;
                currentNote.endPosition = note.endPosition;
              } else {
                // Different pitch, save current note and start new one
                combinedNotes.push(currentNote);
                currentNote = { ...note };
              }
            });

            // Don't forget to add the last note
            if (currentNote) {
              combinedNotes.push(currentNote);
            }

            // Convert notes to Magenta format
            const magentaNotes = combinedNotes.map(note => ({
              pitch: Math.max(0, Math.min(127, note.pitch)), // Clamp to valid MIDI range
              startTime: note.startTime,
              endTime: note.endTime,
              velocity: note.velocity || 100 // Default velocity if not set
            }));
            console.log('Converted notes for Magenta:', magentaNotes);
            
            // Update previous notes immediately to prevent re-sending
            previousNotesRef.current = [...userNotesRef.current];
            setIsWaitingForMagenta(true);
            
            // Send to Magenta for generation
            if (window.magentaManager) {
              console.log('Magenta manager found, generating response...');
              window.magentaManager.generateResponse(magentaNotes)
                .then(response => {
                  console.log('Got response from Magenta:', response);
                  if (response && response.length > 0) {
                    // Convert response notes to match our format
                    const convertedResponse = response.map(note => {
                      // Convert time to grid positions based on BPM and subdivisions
                      const secondsPerBeat = 60 / bpm;
                      const secondsPerSubdivision = secondsPerBeat / SUBDIVISIONS;
                      const startPosition = Math.floor(note.startTime / secondsPerSubdivision);
                      const endPosition = Math.ceil(note.endTime / secondsPerSubdivision);
                      
                      return {
                        pitch: note.pitch,
                        startPosition,
                        endPosition,
                        startTime: note.startTime,
                        endTime: note.endTime,
                        velocity: note.velocity
                      };
                    });
                    console.log('Setting AI notes:', convertedResponse);
                    setAiNotes(convertedResponse);
                  }
                })
                .catch(error => {
                  console.error('Error generating response:', error);
                })
                .finally(() => {
                  // Allow new notes to be sent after response (success or failure)
                  setIsWaitingForMagenta(false);
                });
            } else {
              console.error('Magenta manager not found on window object');
              setIsWaitingForMagenta(false);
            }
          } else {
            console.log('No buffer changes detected at loop end or waiting for Magenta response');
          }
        }
        lastLoopEndPosition = normalizedPosition;

        // Handle note detection
        if (isSoundDetected) {
          const [pitch, clarity] = detectorRef.current.findPitch(buffer, audioCtxRef.current.sampleRate);
          
          if (pitch && clarity > 0.7) {
            const position = normalizedPosition;
            const midiNote = Math.max(0, Math.min(127, Math.round(69 + 12 * Math.log2(pitch / 440))));
            
            // Create a new note with relative timing
            const note = {
              pitch: midiNote,
              startPosition: position,
              endPosition: position + 1,
              startTime: relativeTime,
              endTime: relativeTime + (60 / bpm / gridDivision)
            };
            
            // Add the note to userNotes
            setUserNotes(prev => {
              const newNotes = modeRef.current.isAddMode ? 
                (prev.some(n => n.startPosition === position && n.pitch === midiNote) ? prev : [...prev, note]) :
                [...prev.filter(n => n.startPosition !== position), note];
              userNotesRef.current = newNotes; // Update ref with latest notes
              return newNotes;
            });
          }
        } else {
          // If no sound is detected and we have an active note
          if (currentNoteState.isActive) {
            if (!silenceStartTime) {
              silenceStartTime = currentTime;
            } else if (currentTime - silenceStartTime > 0.1) { // End note after 100ms of silence
              handleNoteEnd(currentTime);
              silenceStartTime = null;
            }
          }
        }
        
        // Always update pitch display
        if (isSoundDetected) {
          const [pitch, clarity] = detectorRef.current.findPitch(buffer, audioCtxRef.current.sampleRate);
          setPitchHz(pitch ? pitch.toFixed(2) : null);
          setCurrentNote(pitch ? frequencyToNote(pitch) : { note: '-', octave: '-' });
        } else {
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
      
      // Reset Transport position and playhead
      Tone.Transport.position = "0:0:0";
      setPlayheadPosition(0);
      
      // Track total positions
      const totalPositions = numberOfBars * BEATS_PER_BAR;
      let position = 0;
      console.log('Initial playhead position:', position, 'total positions:', totalPositions);
      
      // Schedule the metronome at beat level
      console.log('Scheduling metronome...');
      Tone.Transport.scheduleRepeat((time) => {
        if (isAudibleClick) {
          synth.triggerAttackRelease("C2", "8n", time);
        }
        
        // Update position
        position = (position + 1) % totalPositions;
        setPlayheadPosition(position);
        
        // Trigger visual click
        if (visualClickRef.current) {
          visualClickRef.current.style.backgroundColor = '#4CAF50';
          setTimeout(() => {
            if (visualClickRef.current) {
              visualClickRef.current.style.backgroundColor = '#eee';
            }
          }, 50);
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
    // Reset playhead position when stopping
    setPlayheadPosition(0);
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
        
        // Create a new Tone.js context if needed
        if (!Tone.context || Tone.context.state === 'closed') {
          console.log('Creating new Tone.js context...');
          Tone.context.setContext(new Tone.context.Context());
        }
        
        // Ensure context is running
        if (Tone.context.state !== 'running') {
          console.log('Starting Tone.js context...');
          await Tone.start();
        }
        
        // Start audio analysis first
        await startAudioAnalysis();
        
        // Then start metronome
        await startMetronome();
        
        setIsRunning(true);
        isRunningRef.current = true;
        console.log('Jam started');
      } else {
        // Stopping
        console.log('Stopping jam...');
        
        // Set running ref to false first
        isRunningRef.current = false;
        
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
      console.log('Audio buffer initialized');
      
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
    // Remove this function as it's no longer needed
  };

  // Add this after the tempo control section
  const barCountOptions = [2, 4, 8];

  const handleBarCountChange = (event) => {
    const newBarCount = Number(event.target.value);
    setNumberOfBars(newBarCount);
    // Ensure current bar is within the new range
    setPlayheadPosition(playheadPosition % newBarCount);
  };

  const exportMIDI = () => {
    // Calculate timing constants
    const PPQ = 480; // Pulses Per Quarter note
    const ticksPerBeat = PPQ;
    const ticksPerSubdivision = ticksPerBeat / gridDivision;

    // Create a new MIDI file
    const midi = new Midi();

    // Add user track
    const userTrack = midi.addTrack();
    userTrack.name = "User Notes";

    // Add AI track
    const aiTrack = midi.addTrack();
    aiTrack.name = "AI Response";

    // Add user notes to track
    userNotes.forEach((note) => {
      // Calculate timing in seconds
      const startTime = (note.startPosition * 60) / (bpm * gridDivision);
      const endTime = (note.endPosition * 60) / (bpm * gridDivision);

      // Add 12 to the pitch to raise it an octave
      const adjustedPitch = note.pitch + 12;

      // Add the note
      userTrack.addNote({
        midi: adjustedPitch,
        time: startTime,
        duration: endTime - startTime,
        velocity: 0.8
      });
    });

    // Add AI notes to track
    aiNotes.forEach((note) => {
      // Calculate timing in seconds
      const startTime = (note.startPosition * 60) / (bpm * gridDivision);
      const endTime = (note.endPosition * 60) / (bpm * gridDivision);

      // Add 12 to the pitch to raise it an octave
      const adjustedPitch = note.pitch + 12;

      // Add the note
      aiTrack.addNote({
        midi: adjustedPitch,
        time: startTime,
        duration: endTime - startTime,
        velocity: 0.8
      });
    });

    // Set tempo
    midi.header.setTempo(bpm);

    // Download the MIDI file
    const blob = new Blob([midi.toArray()], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smart-jam-export.mid';
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
      
      // Don't close the Tone.js context here
      // This was causing the issue as the context was being closed
      // but not properly reinitialized
    };
  }, []); // Empty dependency array means this runs only on mount/unmount

  // Update mode change handler
  const handleModeChange = () => {
    const newMode = !isAddMode;
    setIsAddMode(newMode);
    modeRef.current.isAddMode = newMode;
    console.log('Mode changed to:', newMode ? 'Add Mode' : 'Replace Mode');
  };

  return (
    <div style={{ textAlign: "center", marginTop: 50 }}>
      <h1>Smart Jam</h1>
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

      <div style={{ 
        maxWidth: "800px", 
        margin: "20px auto",
        display: "flex",
        gap: "20px",
        justifyContent: "space-between"
      }}>
        {/* Grid Settings Box */}
        <div style={{
          width: "400px",
          padding: "20px",
          border: "1px solid #ccc",
          borderRadius: "10px",
          backgroundColor: "#f9f9f9"
        }}>
          <h3 style={{ margin: "0 0 15px 0", color: "#666" }}>Grid Settings</h3>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
            <label htmlFor="bars">Number of Bars:</label>
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

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
            <label htmlFor="grid-division">Grid Division:</label>
            <select
              id="grid-division"
              value={gridDivision}
              onChange={(e) => setGridDivision(Number(e.target.value))}
              style={{ padding: "5px 10px" }}
              disabled={isRunning}
            >
              {GRID_DIVISION_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <label htmlFor="max-duration">Maximum Note Duration:</label>
            <select
              id="max-duration"
              value={maxNoteDuration}
              onChange={(e) => setMaxNoteDuration(Number(e.target.value))}
              style={{ padding: "5px 10px" }}
              disabled={isRunning}
            >
              {MAX_DURATION_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tempo Settings Box */}
        <div style={{
          width: "400px",
          padding: "20px",
          border: "1px solid #ccc",
          borderRadius: "10px",
          backgroundColor: "#f9f9f9"
        }}>
          <h3 style={{ margin: "0 0 15px 0", color: "#666" }}>Tempo Settings</h3>
          <div style={{ marginBottom: "20px" }}>
            <label htmlFor="tempo" style={{ display: "block", marginBottom: "10px" }}>
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
              marginTop: "5px"
            }}>
              <span>40 BPM</span>
              <span>200 BPM</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              id="audible-click"
              checked={isAudibleClick}
              onChange={(e) => setIsAudibleClick(e.target.checked)}
              disabled={isRunning}
            />
            <label htmlFor="audible-click">Audible Metronome</label>
          </div>
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
        {isCheckingPermissions ? "Checking Permissions..." : (isRunning ? "Stop" : "Start")}
      </button>

      <div style={{ 
        marginTop: 20, 
        maxWidth: "800px", 
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

      <div style={{ 
        marginTop: 20, 
        maxWidth: "800px", 
        margin: "20px auto",
        padding: "20px",
        border: "1px solid #ccc",
        borderRadius: "10px",
        backgroundColor: "#f9f9f9"
      }}>
        <MusicGrid
          numberOfBars={numberOfBars}
          playheadPosition={playheadPosition}
          userNotes={userNotes}
          bpm={bpm}
          validNoteRange={window.magentaManager?.getValidNoteRange()}
          gridDivision={gridDivision}
          isAddMode={isAddMode}
          onModeChange={handleModeChange}
        />
        <AIMusicGrid
          numberOfBars={numberOfBars}
          playheadPosition={playheadPosition}
          aiNotes={aiNotes}
          bpm={bpm}
        />
        <div style={{ marginTop: "10px", display: "flex", gap: "10px", justifyContent: "center" }}>
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
              cursor: userNotes.length > 0 ? "pointer" : "not-allowed"
            }}
          >
            Export MIDI
          </button>
        </div>
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