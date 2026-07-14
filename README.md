# Quantum MOSFET Multi-Dimensional Simulator

An advanced, interactive **4th Dimension** NMOS/PMOS transistor simulator built with pure HTML, CSS, and JavaScript.

## Live Demo
🚀 **[https://Adithiya-Haribaskar.github.io/transistor-simulator](https://Adithiya-Haribaskar.github.io/transistor-simulator)**

## Features
- **3D Transistor Visualizer** (Three.js) with animated electrons & holes
- **5 Semiconductor Materials**: Si, Ge, GaAs, GaN, SiC
- **3 Gate Oxide Dielectrics**: SiO2, HfO2, Al2O3
- **All Operating Regions**: Cutoff, Subthreshold, Linear, Saturation, Avalanche Breakdown
- **Energy Band Diagram** (Potential Barrier chart)
- **Electric Field Vectors** (lateral & vertical)
- **Avalanche Breakdown** with spark particle system
- **Carrier Speed & Size controls** for electrons/holes
- **4D Parameter Sweep Engine** (Temperature, Length, Doping, Oxide)
- **Real-time Physics Assistant** explaining device physics
- **Interactive KaTeX Formula Inspector**

## Physics Models Implemented
- Caughey-Thomas doping-dependent mobility
- Temperature-scaled bandgap Eg(T) and intrinsic concentration ni(T)
- Body effect threshold voltage with body bias Vbs
- Velocity saturation and channel-length modulation
- Subthreshold conduction (weak inversion)
- Avalanche multiplication M = 1/(1-(Vds/VBD)^4)
- Dynamic energy band profiling along channel

## Tech Stack
- **Three.js** – WebGL 3D device rendering
- **Chart.js** – 2D characteristic graphs
- **Plotly.js** – Interactive 3D surface plot
- **KaTeX** – LaTeX math equation rendering

## Usage
Open `index.html` in any modern browser. No installation required.
