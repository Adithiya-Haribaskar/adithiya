/**
 * Transistor Charting Wrapper using Chart.js (2D) and Plotly.js (3D) (Upgraded)
 * Integrates dynamic Energy Band Diagram plotting (potential barriers).
 */

class TransistorCharts {
    constructor(outputCanvasId, transferCanvasId, bandCanvasId, surfaceDivId) {
        this.outputCtx = document.getElementById(outputCanvasId).getContext('2d');
        this.transferCtx = document.getElementById(transferCanvasId).getContext('2d');
        this.bandCtx = document.getElementById(bandCanvasId).getContext('2d');
        this.surfaceDivId = surfaceDivId;

        this.outputChart = null;
        this.transferChart = null;
        this.bandChart = null;
        
        this.colors = {
            accent: '#00dfd8',
            accent2: '#7928ca',
            grid: 'rgba(255, 255, 255, 0.06)',
            text: '#8f9cae',
            glow: 'rgba(0, 223, 216, 0.2)',
            lines: ['#ff0055', '#00f2fe', '#ffcc00', '#ff00ff', '#3388ff', '#00ff00']
        };

        this.initCharts();
    }

    initCharts() {
        // 1. Output Characteristics
        this.outputChart = new Chart(this.outputCtx, {
            type: 'line',
            data: { datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: this.colors.text, font: { family: 'Space Grotesk', size: 10 } } }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'Drain-Source Voltage V_ds (V)', color: this.colors.text, font: { family: 'Space Grotesk' } },
                        grid: { color: this.colors.grid },
                        ticks: { color: this.colors.text }
                    },
                    y: {
                        type: 'linear',
                        title: { display: true, text: 'Drain Current I_d (mA)', color: this.colors.text, font: { family: 'Space Grotesk' } },
                        grid: { color: this.colors.grid },
                        ticks: { color: this.colors.text }
                    }
                }
            }
        });

        // 2. Transfer Characteristics
        this.transferChart = new Chart(this.transferCtx, {
            type: 'line',
            data: { datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: this.colors.text, font: { family: 'Space Grotesk', size: 10 } } }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'Gate-Source Voltage V_gs (V)', color: this.colors.text, font: { family: 'Space Grotesk' } },
                        grid: { color: this.colors.grid },
                        ticks: { color: this.colors.text }
                    },
                    y: {
                        type: 'linear',
                        title: { display: true, text: 'Drain Current I_d (mA)', color: this.colors.text, font: { family: 'Space Grotesk' } },
                        grid: { color: this.colors.grid },
                        ticks: { color: this.colors.text }
                    }
                }
            }
        });

        // 3. Energy Band Diagram
        this.bandChart = new Chart(this.bandCtx, {
            type: 'line',
            data: { datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: this.colors.text, font: { family: 'Space Grotesk', size: 10 } } }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'Lateral Device Position (Source ── Channel ── Drain)', color: this.colors.text, font: { family: 'Space Grotesk' } },
                        grid: { color: this.colors.grid },
                        ticks: {
                            color: this.colors.text,
                            callback: function(value) {
                                if (value === 0.4) return 'Source';
                                if (value === 1.5) return 'Channel';
                                if (value === 2.6) return 'Drain';
                                return '';
                            }
                        },
                        min: 0,
                        max: 3.0
                    },
                    y: {
                        type: 'linear',
                        title: { display: true, text: 'Electron Energy E (eV)', color: this.colors.text, font: { family: 'Space Grotesk' } },
                        grid: { color: this.colors.grid },
                        ticks: { color: this.colors.text }
                    }
                }
            }
        });
    }

    updateOutputCurves(state, bias, maxVds = 3.0) {
        const vgsSteps = [0.8, 1.2, 1.6, 2.0, 2.4, 2.8];
        const datasets = [];
        const resolution = 30;

        vgsSteps.forEach((vgs, index) => {
            const dataPoints = [];
            for (let i = 0; i <= resolution; i++) {
                const vds = (i / resolution) * maxVds;
                const res = calculateId(state, vgs, vds, bias.Vbs);
                dataPoints.push({ x: vds, y: res.Id * 1000 });
            }

            datasets.push({
                label: `V_gs = ${vgs.toFixed(1)} V`,
                data: dataPoints,
                borderColor: this.colors.lines[index % this.colors.lines.length],
                borderWidth: 1.5,
                pointRadius: 0,
                tension: 0.1
            });
        });

        // Current operating point dot
        const currentId = calculateId(state, bias.Vgs, bias.Vds, bias.Vbs).Id * 1000;
        datasets.push({
            label: 'Operating Point',
            data: [{ x: bias.Vds, y: currentId }],
            borderColor: '#ffffff',
            backgroundColor: '#ff0055',
            pointRadius: 5,
            showLine: false
        });

        this.outputChart.data.datasets = datasets;
        this.outputChart.update('none');
    }

    updateTransferCurves(state, bias, isLogY = false, maxVgs = 3.0) {
        const vdsSteps = [0.1, 1.0, 2.5];
        const datasets = [];
        const resolution = 30;

        vdsSteps.forEach((vds, index) => {
            const dataPoints = [];
            for (let i = 0; i <= resolution; i++) {
                const vgs = (i / resolution) * maxVgs;
                const res = calculateId(state, vgs, vds, bias.Vbs);
                let current_mA = res.Id * 1000;
                
                if (isLogY) {
                    current_mA = Math.max(1e-6, current_mA);
                }
                dataPoints.push({ x: vgs, y: current_mA });
            }

            datasets.push({
                label: `V_ds = ${vds.toFixed(1)} V`,
                data: dataPoints,
                borderColor: this.colors.lines[(index + 3) % this.colors.lines.length],
                borderWidth: 1.5,
                pointRadius: 0,
                tension: 0.1
            });
        });

        let currentId = calculateId(state, bias.Vgs, bias.Vds, bias.Vbs).Id * 1000;
        if (isLogY) {
            currentId = Math.max(1e-6, currentId);
        }
        datasets.push({
            label: 'Operating Point',
            data: [{ x: bias.Vgs, y: currentId }],
            borderColor: '#ffffff',
            backgroundColor: '#ff0055',
            pointRadius: 5,
            showLine: false
        });

        this.transferChart.data.datasets = datasets;
        this.transferChart.options.scales.y.type = isLogY ? 'logarithmic' : 'linear';
        this.transferChart.options.scales.y.min = isLogY ? 1e-6 : undefined;
        this.transferChart.options.scales.y.max = isLogY ? 150 : undefined;
        this.transferChart.update('none');
    }

    updateBandDiagram(state, bias) {
        // Retrieve energy band coordinates
        const bands = getEnergyBands(state, bias.Vgs, bias.Vds, bias.Vbs);
        
        const ecData = [];
        const evData = [];
        const efiData = [];
        const efData = [];

        bands.forEach(pt => {
            ecData.push({ x: pt.x, y: pt.Ec });
            evData.push({ x: pt.x, y: pt.Ev });
            efiData.push({ x: pt.x, y: pt.EFi });
            efData.push({ x: pt.x, y: pt.EF });
        });

        const datasets = [
            {
                label: 'Conduction Band (E_c)',
                data: ecData,
                borderColor: '#00f2fe', // cyan glow
                borderWidth: 2.5,
                pointRadius: 0,
                tension: 0.1
            },
            {
                label: 'Valence Band (E_v)',
                data: evData,
                borderColor: '#7928ca', // purple
                borderWidth: 2.5,
                pointRadius: 0,
                tension: 0.1
            },
            {
                label: 'Fermi Level (E_F)',
                data: efData,
                borderColor: '#ffcc00', // gold dashed
                borderWidth: 1.5,
                borderDash: [5, 5],
                pointRadius: 0,
                tension: 0.1
            },
            {
                label: 'Intrinsic Fermi (E_Fi)',
                data: efiData,
                borderColor: 'rgba(255, 255, 255, 0.25)',
                borderWidth: 1,
                borderDash: [3, 6],
                pointRadius: 0,
                tension: 0.1
            }
        ];

        this.bandChart.data.datasets = datasets;
        this.bandChart.update('none');
    }

    update3DPlotlySurface(state, bias, maxVds = 3.0, maxVgs = 3.0) {
        const vdsRes = 18;
        const vgsRes = 18;

        const vdsArr = [];
        const vgsArr = [];
        const zData = [];

        for (let i = 0; i <= vdsRes; i++) vdsArr.push((i / vdsRes) * maxVds);
        for (let j = 0; j <= vgsRes; j++) vgsArr.push((j / vgsRes) * maxVgs);

        for (let j = 0; j < vgsArr.length; j++) {
            const row = [];
            for (let i = 0; i < vdsArr.length; i++) {
                const res = calculateId(state, vgsArr[j], vdsArr[i], bias.Vbs);
                row.push(res.Id * 1000); // mA
            }
            zData.push(row);
        }

        const opId = calculateId(state, bias.Vgs, bias.Vds, bias.Vbs).Id * 1000;

        const surfaceTrace = {
            z: zData,
            x: vdsArr,
            y: vgsArr,
            type: 'surface',
            colorscale: 'Electric',
            showscale: false,
            contours: { z: { show: true, usecolormap: true, project: { z: true } } }
        };

        const dotTrace = {
            x: [bias.Vds],
            y: [bias.Vgs],
            z: [opId],
            mode: 'markers',
            type: 'scatter3d',
            marker: { size: 6, color: '#ff0055', line: { color: '#ffffff', width: 1 } },
            name: 'Operating Point'
        };

        const layout = {
            scene: {
                xaxis: { title: 'V_ds (V)', gridcolor: '#1a2035', titlefont: { color: '#64748b', size: 9 }, tickfont: { color: '#64748b', size: 8 } },
                yaxis: { title: 'V_gs (V)', gridcolor: '#1a2035', titlefont: { color: '#64748b', size: 9 }, tickfont: { color: '#64748b', size: 8 } },
                zaxis: { title: 'I_d (mA)', gridcolor: '#1a2035', titlefont: { color: '#64748b', size: 9 }, tickfont: { color: '#64748b', size: 8 } },
                camera: { eye: { x: 1.4, y: -1.4, z: 1.1 } },
                backgroundColor: 'rgba(0,0,0,0)'
            },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            margin: { l: 0, r: 0, b: 0, t: 0 },
            showlegend: false
        };

        const config = { responsive: true, displayModeBar: false };
        Plotly.react(this.surfaceDivId, [surfaceTrace, dotTrace], layout, config);
    }
}
