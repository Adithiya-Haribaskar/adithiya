/**
 * UI Coordination and Event Loop (Upgraded)
 * Connects inputs, physics solver, 3D WebGL scenes, 2D/3D charts,
 * updates variables math displays (LaTeX/KaTeX), and coordinates the dynamic Assistant.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. DOM Elements Query
    const uiElements = {
        btnNmos: document.getElementById('btn-nmos'),
        btnPmos: document.getElementById('btn-pmos'),
        inputVgs: document.getElementById('input-vgs'),
        inputVds: document.getElementById('input-vds'),
        inputVbs: document.getElementById('input-vbs'),
        selectMaterial: document.getElementById('select-material'),
        selectOxide: document.getElementById('select-oxide'),
        inputL: document.getElementById('input-l'),
        inputW: document.getElementById('input-w'),
        inputTox: document.getElementById('input-tox'),
        inputNsub: document.getElementById('input-nsub'),
        inputTemp: document.getElementById('input-temp'),
        
        // Particle controls
        inputPartSize: document.getElementById('input-part-size'),
        inputPartSpeed: document.getElementById('input-part-speed'),
        valPartSize: document.getElementById('val-part-size'),
        valPartSpeed: document.getElementById('val-part-speed'),

        // Value bubbles
        valVgs: document.getElementById('val-vgs'),
        valVds: document.getElementById('val-vds'),
        valVbs: document.getElementById('val-vbs'),
        valL: document.getElementById('val-l'),
        valW: document.getElementById('val-w'),
        valTox: document.getElementById('val-tox'),
        valNsub: document.getElementById('val-nsub'),
        valTemp: document.getElementById('val-temp'),
        
        // HUD displays
        hudId: document.getElementById('hud-id'),
        hudVth: document.getElementById('hud-vth'),
        hudMueff: document.getElementById('hud-mueff'),
        hudRegion: document.getElementById('hud-region'),
        
        // Dynamic labels
        lblVbs: document.getElementById('lbl-vbs'),
        matBadge: document.getElementById('mat-badge'),
        oxBadge: document.getElementById('ox-badge'),
        
        // 3D Controls
        btnToggleIons: document.getElementById('btn-toggle-ions'),
        btnToggleLattice: document.getElementById('btn-toggle-lattice'),
        btnToggleEFields: document.getElementById('btn-toggle-efields'),
        
        // Log plot button
        btnToggleLog: document.getElementById('btn-toggle-log'),
        
        // 4D Sweep Controls
        selectSweepVar: document.getElementById('select-sweep-var'),
        btnSweepPlay: document.getElementById('btn-sweep-play'),
        sweepVal: document.getElementById('sweep-val'),

        // Math Variables Readouts
        valMuNum: document.getElementById('val-mu-num'),
        valWlNum: document.getElementById('val-wl-num'),
        valVodNum: document.getElementById('val-vod-num'),
        valCoxNum: document.getElementById('val-cox-num'),
        valEcritNum: document.getElementById('val-ecrit-num'),
        valVbdNum: document.getElementById('val-vbd-num'),
        mathFormulaDiv: document.getElementById('math-formula'),

        // Assistant panel
        assistantBubble: document.getElementById('assistant-bubble')
    };

    // 2. Global Simulation State
    let state = {
        type: 'nmos',
        material: 'Si',
        oxide: 'SiO2',
        Vgs: 1.5,
        Vds: 1.0,
        Vbs: 0.0,
        L: 100e-9, // 100 nm
        W: 1.0e-6, // 1.0 um
        tox: 2.0e-9, // 2.0 nm
        Nsub: 1.0e17, // 10^17 cm^-3
        Nsd: 1.0e20,  // 10^20 cm^-3
        T: 300 // 300 Kelvin
    };

    let isLogY = false;
    let activeChartTab = 'out'; // out | trans | bands | mesh
    
    // Sweep engine properties
    let sweepInterval = null;
    let isSweeping = false;
    let sweepProgress = 0;

    // 3. Initialize Visualizer & Charts
    const viz = new Transistor3DVisualizer('visualizer-container');
    const charts = new TransistorCharts('chart-output', 'chart-transfer', 'chart-band', 'surface-3d-div');

    // 4. Update Simulation Loop
    function updateSimulation() {
        // Calculate physics
        const physicsState = calculateTransistorPhysics({
            type: state.type,
            material: state.material,
            oxide: state.oxide,
            W: state.W,
            L: state.L,
            tox: state.tox,
            Nsub: state.Nsub,
            Nsd: state.Nsd,
            T: state.T,
            Vgs: state.Vgs,
            Vds: state.Vds,
            Vbs: state.Vbs
        });

        // Calculate operating point results
        const result = calculateId(physicsState, state.Vgs, state.Vds, state.Vbs);

        // Update badges
        uiElements.matBadge.innerHTML = `Material: <strong>${MATERIAL_DATABASE[state.material].name}</strong>`;
        uiElements.oxBadge.innerHTML = `Oxide: <strong>${OXIDE_DATABASE[state.oxide].name}</strong>`;

        // Update HUD Values
        let idFormatted = "";
        if (result.Id >= 1e-3) {
            idFormatted = `${(result.Id * 1000).toFixed(3)} <span>mA</span>`;
        } else if (result.Id >= 1e-6) {
            idFormatted = `${(result.Id * 1e6).toFixed(3)} <span>µA</span>`;
        } else {
            idFormatted = `${(result.Id * 1e9).toFixed(3)} <span>nA</span>`;
        }
        uiElements.hudId.innerHTML = idFormatted;
        
        uiElements.hudVth.innerHTML = `${result.Vth.toFixed(3)} <span>V</span>`;
        uiElements.hudMueff.innerHTML = `${(result.muEff * 1e4).toFixed(1)} <span>cm²/Vs</span>`;
        
        uiElements.hudRegion.innerHTML = result.region;
        
        // Region HUD style changes
        const regionCard = document.getElementById('card-region');
        regionCard.className = "hud-card";
        if (result.region === "Saturation") {
            regionCard.classList.add("neon-glow-pink");
        } else if (result.region === "Linear") {
            regionCard.classList.add("neon-glow-cyan");
        } else if (result.region === "Cutoff" || result.region === "Subthreshold") {
            regionCard.classList.add("neon-glow-orange");
        } else if (result.region === "Breakdown") {
            regionCard.classList.add("neon-glow-pink"); // glow pink for danger
        }

        // Update 3D Visualizer variables
        viz.updatePhysics(physicsState, { Vgs: state.Vgs, Vds: state.Vds, Vbs: state.Vbs }, result);

        // Update Math Inspector Numbers
        uiElements.valMuNum.innerText = `${(result.muEff * 1e4).toFixed(0)} cm²/Vs`;
        uiElements.valWlNum.innerText = `${(state.W / state.L).toFixed(1)}`;
        
        const isNMOS = state.type === 'nmos';
        const Vgst = isNMOS ? (state.Vgs - result.Vth) : (result.Vth - state.Vgs);
        uiElements.valVodNum.innerText = Vgst > 0 ? `${Vgst.toFixed(2)} V` : "0.00 V (Cutoff)";
        
        uiElements.valCoxNum.innerText = `${(physicsState.Cox * 1e-2).toFixed(2)} µF/cm²`;
        uiElements.valEcritNum.innerText = `${(physicsState.Ecrit * 1e-5).toFixed(1)} kV/cm`;
        uiElements.valVbdNum.innerText = `${physicsState.V_BD.toFixed(2)} V`;

        // Update LaTeX formula based on region
        updateMathLaTeXFormula(result.region);

        // Update Assistant Conversation Message
        updateAssistantMessage(physicsState, result);

        // Update Charts
        if (activeChartTab === 'out') {
            charts.updateOutputCurves(physicsState, { Vgs: state.Vgs, Vds: state.Vds, Vbs: state.Vbs });
        } else if (activeChartTab === 'trans') {
            charts.updateTransferCurves(physicsState, { Vgs: state.Vgs, Vds: state.Vds, Vbs: state.Vbs }, isLogY);
        } else if (activeChartTab === 'bands') {
            charts.updateBandDiagram(physicsState, { Vgs: state.Vgs, Vds: state.Vds, Vbs: state.Vbs });
        } else if (activeChartTab === 'mesh') {
            charts.update3DPlotlySurface(physicsState, { Vgs: state.Vgs, Vds: state.Vds, Vbs: state.Vbs });
        }
    }

    // Helper to render KaTeX formula dynamically
    function updateMathLaTeXFormula(region) {
        let latex = "";
        switch (region) {
            case "Cutoff":
                latex = "I_d \\approx 0 \\quad (\\text{Carrier flow blocked by barrier})";
                break;
            case "Subthreshold":
                latex = "I_d = I_{sub0} \\exp\\left( \\frac{V_{gs} - V_{th}}{n V_t} \\right) \\left( 1 - e^{-V_{ds}/V_t} \\right)";
                break;
            case "Linear":
                latex = "I_d = \\mu_{eff} C_{ox} \\frac{W}{L} \\left[ (V_{gs} - V_{th}) V_{ds} - \\frac{V_{ds}^2}{2} \\right] (1 + \\lambda V_{ds})";
                break;
            case "Saturation":
                latex = "I_d = \\frac{1}{2} \\mu_{eff} C_{ox} \\frac{W}{L} (V_{gs} - V_{th})^2 (1 + \\lambda V_{ds})";
                break;
            case "Breakdown":
                latex = "I_d = I_{d0} \\times M = I_{d0} \\times \\frac{1}{1 - (V_{ds} / V_{BD})^4}";
                break;
            default:
                latex = "I_d = f(V_{gs}, V_{ds})";
        }
        
        try {
            katex.render(latex, uiElements.mathFormulaDiv, {
                displayMode: true,
                throwOnError: false
            });
        } catch (e) {
            uiElements.mathFormulaDiv.innerText = latex;
        }
    }

    // Dynamic Physics Explanation generator
    function updateAssistantMessage(physicsState, result) {
        const isNMOS = state.type === 'nmos';
        const matName = MATERIAL_DATABASE[state.material].name;
        const vth = result.Vth.toFixed(2);
        const vgs = state.Vgs.toFixed(2);
        const vds = state.Vds.toFixed(2);
        const region = result.region;

        let msg = "";

        switch (region) {
            case "Cutoff":
                msg = `Hi! The ${state.type.toUpperCase()} transistor is currently in <strong>Cutoff</strong> because the gate voltage ($V_{gs} = ${vgs}\\text{ V}$) is below the threshold voltage ($V_{th} = ${vth}\\text{ V}$). 
                Without sufficient gate potential, a high energy barrier exists at the source-channel interface, preventing carriers from drifting across. 
                <br><br>💡 <em>Physics Tip:</em> Switch to the <strong>Energy Bands</strong> chart to see the conduction band forming a high barrier peak. Drag the <strong>$V_{gs}$ slider</strong> above $V_{th}$ to bend the bands and lower the barrier!`;
                break;
            
            case "Subthreshold":
                msg = `We are in the <strong>Subthreshold leakage region</strong>. While $V_{gs}$ (${vgs}\\text{ V}$) is close to threshold, thermal fluctuations enable a small number of electrons to escape over the potential barrier, creating an exponential diffusion current.
                <br><br>💡 <em>Physics Tip:</em> Look at the <strong>Transfer Characteristics</strong> chart under <strong>Log Scale</strong>. You'll observe a straight line showing the exponential dependence. This leakage current is a major source of power dissipation in modern microchips!`;
                break;

            case "Linear":
                msg = `Excellent, the device is operating in the <strong>Linear (Triode) region</strong>! The gate voltage ($V_{gs} = ${vgs}\\text{ V}$) has pulled down the energy bands, creating a continuous channel of mobile charge carriers. The channel thickness is relatively uniform.
                <br><br>💡 <em>Physics Tip:</em> The current ($I_d$) increases almost proportionally with $V_{ds}$ here. The transistor acts like a voltage-controlled resistor. Look at the <strong>Output Characteristics</strong> curve: we are on the rising slope!`;
                break;

            case "Saturation":
                msg = `The device has entered <strong>Saturation</strong>! Because the drain bias ($V_{ds} = ${vds}\\text{ V}$) is high ($V_{ds} \\ge V_{gs} - V_{th}$), the channel has <strong>pinched off</strong> near the drain boundary. 
                <br><br>💡 <em>Physics Tip:</em> Watch the 3D model: the glowing carrier channel tapers down to zero near the drain. The electrons are swept across the drain depletion region at their maximum physical drift speed limit ($v_{sat} = ${(physicsState.vSat * 1e-2).toExponential(1)}\\text{ cm/s}$), causing the current to flatten.`;
                break;

            case "Breakdown":
                msg = `⚠️ <strong>AVALANCHE BREAKDOWN ACTIVE!</strong> The drain voltage ($V_{ds} = ${vds}\\text{ V}$) has exceeded the material breakdown threshold ($V_{BD} = ${physicsState.V_BD.toFixed(2)}\\text{ V}$). 
                <br><br>💡 <em>Physics Tip:</em> The electric field near the drain is so high that drifting carriers undergo <strong>impact ionization</strong>, crashing into the host ${matName} atoms and knocking out extra electrons and holes. This triggers a self-multiplying carrier cascade! Observe the white sparks and holes flying downwards into the substrate contact.`;
                break;
        }

        uiElements.assistantBubble.innerHTML = msg;
    }

    // 5. Binding UI Listeners
    
    // Type Selectors
    uiElements.btnNmos.addEventListener('click', () => {
        if (state.type !== 'nmos') {
            state.type = 'nmos';
            uiElements.btnNmos.classList.add('active');
            uiElements.btnPmos.classList.remove('active');
            uiElements.lblVbs.innerText = "Substrate Bias (V_bs)";
            uiElements.inputVbs.min = "-2.0";
            uiElements.inputVbs.max = "0.0";
            uiElements.inputVbs.value = "0.0";
            state.Vbs = 0.0;
            uiElements.valVbs.innerText = "0.00 V";
            updateSimulation();
        }
    });

    uiElements.btnPmos.addEventListener('click', () => {
        if (state.type !== 'pmos') {
            state.type = 'pmos';
            uiElements.btnPmos.classList.add('active');
            uiElements.btnNmos.classList.remove('active');
            uiElements.lblVbs.innerText = "Substrate Bias (V_bs)";
            uiElements.inputVbs.min = "0.0";
            uiElements.inputVbs.max = "2.0";
            uiElements.inputVbs.value = "0.0";
            state.Vbs = 0.0;
            uiElements.valVbs.innerText = "0.00 V";
            updateSimulation();
        }
    });

    // Bias sliders
    uiElements.inputVgs.addEventListener('input', (e) => {
        state.Vgs = parseFloat(e.target.value);
        uiElements.valVgs.innerText = `${state.Vgs.toFixed(2)} V`;
        updateSimulation();
    });

    uiElements.inputVds.addEventListener('input', (e) => {
        state.Vds = parseFloat(e.target.value);
        uiElements.valVds.innerText = `${state.Vds.toFixed(2)} V`;
        updateSimulation();
    });

    uiElements.inputVbs.addEventListener('input', (e) => {
        state.Vbs = parseFloat(e.target.value);
        uiElements.valVbs.innerText = `${state.Vbs.toFixed(2)} V`;
        updateSimulation();
    });

    // Material selectors
    uiElements.selectMaterial.addEventListener('change', (e) => {
        state.material = e.target.value;
        updateSimulation();
    });

    uiElements.selectOxide.addEventListener('change', (e) => {
        state.oxide = e.target.value;
        updateSimulation();
    });

    // Dimensions
    uiElements.inputL.addEventListener('input', (e) => {
        const valNm = parseInt(e.target.value);
        state.L = valNm * 1e-9;
        uiElements.valL.innerText = `${valNm} nm`;
        updateSimulation();
    });

    uiElements.inputW.addEventListener('input', (e) => {
        state.W = parseFloat(e.target.value) * 1e-6;
        uiElements.valW.innerText = `${parseFloat(e.target.value).toFixed(2)} µm`;
        updateSimulation();
    });

    uiElements.inputTox.addEventListener('input', (e) => {
        const valNm = parseFloat(e.target.value);
        state.tox = valNm * 1e-9;
        uiElements.valTox.innerText = `${valNm.toFixed(1)} nm`;
        updateSimulation();
    });

    // Advanced sliders
    uiElements.inputNsub.addEventListener('input', (e) => {
        const exponent = parseFloat(e.target.value);
        state.Nsub = Math.pow(10, exponent);
        uiElements.valNsub.innerText = `${state.Nsub.toExponential(1)} cm⁻³`;
        updateSimulation();
    });

    uiElements.inputTemp.addEventListener('input', (e) => {
        state.T = parseInt(e.target.value);
        uiElements.valTemp.innerText = `${state.T} K`;
        updateSimulation();
    });

    // Particle customization sliders
    uiElements.inputPartSize.addEventListener('input', (e) => {
        const sizeVal = parseFloat(e.target.value);
        viz.carrierSizeScale = sizeVal;
        uiElements.valPartSize.innerText = `${sizeVal.toFixed(1)}x`;
        updateSimulation();
    });

    uiElements.inputPartSpeed.addEventListener('input', (e) => {
        const speedVal = parseFloat(e.target.value);
        viz.carrierSpeedScale = speedVal;
        uiElements.valPartSpeed.innerText = `${speedVal.toFixed(1)}x`;
        updateSimulation();
    });

    // 3D overlays toggles
    uiElements.btnToggleIons.addEventListener('click', () => {
        uiElements.btnToggleIons.classList.toggle('active');
        viz.toggleIons(uiElements.btnToggleIons.classList.contains('active'));
    });

    uiElements.btnToggleLattice.addEventListener('click', () => {
        uiElements.btnToggleLattice.classList.toggle('active');
        viz.toggleLattice(uiElements.btnToggleLattice.classList.contains('active'));
    });

    uiElements.btnToggleEFields.addEventListener('click', () => {
        uiElements.btnToggleEFields.classList.toggle('active');
        viz.toggleEFields(uiElements.btnToggleEFields.classList.contains('active'));
    });

    // Log plot toggle
    uiElements.btnToggleLog.addEventListener('click', () => {
        isLogY = !isLogY;
        uiElements.btnToggleLog.classList.toggle('active');
        uiElements.btnToggleLog.innerText = isLogY ? "Log Scale: ON" : "Log Scale: OFF";
        updateSimulation();
    });

    // Analytics Tabs
    const tabButtons = document.querySelectorAll('.dashboard-tabs .tab-btn');
    const chartWrappers = document.querySelectorAll('.charts-content-viewport .chart-wrapper-box');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            chartWrappers.forEach(w => w.classList.remove('active'));

            btn.classList.add('active');
            const tabName = btn.getAttribute('data-chart');
            activeChartTab = tabName;

            // Display matching box
            document.getElementById(`box-chart-${tabName}`).classList.add('active');

            // Force reflow/draw charts
            setTimeout(() => {
                updateSimulation();
            }, 50);
        });
    });

    // 6. 4D Sweep Engine Scheduler
    uiElements.btnSweepPlay.addEventListener('click', () => {
        if (isSweeping) {
            isSweeping = false;
            clearInterval(sweepInterval);
            uiElements.btnSweepPlay.innerText = "PLAY 4D SWEEP";
            uiElements.btnSweepPlay.classList.remove('playing');
            uiElements.sweepVal.innerText = "Paused";
        } else {
            isSweeping = true;
            uiElements.btnSweepPlay.innerText = "PAUSE 4D SWEEP";
            uiElements.btnSweepPlay.classList.add('playing');
            
            const sweepVar = uiElements.selectSweepVar.value;

            sweepInterval = setInterval(() => {
                sweepProgress = (sweepProgress + 1.5) % 100;
                const ratio = sweepProgress / 100.0;
                
                if (sweepVar === 'T') {
                    const T_val = Math.round(100 + ratio * 400);
                    state.T = T_val;
                    uiElements.inputTemp.value = T_val;
                    uiElements.valTemp.innerText = `${T_val} K`;
                    uiElements.sweepVal.innerText = `Temp: ${T_val} K`;
                } else if (sweepVar === 'L') {
                    const L_nm = Math.round(10 + ratio * 990);
                    state.L = L_nm * 1e-9;
                    uiElements.inputL.value = L_nm;
                    uiElements.valL.innerText = `${L_nm} nm`;
                    uiElements.sweepVal.innerText = `Length: ${L_nm} nm`;
                } else if (sweepVar === 'Nsub') {
                    const log_val = 15.0 + ratio * 3.0;
                    state.Nsub = Math.pow(10, log_val);
                    uiElements.inputNsub.value = log_val;
                    uiElements.valNsub.innerText = `${state.Nsub.toExponential(1)} cm⁻³`;
                    uiElements.sweepVal.innerText = `Doping: ${state.Nsub.toExponential(1)} cm⁻³`;
                } else if (sweepVar === 'tox') {
                    const tox_nm = parseFloat((1.0 + ratio * 19.0).toFixed(1));
                    state.tox = tox_nm * 1e-9;
                    uiElements.inputTox.value = tox_nm;
                    uiElements.valTox.innerText = `${tox_nm} nm`;
                    uiElements.sweepVal.innerText = `Oxide t: ${tox_nm} nm`;
                }

                updateSimulation();
            }, 100);
        }
    });

    uiElements.selectSweepVar.addEventListener('change', () => {
        if (isSweeping) {
            uiElements.btnSweepPlay.click();
        }
    });

    // 7. Initial Simulation Trigger
    updateSimulation();
});
