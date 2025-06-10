# Music Mate - Your Musical AI Companion

A web-based AI music companion that listens, learns, and responds to your musical ideas in real-time. Whether you're creating music, exploring music therapy, or just having fun, Music Mate provides an interactive musical experience that adapts to your playing.

## Vision

Music Mate aims to be more than just a practice tool - it's a musical companion that can:
- **Respond to Your Ideas**: Listen to what you play and generate complementary musical responses
- **Adapt to Your Style**: Learn from your playing patterns and adapt its responses accordingly
- **Inspire Creativity**: Help you explore new musical ideas and directions
- **Support Music Therapy**: Provide a responsive, non-judgmental musical environment
- **Make Music Fun**: Create an engaging, interactive musical experience

## Features

- **Real-time Pitch Detection**: Uses the Web Audio API to detect notes as you play
- **Metronome**: Customizable tempo and time signature
- **Visual Feedback**: Real-time visualization of your playing
- **Note Tracking**: Keeps track of the notes you play during your session
- **Modern UI**: Clean, responsive interface built with React
- **AI Response**: Coming soon - AI-powered musical responses to your playing
- **MIDI Export**: Export your recorded notes as MIDI files for use in other music software

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A modern web browser (Chrome recommended)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/velde/ai-jam.git
cd ai-jam
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Start the development server:
```bash
npm start
# or
yarn start
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. Click "Start Jam" to begin a session
2. Allow microphone access when prompted
3. Play your instrument or sing - the app will detect and display the notes
4. Use the metronome controls to adjust tempo and time signature
5. Click "Stop Jam" to end the session

## Technical Details

- Built with React and JavaScript
- Uses Tone.js for audio synthesis and processing
- Implements pitch detection using the Pitchy library
- MIDI file generation with midi-writer-js
- Responsive design using CSS Grid and Flexbox
- AI integration coming soon!

## Roadmap & Future Plans

### AI Implementation Strategy

#### Phase 1: Basic Pattern Recognition
- Implement real-time musical pattern analysis using TensorFlow.js
- Use Magenta.js for basic music generation
- Focus on simple call-and-response patterns
- Implement basic chord progression analysis
- Add MIDI export for both user and AI-generated notes

#### Phase 2: Advanced Musical Understanding
- Integrate [Music Transformer](https://github.com/magenta/magenta-js/tree/master/music) for more sophisticated musical understanding
- Add support for:
  - Melodic contour analysis
  - Rhythmic pattern recognition
  - Harmonic progression prediction
  - Style transfer capabilities

#### Phase 3: Interactive AI Response
- Implement real-time AI response generation using:
  - [Tone.js](https://tonejs.github.io/) for sound synthesis
  - [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) for audio processing
  - [TensorFlow.js](https://www.tensorflow.org/js) for on-device inference
- Add features like:
  - Dynamic accompaniment generation
  - Melodic improvisation
  - Harmonic accompaniment
  - Rhythmic synchronization

#### Phase 4: Learning & Adaptation
- Implement user preference learning
- Add style adaptation capabilities
- Develop personalized response patterns
- Create a feedback loop for continuous improvement

### Technical Considerations
- **On-device Processing**: Prioritize client-side processing for low latency
- **Model Optimization**: Use quantized models for better performance
- **Audio Quality**: Maintain high-quality audio processing
- **Browser Compatibility**: Ensure cross-browser support
- **Performance**: Optimize for real-time interaction

### Potential Libraries & Tools
- [TensorFlow.js](https://www.tensorflow.org/js) - Machine learning
- [Magenta.js](https://github.com/magenta/magenta-js) - Music generation
- [Tone.js](https://tonejs.github.io/) - Audio synthesis
- [ONNX Runtime](https://onnxruntime.ai/) - Model inference
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) - Audio processing

### Development Priorities
1. Basic pattern recognition and response
2. Real-time performance optimization
3. User experience and interface improvements
4. Advanced AI features
5. Community feedback and iteration

## Contributing

Contributions are welcome! Whether you're interested in:
- Enhancing the AI response system
- Improving the audio processing
- Adding new features
- Fixing bugs
- Improving documentation

Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
## Acknowledgments

- [Tone.js](https://tonejs.github.io/) for audio processing
- [Pitchy](https://github.com/peterkhayes/pitchy) for pitch detection
- [React](https://reactjs.org/) for the UI framework

