/**
 * MOSFET Physics Simulation Engine (Upgraded)
 * Computes electrical parameters, operating regions (including Breakdown),
 * and generates data for the dynamic Energy Band Diagram.
 */

// Fundamental Physical Constants (SI Units)
const Q_CHARGE = 1.602176634e-19; // Coulombs
const KB_JOULE = 1.380649e-23;    // J/K
const EPS_0 = 8.8541878128e-12;   // F/m

// Material Presets Database
const MATERIAL_DATABASE = {
    Si: {
        name: "Silicon (Si)",
        eg0: 1.17, // eV
        alpha: 4.73e-4, // eV/K
        beta: 636, // K
        epsR: 11.7,
        nc300: 2.8e19, // cm^-3
        nv300: 1.04e19, // cm^-3
        muMaxN: 1450, // cm^2/Vs
        muMinN: 65,
        nRefN: 8.5e16,
        alphaN: 0.72,
        muMaxP: 495,
        muMinP: 47.7,
        nRefP: 6.3e16,
        alphaP: 0.76,
        vSat0: 1.0e7, // cm/s
        chi: 4.05 // eV
    },
    Ge: {
        name: "Germanium (Ge)",
        eg0: 0.742,
        alpha: 4.77e-4,
        beta: 235,
        epsR: 16.0,
        nc300: 1.04e19,
        nv300: 6.0e18,
        muMaxN: 3900,
        muMinN: 250,
        nRefN: 1.0e17,
        alphaN: 0.7,
        muMaxP: 1900,
        muMinP: 150,
        nRefP: 8.0e16,
        alphaP: 0.75,
        vSat0: 6.0e6,
        chi: 4.0
    },
    GaAs: {
        name: "Gallium Arsenide (GaAs)",
        eg0: 1.519,
        alpha: 5.405e-4,
        beta: 204,
        epsR: 12.9,
        nc300: 4.7e17,
        nv300: 7.0e18,
        muMaxN: 8500,
        muMinN: 800,
        nRefN: 1.0e17,
        alphaN: 0.55,
        muMaxP: 400,
        muMinP: 50,
        nRefP: 3.0e17,
        alphaP: 0.6,
        vSat0: 7.7e6,
        chi: 4.07
    },
    GaN: {
        name: "Gallium Nitride (GaN)",
        eg0: 3.50,
        alpha: 9.09e-4,
        beta: 830,
        epsR: 8.9,
        nc300: 2.3e18,
        nv300: 4.6e19,
        muMaxN: 1000,
        muMinN: 120,
        nRefN: 1.5e17,
        alphaN: 0.65,
        muMaxP: 300,
        muMinP: 10,
        nRefP: 2.0e17,
        alphaP: 0.7,
        vSat0: 2.5e7,
        chi: 4.1
    },
    SiC: {
        name: "Silicon Carbide (4H-SiC)",
        eg0: 3.26,
        alpha: 6.5e-4,
        beta: 1300,
        epsR: 9.7,
        nc300: 1.8e19,
        nv300: 2.4e19,
        muMaxN: 900,
        muMinN: 40,
        nRefN: 2.0e17,
        alphaN: 0.6,
        muMaxP: 120,
        muMinP: 15,
        nRefP: 1.5e17,
        alphaP: 0.65,
        vSat0: 2.0e7,
        chi: 3.2
    }
};

// Dielectric / Oxide Presets
const OXIDE_DATABASE = {
    SiO2: { name: "Silicon Dioxide (SiO2)", epsR: 3.9 },
    HfO2: { name: "Hafnium Oxide (HfO2)", epsR: 25.0 },
    Al2O3: { name: "Aluminum Oxide (Al2O3)", epsR: 9.0 }
};

/**
 * Calculates physical properties of a transistor given its parameters.
 */
function calculateTransistorPhysics(params) {
    const {
        type,         // 'nmos' | 'pmos'
        material,     // 'Si' | 'Ge' | 'GaAs' | 'GaN' | 'SiC'
        oxide,        // 'SiO2' | 'HfO2' | 'Al2O3'
        W,            // meters
        L,            // meters
        tox,          // meters
        Nsub,         // cm^-3 (substrate doping)
        Nsd,          // cm^-3 (source/drain doping)
        T,            // Kelvin
        Vgs,          // Volts
        Vds,          // Volts
        Vbs,          // Volts
        Qfc = 1e11    // cm^-2 (fixed oxide charge density)
    } = params;

    const Vt = (KB_JOULE * T) / Q_CHARGE; // Thermal voltage (V)
    const mat = MATERIAL_DATABASE[material];
    const ox = OXIDE_DATABASE[oxide];

    // Bandgap Eg(T)
    const Eg = mat.eg0 - (mat.alpha * T * T) / (T + mat.beta); // eV

    // Densities of states
    const T_ratio = T / 300;
    const Nc = mat.nc300 * Math.pow(T_ratio, 1.5);
    const Nv = mat.nv300 * Math.pow(T_ratio, 1.5);

    // Intrinsic concentration ni
    const ni = Math.sqrt(Nc * Nv) * Math.exp(-Eg / (2 * Vt)); // cm^-3

    const epsS = mat.epsR * EPS_0;
    const epsOx = ox.epsR * EPS_0;
    const Cox = epsOx / tox;

    // Doping-dependent Mobility calculation (Caughey-Thomas Model)
    let mu0;
    if (type === 'nmos') {
        mu0 = mat.muMinN + (mat.muMaxN - mat.muMinN) / (1 + Math.pow(Nsub / mat.nRefN, mat.alphaN));
        mu0 = mu0 * Math.pow(300 / T, 2.0); 
    } else {
        mu0 = mat.muMinP + (mat.muMaxP - mat.muMinP) / (1 + Math.pow(Nsub / mat.nRefP, mat.alphaP));
        mu0 = mu0 * Math.pow(300 / T, 2.0); 
    }
    const mu0_m2 = mu0 * 1e-4;
    const vSat = mat.vSat0 * 1e-2 * Math.pow(300 / T, 0.5);

    // Fermi potentials
    const Nsub_safe = Math.max(Nsub, ni * 1.01);
    const PhiF = Vt * Math.log(Nsub_safe / ni);

    // Gate Workfunction Difference
    let PhiM, PhiSub;
    if (type === 'nmos') {
        PhiM = 4.05; // n+ poly
        PhiSub = mat.chi + Eg / 2 + PhiF;
    } else {
        PhiM = 5.17; // p+ poly
        PhiSub = mat.chi + Eg / 2 - PhiF;
    }
    const PhiMS = PhiM - PhiSub;

    // Flatband Voltage
    const Qfc_C = Qfc * 1e4 * Q_CHARGE;
    const Vfb = PhiMS - Qfc_C / Cox;

    // Body effect coefficient (gamma)
    const Nsub_m3 = Nsub * 1e6;
    const gamma = Math.sqrt(2 * Q_CHARGE * epsS * Nsub_m3) / Cox;

    // Threshold Voltages
    let Vth, Vth0;
    if (type === 'nmos') {
        const Vbs_term = Math.max(0, 2 * PhiF - Vbs);
        Vth = Vfb + 2 * PhiF + gamma * Math.sqrt(Vbs_term);
        Vth0 = Vfb + 2 * PhiF + gamma * Math.sqrt(2 * PhiF);
    } else {
        const Vbs_term = Math.max(0, 2 * PhiF + Vbs);
        Vth = Vfb - 2 * PhiF - gamma * Math.sqrt(Vbs_term);
        Vth0 = Vfb - 2 * PhiF - gamma * Math.sqrt(2 * PhiF);
    }

    // Effective vertical field mobility degradation
    const theta = 0.3e-9 / tox;
    const Vgs_Vth = type === 'nmos' ? (Vgs - Vth) : (Vth - Vgs);
    const muEff_m2 = Vgs_Vth > 0 ? (mu0_m2 / (1 + theta * Vgs_Vth)) : mu0_m2;

    const Ecrit = (2 * vSat) / muEff_m2;
    const lambda = 0.05 * (0.1e-6 / L);

    // Avalanche Breakdown Voltage Model
    // Higher doping yields lower breakdown voltage (avalanche multiplication)
    const V_BD = Math.min(12, Math.max(1.8, 6.0 * Math.pow(1e17 / Nsub, 0.5)));

    return {
        type, material, oxide, W, L, tox, Nsub, Nsd, T, Vgs, Vds, Vbs,
        Vt, Eg, ni, epsS, epsOx, Cox,
        mu0: mu0_m2, muEff: muEff_m2, vSat, PhiF, PhiMS, Vfb, gamma, Vth, Vth0, Ecrit, lambda, V_BD
    };
}

/**
 * Calculates the drain current Id incorporating Avalanche Breakdown
 */
function calculateId(state, Vgs, Vds, Vbs) {
    const Vt = state.Vt;
    const Cox = state.Cox;
    const W = state.W;
    const L = state.L;
    const epsS = state.epsS;
    const Nsub = state.Nsub;
    const tox = state.tox;
    const V_BD = state.V_BD;
    
    const Nsub_m3 = Nsub * 1e6;
    const gamma = Math.sqrt(2 * Q_CHARGE * epsS * Nsub_m3) / Cox;
    
    let Vth;
    if (state.type === 'nmos') {
        const Vbs_term = Math.max(0, 2 * state.PhiF - Vbs);
        Vth = state.Vfb + 2 * state.PhiF + gamma * Math.sqrt(Vbs_term);
    } else {
        const Vbs_term = Math.max(0, 2 * state.PhiF + Vbs);
        Vth = state.Vfb - 2 * state.PhiF - gamma * Math.sqrt(Vbs_term);
    }

    let Vgs_eff = Vgs;
    let Vds_eff = Vds;
    if (state.type === 'pmos') {
        Vgs_eff = -Vgs;
        Vds_eff = -Vds;
    }

    const Vgst = Vgs_eff - Vth;
    const theta = 0.3e-9 / tox;
    const muEff = Vgst > 0 ? (state.mu0 / (1 + theta * Vgst)) : state.mu0;

    let Id = 0;
    let region = "Cutoff";

    const Cdep = Math.sqrt((Q_CHARGE * epsS * Nsub_m3) / (2 * (2 * state.PhiF - (state.type === 'nmos' ? Vbs : -Vbs))));
    const nFactor = 1 + Cdep / Cox;

    const Ecrit = (2 * state.vSat) / muEff;
    const Vdsat = (Ecrit * L * Vgst) / (Vgst + Ecrit * L);

    if (Vgst <= 0) {
        region = "Cutoff";
        const Id0 = muEff * Cox * (W / L) * (nFactor - 1) * Vt * Vt;
        Id = Id0 * Math.exp(Vgst / (nFactor * Vt)) * (1 - Math.exp(-Vds_eff / Vt));
        if (Id > 1e-12) region = "Subthreshold";
    } else {
        if (Vds_eff < Vdsat) {
            region = "Linear";
            Id = muEff * Cox * (W / L) * (Vgst * Vds_eff - (Vds_eff * Vds_eff) / 2) / (1 + Vds_eff / (Ecrit * L));
        } else {
            region = "Saturation";
            Id = muEff * Cox * (W / L) * (Vgst * Vdsat - (Vdsat * Vdsat) / 2) / (1 + Vdsat / (Ecrit * L));
            Id = Id * (1 + state.lambda * (Vds_eff - Vdsat));
        }
    }

    // Apply avalanche multiplication if approaching breakdown voltage V_BD
    if (Vds_eff >= V_BD) {
        region = "Breakdown";
        // Multiplication factor: M = 1 / (1 - (Vds/V_BD)^4)
        // Cap multiplication factor to prevent infinity
        const vRatio = Vds_eff / V_BD;
        let M = 1 / Math.max(0.02, 1 - Math.pow(vRatio, 4));
        if (vRatio > 1.0) {
            M = 50 + (vRatio - 1.0) * 200; // soft exponential clamp
        }
        Id = Id * M;
    }

    return {
        Id: Math.max(0, Id),
        region: region,
        Vth: Vth,
        muEff: muEff,
        Vdsat: (state.type === 'nmos' ? 1 : -1) * Vdsat
    };
}

/**
 * Calculates energy band coordinates along the channel length (Source -> Channel -> Drain)
 * Returns arrays of {x, Ec, Ev, EFi, EF}
 */
function getEnergyBands(state, Vgs, Vds, Vbs) {
    const isNMOS = state.type === 'nmos';
    const Eg = state.Eg; // eV
    
    // Voltages mapping
    let Vgs_eff = isNMOS ? Vgs : -Vgs;
    let Vds_eff = isNMOS ? Vds : -Vds;
    
    // Fermi potential
    const phiF = state.PhiF;
    const Vth = calculateId(state, Vgs, Vds, Vbs).Vth;
    const Vgst = Vgs_eff - Vth;

    // Built-in junction barrier potential
    const Vbi = 0.8; // Built-in potential (~0.8V)

    // Calculate band bending in the channel surface potential psi_s
    let psi_s = 0;
    if (Vgst < 0) {
        // Depletion band bending: surface potential increases with Vgs
        psi_s = Math.max(0, 0.4 * Vgs_eff);
    } else {
        // Inversion: pinned at 2*phiF
        psi_s = 2 * phiF + 0.1 * Vgst; 
    }

    // Barrier height at source junction
    let barrierHeight = Vbi - psi_s;
    if (barrierHeight < 0.05) barrierHeight = 0.05; // minimum residual barrier

    const points = [];
    const resolution = 60;
    
    // x ranges from 0 to 3.0 (visual coordinates)
    // Source: 0 to 0.8
    // Channel: 0.8 to 2.2
    // Drain: 2.2 to 3.0
    for (let i = 0; i <= resolution; i++) {
        const x = (i / resolution) * 3.0;
        let Ec = 0;
        
        if (x < 0.8) {
            // Source Region (Flat band, Fermi level EF is at 0eV)
            // For NMOS, source is n+, so Ec is close to EF (e.g. 0.08 eV above EF)
            // For PMOS, source is p+, so Ev is close to EF, meaning Ec is higher
            Ec = isNMOS ? 0.08 : Eg - 0.08;
        } else if (x > 2.2) {
            // Drain Region (Flat band, shifted by Vds)
            // Electron energy E = -q * V.
            // For NMOS: Drain is at +Vds, so energy is lowered by Vds_eff
            // For PMOS: Drain is at -Vds (positive hole potential), so energy is raised
            const shift = isNMOS ? -Vds_eff : Vds_eff;
            const baseEc = isNMOS ? 0.08 : Eg - 0.08;
            Ec = baseEc + shift;
        } else {
            // Channel Region (x in [0.8, 2.2])
            const ratio = (x - 0.8) / 1.4; // 0 to 1 along channel
            
            // Peak barrier is at the source side (x = 0.8)
            // Potential tilts from Source to Drain based on Vds
            const baseBarrier = isNMOS ? 0.08 : Eg - 0.08;
            
            if (isNMOS) {
                // NMOS: Gate pulls bands DOWNWARDS (decreases barrierHeight)
                // Drain voltage tilts bands DOWNWARDS towards the drain
                const barrierPeak = baseBarrier + barrierHeight;
                // Tilt shape: smooth curve from peak down to drain boundary
                Ec = barrierPeak - (barrierPeak - (0.08 - Vds_eff)) * ratio;
            } else {
                // PMOS: Gate pulls bands UPWARDS (decreases barrier for holes, i.e., shifts valence band up, conduction band down)
                // Drain pulls bands UPWARDS (shifts energy up)
                const barrierPeak = baseBarrier - barrierHeight;
                Ec = barrierPeak - (barrierPeak - (Eg - 0.08 + Vds_eff)) * ratio;
            }
        }

        // Calculate other bands relative to Conduction Band Ec
        const Ev = Ec - Eg;
        const EFi = Ec - Eg / 2; // Intrinsic Fermi level
        
        // Fermi level flat in source, tilts/splits in channel due to bias
        // Simplification: plot EF flat at 0 in source, and flat at -Vds in drain
        let EF = 0;
        if (x > 2.2) {
            EF = isNMOS ? -Vds_eff : Vds_eff;
        } else if (x >= 0.8 && x <= 2.2) {
            const ratio = (x - 0.8) / 1.4;
            EF = isNMOS ? -Vds_eff * ratio : Vds_eff * ratio;
        }

        points.push({
            x: x,
            Ec: Ec,
            Ev: Ev,
            EFi: EFi,
            EF: EF
        });
    }

    return points;
}
