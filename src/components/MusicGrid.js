import React, { useRef, useEffect } from 'react';

const MusicGrid = ({ 
  numberOfBars, 
  playheadPosition, 
  userNotes,
  bpm 
}) => {
  const canvasRef = useRef(null);
  
  // Constants for the grid
  const BEATS_PER_BAR = 4;
  const SUBDIVISIONS = 8; // 32nd notes (8 subdivisions per beat)
  const TOTAL_SUBDIVISIONS = numberOfBars * BEATS_PER_BAR * SUBDIVISIONS;
  
  // Colors
  const USER_NOTE_COLOR = '#4CAF50';
  const GRID_COLOR = '#ddd';
  const BEAT_GRID_COLOR = '#999';
  const BAR_GRID_COLOR = '#666';
  const PLAYHEAD_COLOR = '#ff4444';

  useEffect(() => {
    console.log('MusicGrid received new playhead position:', playheadPosition);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

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
      ctx.moveTo(i * subdivisionWidth * SUBDIVISIONS, 0);
      ctx.lineTo(i * subdivisionWidth * SUBDIVISIONS, height);
      ctx.stroke();
    }

    // Draw bar lines
    for (let i = 0; i <= numberOfBars; i++) {
      ctx.beginPath();
      ctx.strokeStyle = BAR_GRID_COLOR;
      ctx.lineWidth = 2;
      ctx.moveTo(i * subdivisionWidth * SUBDIVISIONS * BEATS_PER_BAR, 0);
      ctx.lineTo(i * subdivisionWidth * SUBDIVISIONS * BEATS_PER_BAR, height);
      ctx.stroke();
    }

    // Draw playhead
    console.log('Drawing playhead at position:', playheadPosition);
    const totalPositions = numberOfBars * 4;
    if (playheadPosition >= 0 && playheadPosition < totalPositions) {
      const playheadX = (playheadPosition * subdivisionWidth * SUBDIVISIONS);
      console.log('Calculated playhead X:', playheadX, 'subdivisionWidth:', subdivisionWidth, 'SUBDIVISIONS:', SUBDIVISIONS);
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
          ctx.fillStyle = USER_NOTE_COLOR;
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

  }, [numberOfBars, playheadPosition, userNotes, bpm]);

  return (
    <div style={{ margin: '20px 0' }}>
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