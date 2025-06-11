import React, { useRef, useEffect } from 'react';

const MusicGrid = ({ 
  numberOfBars, 
  playheadPosition, 
  userNotes,
  bpm,
  validNoteRange = { min: 48, max: 83 }, // Default values as fallback
  gridDivision = 8, // Default to 32nd notes
  isAddMode,
  onModeChange
}) => {
  const canvasRef = useRef(null);
  
  // Constants for the grid
  const BEATS_PER_BAR = 4;
  const TOTAL_SUBDIVISIONS = numberOfBars * BEATS_PER_BAR * gridDivision;
  
  // Colors
  const USER_NOTE_COLOR = '#4CAF50';
  const INVALID_NOTE_COLOR = '#cccccc'; // Grey for invalid notes
  const GRID_COLOR = '#ddd';
  const BEAT_GRID_COLOR = '#999';
  const BAR_GRID_COLOR = '#666';
  const PLAYHEAD_COLOR = '#ff4444';
  const VALID_RANGE_COLOR = 'rgba(76, 175, 80, 0.1)'; // Light green for valid range

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    // Draw valid pitch range
    const minY = height - ((validNoteRange.min - 60) * 5 + height/2);
    const maxY = height - ((validNoteRange.max - 60) * 5 + height/2);
    ctx.fillStyle = VALID_RANGE_COLOR;
    ctx.fillRect(0, maxY, width, minY - maxY);

    // Draw grid
    const subdivisionWidth = width / TOTAL_SUBDIVISIONS;
    
    // Draw subdivision lines
    for (let i = 0; i <= TOTAL_SUBDIVISIONS; i++) {
      ctx.beginPath();
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 1;
      ctx.moveTo(i * subdivisionWidth, 0);
      ctx.lineTo(i * subdivisionWidth, height);
      ctx.stroke();
    }

    // Draw beat lines
    for (let i = 0; i <= numberOfBars * BEATS_PER_BAR; i++) {
      ctx.beginPath();
      ctx.strokeStyle = BEAT_GRID_COLOR;
      ctx.lineWidth = 1;
      ctx.moveTo(i * subdivisionWidth * gridDivision, 0);
      ctx.lineTo(i * subdivisionWidth * gridDivision, height);
      ctx.stroke();
    }

    // Draw bar lines
    for (let i = 0; i <= numberOfBars; i++) {
      ctx.beginPath();
      ctx.strokeStyle = BAR_GRID_COLOR;
      ctx.lineWidth = 2;
      ctx.moveTo(i * subdivisionWidth * gridDivision * BEATS_PER_BAR, 0);
      ctx.lineTo(i * subdivisionWidth * gridDivision * BEATS_PER_BAR, height);
      ctx.stroke();
    }

    // Draw playhead
    const totalPositions = numberOfBars * 4;
    if (playheadPosition >= 0 && playheadPosition < totalPositions) {
      const playheadX = (playheadPosition * subdivisionWidth * gridDivision);
      ctx.beginPath();
      ctx.strokeStyle = PLAYHEAD_COLOR;
      ctx.lineWidth = 2;
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    } else {
      console.log('Invalid playhead position:', playheadPosition, 'total positions:', totalPositions);
    }

    // Draw user notes
    if (userNotes && userNotes.length > 0) {
      userNotes.forEach((note, index) => {
        const startX = note.startPosition * subdivisionWidth;
        const endX = note.endPosition * subdivisionWidth;
        const width = endX - startX;
        
        // Convert MIDI note number to y position (MIDI note 60 = middle C)
        const midiNote = note.pitch;
        // Map MIDI notes 0-127 to the canvas height, with middle C (60) in the middle
        const y = height - ((midiNote - 60) * 5 + height/2);
        
        // Only draw if the note is visible
        if (y >= 0 && y <= height) {
          // Check if note is within valid range
          const isInValidRange = midiNote >= validNoteRange.min && midiNote <= validNoteRange.max;
          ctx.fillStyle = isInValidRange ? USER_NOTE_COLOR : INVALID_NOTE_COLOR;
          ctx.fillRect(startX, y, width, 8);
        }
      });
    }

    // Draw bar numbers
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    for (let i = 0; i < numberOfBars; i++) {
      const x = i * (width / numberOfBars);
      ctx.fillText(`${i + 1}`, x + 5, 15);
    }

    // Draw beat numbers (only for first bar)
    ctx.fillStyle = '#999';
    ctx.font = '10px Arial';
    for (let i = 0; i < BEATS_PER_BAR; i++) {
      const x = i * (width / (numberOfBars * BEATS_PER_BAR));
      ctx.fillText(`${i + 1}`, x + 5, 30);
    }

    // Draw pitch range labels
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    ctx.fillText(`C3 (${validNoteRange.min})`, 5, minY - 5);
    ctx.fillText(`B5 (${validNoteRange.max})`, 5, maxY - 5);

  }, [numberOfBars, playheadPosition, userNotes, bpm, validNoteRange, gridDivision]);

  return (
    <div style={{ margin: '0 0 10px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
        <h3 style={{ margin: '0', color: '#666' }}>User Notes</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#666', fontSize: '0.9em' }}>Mode:</span>
          <button 
            onClick={onModeChange}
            style={{
              padding: '4px 8px',
              fontSize: '0.9em',
              backgroundColor: isAddMode ? '#4CAF50' : '#ff4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {isAddMode ? 'Add Notes' : 'Replace Notes'}
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={200}
        style={{
          width: '100%',
          height: '200px',
          border: '1px solid #ccc',
          borderRadius: '5px'
        }}
      />
    </div>
  );
};

export default MusicGrid; 