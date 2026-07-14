/**
 * MOSFET 3D Device Visualizer using Three.js (Upgraded)
 * Implements:
 * 1. Multi-segment Bézier channel profile with dynamic pinch-off.
 * 2. Toggleable Electric Field vector arrows.
 * 3. Carrier Size and Speed scaling variables.
 * 4. Avalanche breakdown particle sparks emitter.
 * 5. Distinct electron/hole trajectories.
 */

class Transistor3DVisualizer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;

        // Settings
        this.showIons = true;
        this.showLattice = true;
        this.showEFields = true;
        
        // Carrier scale controls
        this.carrierSizeScale = 1.0;
        this.carrierSpeedScale = 1.0;
        
        // Physics state
        this.state = null;
        this.bias = { Vgs: 0, Vds: 0, Vbs: 0 };
        this.currentResult = { Id: 0, region: "Cutoff", Vth: 0 };

        // Carrier particles
        this.carriers = [];
        this.maxCarriers = 300;
        this.carrierGeometry = new THREE.SphereGeometry(0.06, 8, 8);
        this.electronMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.9 });
        this.holeMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.9 });

        // Spark particles (for Breakdown)
        this.sparks = [];
        this.sparkGeometry = new THREE.BoxGeometry(0.04, 0.04, 0.04);
        this.sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });

        // Group declarations
        this.donorsGroup = new THREE.Group();
        this.acceptorsGroup = new THREE.Group();
        this.latticeGroup = new THREE.Group();
        this.fieldArrowsGroup = new THREE.Group();
        this.channelSegmentsGroup = new THREE.Group();

        this.initScene();
        this.createDeviceGeometry();
        this.generateLatticeAndIons();
        this.initEFields();
        this.animate();

        window.addEventListener('resize', () => this.onWindowResize());
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x070b19); // even darker background

        this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 100);
        this.camera.position.set(6.5, 3.5, 7.5);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2 + 0.1;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
        dirLight.position.set(5, 10, 5);
        this.scene.add(dirLight);

        const pointLight1 = new THREE.PointLight(0x7928ca, 0.6, 15);
        pointLight1.position.set(-3, 2, -3);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x00f2fe, 0.6, 15);
        pointLight2.position.set(3, 2, 3);
        this.scene.add(pointLight2);
    }

    createDeviceGeometry() {
        // Materials setup
        this.materials = {
            substrateP: new THREE.MeshStandardMaterial({ color: 0x1a1530, transparent: true, opacity: 0.8, roughness: 0.8 }),
            substrateN: new THREE.MeshStandardMaterial({ color: 0x122530, transparent: true, opacity: 0.8, roughness: 0.8 }),
            sourceDrainN: new THREE.MeshStandardMaterial({ color: 0x006644, transparent: true, opacity: 0.75, roughness: 0.6 }),
            sourceDrainP: new THREE.MeshStandardMaterial({ color: 0x772b00, transparent: true, opacity: 0.75, roughness: 0.6 }),
            oxide: new THREE.MeshPhysicalMaterial({ color: 0x90d0ff, transparent: true, opacity: 0.35, roughness: 0.1, transmission: 0.7, thickness: 0.1 }),
            gate: new THREE.MeshStandardMaterial({ color: 0x2d3244, metalness: 0.8, roughness: 0.3 }),
            depletion: new THREE.MeshBasicMaterial({ color: 0xff0044, transparent: true, opacity: 0.1 }),
            inversion: new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.75 }),
            metalContacts: new THREE.MeshStandardMaterial({ color: 0x777988, metalness: 0.9, roughness: 0.2 })
        };

        this.deviceGroup = new THREE.Group();

        // 1. Substrate
        const subGeom = new THREE.BoxGeometry(6, 2, 4);
        this.substrateMesh = new THREE.Mesh(subGeom, this.materials.substrateP);
        this.substrateMesh.position.set(0, -1, 0);
        this.deviceGroup.add(this.substrateMesh);

        // 2. Source (x=-3 to -1.5)
        const sdGeom = new THREE.BoxGeometry(1.5, 0.8, 4);
        this.sourceMesh = new THREE.Mesh(sdGeom, this.materials.sourceDrainN);
        this.sourceMesh.position.set(-2.25, -0.4, 0);
        this.deviceGroup.add(this.sourceMesh);

        // 3. Drain (x=1.5 to 3)
        this.drainMesh = new THREE.Mesh(sdGeom, this.materials.sourceDrainN);
        this.drainMesh.position.set(2.25, -0.4, 0);
        this.deviceGroup.add(this.drainMesh);

        // 4. Oxide (x=-1.5 to 1.5, y=0 to 0.12)
        const oxGeom = new THREE.BoxGeometry(3.0, 0.12, 4.0);
        this.oxideMesh = new THREE.Mesh(oxGeom, this.materials.oxide);
        this.oxideMesh.position.set(0, 0.06, 0);
        this.deviceGroup.add(this.oxideMesh);

        // 5. Gate (x=-1.5 to 1.5, y=0.12 to 0.42)
        const gateGeom = new THREE.BoxGeometry(3.0, 0.3, 4.0);
        this.gateMesh = new THREE.Mesh(gateGeom, this.materials.gate);
        this.gateMesh.position.set(0, 0.27, 0);
        this.deviceGroup.add(this.gateMesh);

        // 6. Depletion Region (Dynamic scaling mesh)
        const depGeom = new THREE.BoxGeometry(3.0, 1.0, 4.0);
        this.depletionMesh = new THREE.Mesh(depGeom, this.materials.depletion);
        this.depletionMesh.position.set(0, -0.5, 0);
        this.deviceGroup.add(this.depletionMesh);

        // 7. Metal Contacts
        const contactGeom = new THREE.BoxGeometry(1.0, 0.08, 3.8);
        this.sContact = new THREE.Mesh(contactGeom, this.materials.metalContacts);
        this.sContact.position.set(-2.25, 0.04, 0);
        this.deviceGroup.add(this.sContact);

        this.dContact = new THREE.Mesh(contactGeom, this.materials.metalContacts);
        this.dContact.position.set(2.25, 0.04, 0);
        this.deviceGroup.add(this.dContact);

        const bContactGeom = new THREE.BoxGeometry(6.0, 0.08, 4.0);
        this.bContact = new THREE.Mesh(bContactGeom, this.materials.metalContacts);
        this.bContact.position.set(0, -2.04, 0);
        this.deviceGroup.add(this.bContact);

        // 8. Tapered Inversion Channel Segment Group
        // Constructing 10 segments along X to show custom channel thickness profile
        this.numSegments = 12;
        this.channelSegments = [];
        const segmentWidth = 3.0 / this.numSegments;
        for (let i = 0; i < this.numSegments; i++) {
            const segGeom = new THREE.BoxGeometry(segmentWidth, 0.1, 3.98);
            const segMesh = new THREE.Mesh(segGeom, this.materials.inversion);
            // Position segment along channel
            const xPos = -1.5 + (i + 0.5) * segmentWidth;
            segMesh.position.set(xPos, -0.05, 0);
            this.channelSegmentsGroup.add(segMesh);
            this.channelSegments.push(segMesh);
        }
        this.deviceGroup.add(this.channelSegmentsGroup);

        this.scene.add(this.deviceGroup);
        this.scene.add(this.donorsGroup);
        this.scene.add(this.acceptorsGroup);
        this.scene.add(this.latticeGroup);
        this.scene.add(this.fieldArrowsGroup);
    }

    generateLatticeAndIons() {
        while(this.donorsGroup.children.length > 0) this.donorsGroup.remove(this.donorsGroup.children[0]);
        while(this.acceptorsGroup.children.length > 0) this.acceptorsGroup.remove(this.acceptorsGroup.children[0]);
        while(this.latticeGroup.children.length > 0) this.latticeGroup.remove(this.latticeGroup.children[0]);

        const gridGeom = new THREE.SphereGeometry(0.025, 4, 4);
        const gridMat = new THREE.MeshBasicMaterial({ color: 0x3e4255, transparent: true, opacity: 0.1 });

        if (this.showLattice) {
            for (let x = -2.8; x <= 2.8; x += 0.4) {
                for (let y = -1.8; y <= -0.1; y += 0.45) {
                    for (let z = -1.8; z <= 1.8; z += 0.5) {
                        if (y > -0.8 && (x < -1.5 || x > 1.5)) continue;
                        const node = new THREE.Mesh(gridGeom, gridMat);
                        node.position.set(x, y, z);
                        this.latticeGroup.add(node);
                    }
                }
            }
        }

        const ionGeom = new THREE.SphereGeometry(0.045, 6, 6);
        const donorIonMat = new THREE.MeshBasicMaterial({ color: 0x00aaff }); // neon blue P+
        const acceptorIonMat = new THREE.MeshBasicMaterial({ color: 0xff0055 }); // neon red B-

        const isNMOS = !this.state || this.state.type === 'nmos';
        const subIonMat = isNMOS ? acceptorIonMat : donorIonMat;
        const sdIonMat = isNMOS ? donorIonMat : acceptorIonMat;

        // Substrate dopant ions
        for (let i = 0; i < 50; i++) {
            const x = (Math.random() - 0.5) * 5.6;
            const y = -0.1 - Math.random() * 1.7;
            const z = (Math.random() - 0.5) * 3.6;

            if (y > -0.8 && (x < -1.5 || x > 1.5)) continue;

            const ion = new THREE.Mesh(ionGeom, subIonMat);
            ion.position.set(x, y, z);
            ion.userData = { baseY: y, baseX: x, baseZ: z };
            
            if (isNMOS) {
                this.acceptorsGroup.add(ion);
            } else {
                this.donorsGroup.add(ion);
            }
        }

        // Source & Drain doping ions
        for (let i = 0; i < 40; i++) {
            let x = -2.25 + (Math.random() - 0.5) * 1.3;
            let y = -0.1 - Math.random() * 0.6;
            let z = (Math.random() - 0.5) * 3.6;
            
            let ionS = new THREE.Mesh(ionGeom, sdIonMat);
            ionS.position.set(x, y, z);
            
            x = 2.25 + (Math.random() - 0.5) * 1.3;
            y = -0.1 - Math.random() * 0.6;
            z = (Math.random() - 0.5) * 3.6;
            
            let ionD = new THREE.Mesh(ionGeom, sdIonMat);
            ionD.position.set(x, y, z);

            if (isNMOS) {
                this.donorsGroup.add(ionS);
                this.donorsGroup.add(ionD);
            } else {
                this.acceptorsGroup.add(ionS);
                this.acceptorsGroup.add(ionD);
            }
        }
    }

    initEFields() {
        // Create 3D arrows to represent lateral and vertical electric fields
        // Vertical Field (Ey, Gate oxide down into substrate)
        this.vFieldArrows = [];
        const dirY = new THREE.Vector3(0, -1, 0);
        for (let xVal = -1.0; xVal <= 1.0; xVal += 0.8) {
            for (let zVal = -1.2; zVal <= 1.2; zVal += 1.2) {
                const origin = new THREE.Vector3(xVal, 0.05, zVal);
                const arrow = new THREE.ArrowHelper(dirY, origin, 0.3, 0xff00ff, 0.1, 0.06);
                this.fieldArrowsGroup.add(arrow);
                this.vFieldArrows.push(arrow);
            }
        }

        // Lateral Field (Ex, Drain x=1.5 towards Source x=-1.5)
        this.lFieldArrows = [];
        const dirX = new THREE.Vector3(-1, 0, 0);
        for (let xVal = -1.2; xVal <= 1.2; xVal += 0.8) {
            for (let zVal = -0.8; zVal <= 0.8; zVal += 1.6) {
                const origin = new THREE.Vector3(xVal, -0.05, zVal);
                const arrow = new THREE.ArrowHelper(dirX, origin, 0.3, 0x00ff88, 0.1, 0.06);
                this.fieldArrowsGroup.add(arrow);
                this.lFieldArrows.push(arrow);
            }
        }
    }

    updatePhysics(state, bias, currentResult) {
        this.state = state;
        this.bias = bias;
        this.currentResult = currentResult;

        const isNMOS = state.type === 'nmos';
        
        // Color updates
        if (isNMOS) {
            this.substrateMesh.material = this.materials.substrateP;
            this.sourceMesh.material = this.materials.sourceDrainN;
            this.drainMesh.material = this.materials.sourceDrainN;
            this.materials.inversion.color.setHex(0x00ffff); // cyan
        } else {
            this.substrateMesh.material = this.materials.substrateN;
            this.sourceMesh.material = this.materials.sourceDrainP;
            this.drainMesh.material = this.materials.sourceDrainP;
            this.materials.inversion.color.setHex(0xffaa00); // orange
        }

        // Doping-dependent ions check
        const currentIonsType = this.donorsGroup.userData.type || 'none';
        if (currentIonsType !== state.type) {
            this.generateLatticeAndIons();
            this.donorsGroup.userData.type = state.type;
        }

        // 1. Dynamic Depletion Region width
        const Vbs_val = isNMOS ? bias.Vbs : -bias.Vbs;
        const phi = 2 * state.PhiF;
        const depWidthFactor = Math.min(1.8, 0.4 + 0.35 * Math.sqrt(Math.max(0.05, phi - Vbs_val)));
        this.depletionMesh.scale.y = depWidthFactor;
        this.depletionMesh.position.y = -depWidthFactor / 2;

        // 2. Inversion Channel Segment-by-Segment Tapering (Bézier Profile)
        const Vgst = isNMOS ? (bias.Vgs - currentResult.Vth) : (currentResult.Vth - bias.Vgs);
        const Vds_eff = isNMOS ? bias.Vds : -bias.Vds;
        const Vdsat = isNMOS ? currentResult.Vdsat : -currentResult.Vdsat;

        if (Vgst > 0) {
            this.channelSegmentsGroup.visible = true;
            this.materials.inversion.opacity = 0.85;

            // Set height segment-by-segment
            // Linear/Saturation profile: thickness drops along channel
            for (let i = 0; i < this.numSegments; i++) {
                const ratio = i / (this.numSegments - 1); // 0 to 1 along channel (source to drain)
                let thickness = 0;

                if (Vds_eff >= Vdsat) {
                    // Saturation (Pinch-off near drain): Thickness goes to 0 near drain (ratio = 1.0)
                    // We model this using quadratic decay (1 - ratio)^2
                    const maxThick = Math.min(1.2, 0.05 + Vgst * 0.4);
                    thickness = maxThick * Math.pow(1 - ratio, 2);
                } else {
                    // Linear: Thickness drops slightly towards drain, but remains open
                    const maxThick = Math.min(1.2, 0.05 + Vgst * 0.4);
                    const dropRatio = Vds_eff / (Vdsat || 1.0); // 0 to 1
                    const endRatio = 1.0 - dropRatio * 0.7; // drain end has at least 30% thickness
                    // Linear interpolation
                    const segRatio = 1.0 - ratio * (1.0 - endRatio);
                    thickness = maxThick * segRatio;
                }

                // Minimum visible thickness when inverted
                thickness = Math.max(0.02, thickness);
                
                this.channelSegments[i].scale.y = thickness;
                // Position offset so it attaches to oxide boundary (y = 0)
                this.channelSegments[i].position.y = -thickness * 0.05;
            }
        } else {
            this.channelSegmentsGroup.visible = false;
        }

        // 3. Ions Glow Update
        const depBottom = -depWidthFactor;
        const subIonsGroup = isNMOS ? this.acceptorsGroup : this.donorsGroup;
        subIonsGroup.children.forEach(ion => {
            const y = ion.userData.baseY;
            if (y > depBottom) {
                ion.scale.set(1.4, 1.4, 1.4);
            } else {
                ion.scale.set(1.0, 1.0, 1.0);
            }
        });

        // 4. Electric Field Arrows scaling
        if (this.showEFields) {
            this.fieldArrowsGroup.visible = true;
            
            // Vertical Field (scales with Vgs)
            const vLen = Math.min(0.8, 0.05 + Math.abs(bias.Vgs) * 0.25);
            this.vFieldArrows.forEach(arrow => {
                arrow.scale.set(1, vLen / 0.3, 1);
                // Flip direction if Vgs is negative
                if (bias.Vgs < 0) {
                    arrow.setDirection(new THREE.Vector3(0, 1, 0));
                } else {
                    arrow.setDirection(new THREE.Vector3(0, -1, 0));
                }
            });

            // Lateral Field (scales with Vds)
            const lLen = Math.min(0.8, 0.05 + Math.abs(bias.Vds) * 0.25);
            this.lFieldArrows.forEach(arrow => {
                arrow.scale.set(1, lLen / 0.3, 1);
                // Field points from Drain (+Vds) to Source for NMOS, opposite for PMOS
                if (isNMOS) {
                    arrow.setDirection(new THREE.Vector3(-1, 0, 0));
                } else {
                    arrow.setDirection(new THREE.Vector3(1, 0, 0));
                }
            });
        } else {
            this.fieldArrowsGroup.visible = false;
        }

        // 5. Speed and carrier count
        this.updateCarriersFlow(Vgst, isNMOS, currentResult.Id);
    }

    updateCarriersFlow(Vgst, isNMOS, Id) {
        // Adjust electron/hole counts based on current
        const currentScale = Id * 1e5;
        const targetCarriersCount = Math.min(this.maxCarriers, Math.floor(12 + currentScale));

        while (this.carriers.length < targetCarriersCount) {
            this.spawnCarrier(isNMOS);
        }
        while (this.carriers.length > targetCarriersCount) {
            const c = this.carriers.pop();
            this.scene.remove(c.mesh);
        }

        // Scale geometry sizes dynamically
        this.carriers.forEach(c => {
            c.mesh.scale.set(this.carrierSizeScale, this.carrierSizeScale, this.carrierSizeScale);
        });

        // Drift speed scaling
        this.carrierDriftSpeed = Math.min(0.18, 0.003 + Id * 1e4);
    }

    spawnCarrier(isNMOS, forceSource = false) {
        const mesh = new THREE.Mesh(this.carrierGeometry, isNMOS ? this.electronMaterial : this.holeMaterial);
        
        let x, y, z;
        if (forceSource || Math.random() < 0.35) {
            // Source recess
            x = -2.5 + Math.random() * 0.8;
            y = -0.05 - Math.random() * 0.5;
        } else {
            // Along channel
            x = -1.5 + Math.random() * 3.0;
            y = -0.01 - Math.random() * 0.1;
        }
        z = (Math.random() - 0.5) * 3.5;

        mesh.position.set(x, y, z);
        mesh.scale.set(this.carrierSizeScale, this.carrierSizeScale, this.carrierSizeScale);
        this.scene.add(mesh);

        this.carriers.push({
            mesh: mesh,
            x: x,
            y: y,
            z: z,
            vx: 0,
            vy: 0,
            vz: 0,
            type: isNMOS ? 'electron' : 'hole'
        });
    }

    triggerBreakdownSparks() {
        // Spawn glowing white spark particles near the drain junction (x = 1.5)
        const count = 5;
        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(this.sparkGeometry, this.sparkMaterial);
            // Spawn at drain oxide corner
            const x = 1.5 + (Math.random() - 0.5) * 0.3;
            const y = -0.05 + (Math.random() - 0.5) * 0.2;
            const z = (Math.random() - 0.5) * 3.6;
            
            mesh.position.set(x, y, z);
            this.scene.add(mesh);
            
            this.sparks.push({
                mesh: mesh,
                x: x,
                y: y,
                z: z,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.8) * 0.4, // shoot downward mostly
                vz: (Math.random() - 0.5) * 0.4,
                life: 1.0 // opacity decays
            });
        }

        // Spawn extra cascade hole/electron carriers zipping away
        if (this.carriers.length < this.maxCarriers) {
            this.spawnCarrier(true, false); // extra electron
            this.spawnCarrier(false, false); // extra hole (sweeps to substrate!)
        }
    }

    toggleIons(show) {
        this.showIons = show;
        this.donorsGroup.visible = show;
        this.acceptorsGroup.visible = show;
    }

    toggleLattice(show) {
        this.showLattice = show;
        this.latticeGroup.visible = show;
        this.generateLatticeAndIons();
    }

    toggleEFields(show) {
        this.showEFields = show;
        this.fieldArrowsGroup.visible = show;
    }

    onWindowResize() {
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();

        const isNMOS = !this.state || this.state.type === 'nmos';
        const Vds_val = this.bias ? this.bias.Vds : 0;
        const Vgst = this.state ? (isNMOS ? (this.bias.Vgs - this.currentResult.Vth) : (this.currentResult.Vth - this.bias.Vgs)) : 0;
        const isPinchOff = this.state && (isNMOS ? (Vds_val >= this.currentResult.Vdsat) : (-Vds_val >= -this.currentResult.Vdsat));
        const isBreakdown = this.currentResult.region === "Breakdown";

        // 1. Spark particles animation (avalanche breakdown sparks)
        if (isBreakdown) {
            this.triggerBreakdownSparks();
        }

        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const sp = this.sparks[i];
            sp.x += sp.vx;
            sp.y += sp.vy;
            sp.z += sp.vz;
            sp.life -= 0.1 * this.carrierSpeedScale;
            
            sp.mesh.position.set(sp.x, sp.y, sp.z);
            sp.mesh.material.opacity = sp.life;
            
            if (sp.life <= 0) {
                this.scene.remove(sp.mesh);
                this.sparks.splice(i, 1);
            }
        }

        // 2. Animate charge carriers (Drude Model)
        const baseSpeed = 0.16 * this.carrierSpeedScale;
        const tempVal = this.state ? this.state.T : 300;
        // Thermal random walk intensity
        const scatteringIntensity = 0.012 * Math.sqrt(tempVal / 300) * this.carrierSpeedScale;

        for (let i = 0; i < this.carriers.length; i++) {
            const c = this.carriers[i];

            // Brownian scattering step
            const rx = (Math.random() - 0.5) * scatteringIntensity;
            const ry = (Math.random() - 0.5) * scatteringIntensity;
            const rz = (Math.random() - 0.5) * scatteringIntensity;

            let driftX = 0;
            let driftY = 0;

            // Electrons (NMOS carriers) & Holes (PMOS carriers) drift paths
            if (Vgst > 0) {
                // Vertical field pulling them to the oxide interface (y = -0.04)
                const pullY = -0.04 - c.y;
                driftY = pullY * 0.06 * this.carrierSpeedScale;

                if (c.x >= -2.25 && c.x <= 2.25) {
                    if (isPinchOff && c.x > 0.4) {
                        // Pinch off acceleration
                        driftX = this.carrierDriftSpeed * 2.2 * this.carrierSpeedScale;
                        // Path narrows down
                        const pathY = -0.12 - c.y;
                        driftY = pathY * 0.15 * this.carrierSpeedScale;
                    } else {
                        // Standard channel drift
                        driftX = this.carrierDriftSpeed * this.carrierSpeedScale;
                    }
                }
            } else {
                // Cutoff / Subthreshold: slow diffusion drift
                driftX = this.carrierDriftSpeed * 0.08 * this.carrierSpeedScale;
            }

            // Direction flips based on type
            // NMOS: electrons drift source (left) -> drain (right)
            // PMOS: holes drift source (left) -> drain (right)
            // Avalanche: secondary holes generated in breakdown get swept to the substrate (y < -1.0)
            if (isBreakdown && c.type === 'hole' && isNMOS) {
                // Sweep breakdown holes to substrate bottom
                driftX = -this.carrierDriftSpeed * 1.5 * this.carrierSpeedScale;
                driftY = -0.15 * this.carrierSpeedScale;
            }

            c.x += driftX + rx;
            c.y += driftY + ry;
            c.z += rz;

            // Boundaries
            if (c.z > 1.9) c.z = 1.9;
            if (c.z < -1.9) c.z = -1.9;

            // Recirculate if reached collector or exited substrate
            if (c.x > 2.55 || c.y < -1.95) {
                // Respawn at Source contact (x = -2.5)
                c.x = -2.5 + Math.random() * 0.4;
                c.y = -0.05 - Math.random() * 0.4;
                c.z = (Math.random() - 0.5) * 3.6;
            }
            // Left side leak boundary
            if (c.x < -2.8) c.x = -2.7;

            c.mesh.position.set(c.x, c.y, c.z);
        }

        this.renderer.render(this.scene, this.camera);
    }
}
