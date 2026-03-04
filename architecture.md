## IV. System Architecture

The Smart Cradle Monitor architecture is designed as a robust, high-concurrency system that integrates real-time IoT data with edge-based Deep Learning. The architecture is modular, allowing for independent scaling of the AI inference engine and the web management dashboard.

### A. Perception Layer (Hardware & Data Acquisition)
This layer handles the physical interaction with the infant's environment.
- **Visual Capture**: Uses a high-definition camera module (simulated or CSI/USB) to provide a continuous raw image stream for the Vision AI engine.
- **Sensors**: 
    - **Thermal Monitoring**: DHT22 digital sensor for high-precision temperature and humidity tracking.
    - **Acoustic Analysis**: High-sensitivity microphone for detecting infant vocalization frequencies associated with crying.
- **Actuators**: 
    - **Dynamic Rocking**: MG996R High Torque Servo controlled via PWM (Pulse Width Modulation) for variable-speed cradle movement.
    - **Audio Feedback**: Integrated speaker for automated lullaby playback and parent-to-child communication.

### B. Vision AI & Deep Learning Architecture (Core Engine)
The system's intelligence is powered by a multi-stage Deep Learning pipeline, specifically utilizing the YOLO (You Only Look Once) architecture for real-time inference.

#### 1. Model Selection: YOLOv11
We utilize **YOLOv11 (Ultralytics)**, the latest iteration in the YOLO family, chosen for its superior speed-to-accuracy ratio. Specifically, the system employs:
- **YOLOv11s-seg ([yoloe-11s-seg.pt](file:///c:/fyp/SmartCradleMonitor/models/yoloe-11s-seg.pt))**: A segmentation-based model that goes beyond simple bounding boxes to provide pixel-level masks of the infant and surrounding objects.
- **Custom Posture Model ([best.pt](file:///c:/fyp/SmartCradleMonitor/simulator/models/best.pt))**: A specialized model trained to classify infant sleep positions (Back, Stomach, Side).

#### 2. Deep Learning Inference Pipeline
The inference workflow follows a rigorous sequence to ensure safety-critical performance:
1.  **Frame Pre-processing**: Raw frames are normalized, resized to $640 \times 640$, and converted to the appropriate tensor format.
2.  **Backbone Extraction**: The CSPDarknet backbone extracts high-level spatial features.
3.  **Neck & Head Processing**: The Path Aggregation Network (PANet) fuses multi-scale features, while the detection heads predict class probabilities and segmentation masks.
4.  **Post-processing & NMS**: Non-Maximum Suppression (NMS) is applied with a confidence threshold of 0.7 to eliminate redundant detections.
5.  **Heuristic Safety Analysis**: A custom logic layer interprets the model outputs (e.g., if "Back" is detected without "Face", trigger a stomach-sleeping alert).

#### 3. Hazard Detection Logic
The system maintains a dynamic list of hazardous objects. The Deep Learning model is trained to identify:
- **Suffocation Hazards**: Loose pillows, plush toys, and heavy blankets.
- **Physical Hazards**: Sharp objects or small items that pose a choking risk.
- **Posture Risks**: Detecting if the infant's nose or mouth is obstructed by the sleeping surface.

### C. Processing Layer (Backend & Logic)
The backend acts as the central nervous system, orchestrating data between the AI engine and the user.
- **Framework**: Node.js with Express.js for high-throughput asynchronous I/O.
- **Real-time Synchronization**: A dedicated WebSocket server handles the low-latency broadcast of AI detection events to the dashboard.
- **Persistence**: PostgreSQL with [Drizzle ORM](file:///c:/fyp/SmartCradleMonitor/server/db.ts) for structured storage of historical detection logs and sensor telemetry.

### D. Application Layer (Frontend & Visualization)
- **Framework**: React.js with Vite for a performant, reactive UI.
- **AI Overlay**: A custom canvas-based rendering engine that overlays the AI segmentation masks and bounding boxes on the live video feed.
- **Actionable Insights**: Real-time charts using Recharts to visualize the correlation between infant movement and environmental factors.
