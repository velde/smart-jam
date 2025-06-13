# Smart Jam - Your Musical AI Companion

A web-based AI music companion that listens, learns, and responds to your musical ideas in real-time. Whether you're creating music, exploring music therapy, or just having fun, Smart Jam provides an interactive musical experience that adapts to your playing.

## Vision

Smart Jam aims to be more than just a practice tool - it's a musical companion that can:
- **Respond to Your Ideas**: Listen to what you play and generate complementary musical responses
- **Adapt to Your Style**: Learn from your playing patterns and adapt its responses accordingly
- **Inspire Creativity**: Help you explore new musical ideas and directions
- **Support Music Therapy**: Provide a responsive, non-judgmental musical environment
- **Make Music Fun**: Create an engaging, interactive musical experience

## Features

- **Real-time Note Detection**: 
  - Uses Web Audio API and Pitchy for accurate pitch detection
  - Visual waveform display
  - Input level monitoring
  - Multiple microphone support

- **Interactive Grid System**:
  - Adjustable number of bars (2, 4, or 8)
  - Multiple grid divisions (32nd, 16th, or 8th notes)
  - Configurable maximum note duration
  - Add/Replace note modes
  - Real-time playhead visualization

- **AI Musical Response**:
  - Powered by Magenta.js and TensorFlow.js
  - Real-time musical pattern analysis
  - Generates complementary responses to your playing
  - Maintains musical context and style
  - Separate visualization for AI responses

- **Metronome**:
  - Adjustable tempo (40-200 BPM)
  - Visual and optional audible click
  - Synchronized with note detection

- **Export Options**:
  - MIDI export with separate tracks for user and AI notes
  - Uses @tonejs/midi for high-quality MIDI generation
  - Preserves timing and velocity information

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A modern web browser (Chrome recommended for best audio performance)
- A microphone or audio input device

### Installation

1. Clone the repository:
```bash
git clone https://github.com/velde/smart-jam.git
cd smart-jam
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Start a Jam Session**:
   - Select your input device
   - Adjust the tempo using the slider
   - Click "Start" to begin

2. **Play Your Instrument**:
   - The grid will show your notes in real-time
   - Use the mode button to switch between adding and replacing notes
   - Watch the waveform and pitch detection displays

3. **AI Collaboration**:
   - The AI will generate responses based on your playing
   - Responses appear in the lower grid
   - Export both parts as MIDI for further use

## Browser Compatibility

- Chrome (recommended)
- Firefox (requires additional configuration)
- Edge
- Safari (limited support)

## Technical Details

- Built with React and JavaScript
- Uses Tone.js for audio synthesis and processing
- Implements pitch detection using the Pitchy library
- AI powered by Magenta.js and TensorFlow.js
- MIDI generation with @tonejs/midi
- Responsive design using CSS Grid and Flexbox

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

This code is published for demonstration purposes only.
All rights reserved © Velde Vainio.
No commercial use or redistribution is permitted without written permission.

## Acknowledgments

This project uses the following open-source libraries:

- [React](https://reactjs.org/) - MIT License
- [Tone.js](https://tonejs.github.io/) - MIT License
- [@tonejs/midi](https://github.com/Tonejs/Midi) - MIT License
- [Pitchy](https://github.com/peterkhayes/pitchy) - MIT License
- [Magenta.js](https://github.com/magenta/magenta-js) - Apache License 2.0

While this project is proprietary, we acknowledge and appreciate the open-source community's contributions through these excellent libraries. Each library's license is included in the `node_modules` directory of this project.

