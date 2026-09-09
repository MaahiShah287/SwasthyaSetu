// SwasthyaSetu AI - Static Demo Script

// --- State Management ---
const state = {
    theme: localStorage.getItem('theme') || 'light',
    user: {
        name: localStorage.getItem('userName') || 'Siddh Dharod',
        role: 'patient'
    },
    datasets: JSON.parse(localStorage.getItem('datasets')) || [
        { topic: 'Global Oncology Trends', description: 'Comprehensive analysis of cancer incidences 2020-2025.', link: 'https://who.int/cancer', category: 'Research' },
        { topic: 'Cardiovascular Risk Map', description: 'Predictive data for heart disease risk across urban populations.', link: 'https://heart.org', category: 'Clinical' }
    ],
    currentPage: 'dashboard',
    searchSuggestions: [
        "Check Blood Glucose levels",
        "Recent CBC report trends",
        "Insurance claim #8812 status",
        "Oncology dataset methodology",
        "Cardiovascular risk assessment",
        "Update patient emergency node"
    ]
};

// --- DOM References ---
const contentArea = document.getElementById('content');
const themeToggle = document.getElementById('theme-toggle');
const welcomeName = document.getElementById('welcome-name');
const userNameDisplay = document.getElementById('user-name');
const searchInput = document.querySelector('.search-box input');
const searchBox = document.querySelector('.search-box');

// --- Navigation Logic ---
const routes = {
    dashboard: () => renderDashboard(),
    upload: () => renderUpload(),
    reports: () => renderReports(),
    claims: () => renderClaims(),
    sandbox: () => renderSandbox(),
    settings: () => renderSettings(),
    diseases: () => renderDiseases(),
    profile: () => renderProfile(),
    problems: () => renderProblems(),
    ideas: () => renderIdeas(),
};

function navigate() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    state.currentPage = hash;
    
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === hash);
    });

    if (routes[hash]) {
        routes[hash]();
    } else {
        renderDashboard();
    }
    
    // Smooth scroll to top
    contentArea.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Re-initialize Lucide icons
    if (window.lucide) lucide.createIcons();
}

window.addEventListener('hashchange', navigate);
window.addEventListener('DOMContentLoaded', () => {
    initTheme();
    updateUserUI();
    initSearchSimulation();
    navigate();
});

// --- Theme Management ---
function initTheme() {
    if (state.theme === 'dark') document.body.classList.add('dark');
    updateThemeIcon();
}

themeToggle.addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', state.theme);
    updateThemeIcon();
});

function updateThemeIcon() {
    const icon = themeToggle.querySelector('i');
    if (state.theme === 'dark') {
        icon.setAttribute('data-lucide', 'sun');
    } else {
        icon.setAttribute('data-lucide', 'moon');
    }
    if (window.lucide) lucide.createIcons();
}

function updateUserUI() {
    if (welcomeName) welcomeName.textContent = state.user.name;
    if (userNameDisplay) userNameDisplay.textContent = state.user.name;
}

// --- Page Renderers ---

function renderDashboard() {
    contentArea.innerHTML = `
        <div class="mb-8">
            <h2 class="text-4xl font-bold">Welcome back, <span style="color: var(--accent-primary);">${state.user.name}</span></h2>
            <p class="text-slate-500 mt-1">Here's a quick look at your health ecosystem today.</p>
        </div>

        <div class="card-grid">
            <div class="premium-card">
                <p class="card-title">Health Score</p>
                <p class="card-value">85%</p>
                <div style="font-size: 10px; font-weight: 800; color: var(--medical-green); padding: 4px 12px; border-radius: 20px; background: rgba(34, 197, 94, 0.1); width: fit-content;">+2% improvement</div>
            </div>
            <div class="premium-card">
                <p class="card-title">Reports Filed</p>
                <p class="card-value">12</p>
                <div style="font-size: 10px; font-weight: 800; color: var(--accent-primary); padding: 4px 12px; border-radius: 20px; background: rgba(37, 99, 235, 0.1); width: fit-content;">Updated Live</div>
            </div>
            <div class="premium-card">
                <p class="card-title">Claim Status</p>
                <p class="card-value">Active</p>
                <div style="font-size: 10px; font-weight: 800; color: var(--secondary-teal); padding: 4px 12px; border-radius: 20px; background: rgba(13, 148, 136, 0.1); width: fit-content;">AI Audited</div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 40px;">
            <div>
                <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 24px; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="file-text" style="color: var(--accent-primary);"></i> Diagnostic Timeline
                </h3>
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <div class="premium-card" style="display: flex; align-items: center; gap: 20px;">
                        <div style="padding: 12px; background: rgba(37, 99, 235, 0.05); color: var(--accent-primary); border-radius: 12px;">
                            <i data-lucide="file-check"></i>
                        </div>
                        <div style="flex: 1;">
                            <p style="font-weight: 700;">Complete Blood Count</p>
                            <p style="font-size: 12px; color: var(--text-secondary);">Processed by AI • Oct 12, 2026</p>
                        </div>
                        <div style="font-size: 10px; font-weight: 800; color: var(--medical-green);">VERIFIED</div>
                    </div>
                    <div class="premium-card" style="display: flex; align-items: center; gap: 20px;">
                        <div style="padding: 12px; background: rgba(37, 99, 235, 0.05); color: var(--accent-primary); border-radius: 12px;">
                            <i data-lucide="shield-check"></i>
                        </div>
                        <div style="flex: 1;">
                            <p style="font-weight: 700;">Insurance Claim Audit</p>
                            <p style="font-size: 12px; color: var(--text-secondary);">No discrepancies found • Oct 10, 2026</p>
                        </div>
                        <div style="font-size: 10px; font-weight: 800; color: var(--accent-primary);">SECURE</div>
                    </div>
                </div>
            </div>
            <div>
                <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 24px; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="plus" style="color: var(--secondary-teal);"></i> Clinic Actions
                </h3>
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <button class="btn btn-primary" onclick="window.location.hash = '#upload'">Vault Upload</button>
                    <button class="btn btn-primary" onclick="window.location.hash = '#claims'" style="background: var(--secondary-teal);">Clinical Audit</button>
                </div>
            </div>
        </div>
    `;
}

function renderUpload() {
    contentArea.innerHTML = `
        <div class="mb-8">
            <h2 class="text-4xl font-bold">Vault <span style="color: var(--accent-primary);">Upload</span></h2>
            <p class="text-slate-500 mt-1">Capture and analyze medical documentation using Universal AI OCR.</p>
        </div>

        <div class="premium-card" style="padding: 60px; text-align: center; border: 2px dashed var(--border-main); display: flex; flex-direction: column; align-items: center; gap: 20px;">
            <div style="width: 80px; height: 80px; background: rgba(37, 99, 235, 0.05); color: var(--accent-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <i data-lucide="upload-cloud" size="40"></i>
            </div>
            <div>
                <h3 style="font-size: 24px; font-weight: 700;">Drop reports or photos here</h3>
                <p class="text-slate-500 mt-2">Supports PDF, JPG, PNG up to 25MB</p>
            </div>
            <input type="file" id="file-input" style="display: none;">
            <button class="btn btn-primary" onclick="simulateUpload()">Select File</button>
            <div id="upload-status" style="margin-top: 20px; display: none; width: 100%; max-width: 400px;">
                <p id="status-text" style="font-weight: 700; margin-bottom: 8px;">Uploading...</p>
                <div style="height: 6px; background: var(--border-main); border-radius: 10px; overflow: hidden;">
                    <div id="progress-bar" style="height: 100%; background: var(--accent-primary); width: 0%; transition: width 0.3s;"></div>
                </div>
            </div>
        </div>

        <div id="analysis-result" style="margin-top: 40px; display: none;">
            <h3 style="font-size: 22px; font-weight: 800; margin-bottom: 20px;">AI Ingestion Summary</h3>
            <div class="premium-card" style="background: var(--bg-primary);">
                <p id="ai-summary" style="line-height: 1.6; font-style: italic; color: var(--text-primary);"></p>
                <div style="margin-top: 20px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                    <div style="padding: 16px; background: white; border-radius: 12px;">
                        <p style="font-size: 10px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Confidence</p>
                        <p style="font-size: 24px; font-weight: 800; color: var(--medical-green);">98.2%</p>
                    </div>
                    <div style="padding: 16px; background: white; border-radius: 12px;">
                        <p style="font-size: 10px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Entities Found</p>
                        <p style="font-size: 24px; font-weight: 800; color: var(--accent-primary);">14</p>
                    </div>
                    <div style="padding: 16px; background: white; border-radius: 12px;">
                        <p style="font-size: 10px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Audit Flags</p>
                        <p style="font-size: 24px; font-weight: 800; color: var(--medical-warning);">None</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function simulateUpload() {
    const status = document.getElementById('upload-status');
    const statusText = document.getElementById('status-text');
    const bar = document.getElementById('progress-bar');
    const result = document.getElementById('analysis-result');
    const aiText = document.getElementById('ai-summary');

    status.style.display = 'block';
    result.style.display = 'none';

    let progress = 0;
    const interval = setInterval(() => {
        progress += 5;
        bar.style.width = progress + '%';
        
        if (progress === 30) statusText.textContent = 'Scanning image...';
        if (progress === 60) statusText.textContent = 'Extracting clinical data...';
        if (progress === 90) statusText.textContent = 'Generating AI Summary...';

        if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                status.style.display = 'none';
                result.style.display = 'block';
                aiText.textContent = "Analysis of 'Diagnostic_Report_Oct.pdf' reveals standard metabolic values. Blood glucose levels (102 mg/dL) are slightly elevated but within controlled range. No immediate anomalies detected in cardiovascular markers. Recommended follow-up in 3 months.";
                if (window.lucide) lucide.createIcons();
            }, 500);
        }
    }, 100);
}

function renderSandbox() {
    contentArea.innerHTML = `
        <div class="mb-8" style="display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
                <h2 class="text-4xl font-bold">Data <span style="color: #6366f1;">Sandbox</span></h2>
                <p class="text-slate-500 mt-1">Integrated repository for decentralized medical research datasets.</p>
            </div>
            <button class="btn btn-primary" style="background: #6366f1;" onclick="openDatasetModal()">Register Dataset</button>
        </div>

        <div style="margin-bottom: 32px; position: relative;" id="sandbox-search-container">
            <div class="search-box" style="width: 100%; max-width: 500px;">
                <i data-lucide="filter" size="18"></i>
                <input type="text" placeholder="Filter by methodology or topic..." onkeyup="filterDatasets(this.value)">
            </div>
        </div>

        <div id="dataset-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 24px;">
            ${state.datasets.map((d, i) => `
                <div class="premium-card dataset-item" data-topic="${d.topic}">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="font-size: 10px; font-weight: 800; background: rgba(99, 102, 241, 0.1); color: #6366f1; padding: 4px 10px; border-radius: 20px;">${d.category}</span>
                        <div style="display: flex; gap: 8px;">
                            <i data-lucide="external-link" size="16" style="color: var(--text-secondary); cursor: pointer;" onclick="window.open('${d.link}', '_blank')"></i>
                        </div>
                    </div>
                    <h4 style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">${d.topic}</h4>
                    <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 20px;">${d.description}</p>
                    <button class="btn" style="width: 100%; border: 1px solid #6366f1; color: #6366f1; background: transparent;" onclick="window.open('${d.link}', '_blank')">Access Source</button>
                </div>
            `).join('')}
        </div>

        <div id="modal-backdrop" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: none; z-index: 200; align-items: center; justify-content: center;">
            <div class="premium-card" style="width: 100%; max-width: 500px; padding: 32px;">
                <h3 style="font-size: 24px; font-weight: 800; margin-bottom: 24px;">Register New Dataset</h3>
                <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px;">
                    <div>
                        <label style="display: block; font-size: 12px; font-weight: 800; color: var(--text-secondary); margin-bottom: 6px;">TOPIC</label>
                        <input type="text" id="new-topic" style="width: 100%; height: 44px; border-radius: 12px; border: 1px solid var(--border-main); padding: 0 16px;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 12px; font-weight: 800; color: var(--text-secondary); margin-bottom: 6px;">DESCRIPTION</label>
                        <textarea id="new-desc" style="width: 100%; height: 100px; border-radius: 12px; border: 1px solid var(--border-main); padding: 12px 16px; font-family: inherit; resize: none;"></textarea>
                    </div>
                    <div>
                        <label style="display: block; font-size: 12px; font-weight: 800; color: var(--text-secondary); margin-bottom: 6px;">SOURCE LINK (URL)</label>
                        <input type="text" id="new-link" style="width: 100%; height: 44px; border-radius: 12px; border: 1px solid var(--border-main); padding: 0 16px;">
                    </div>
                </div>
                <div style="display: flex; gap: 12px;">
                    <button class="btn" style="flex: 1; background: var(--bg-primary); border: 1px solid var(--border-main);" onclick="closeDatasetModal()">Cancel</button>
                    <button class="btn btn-primary" style="flex: 2; background: #6366f1;" onclick="addDataset()">Complete Registration</button>
                </div>
            </div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

function openDatasetModal() { document.getElementById('modal-backdrop').style.display = 'flex'; }
function closeDatasetModal() { document.getElementById('modal-backdrop').style.display = 'none'; }

function addDataset() {
    const topic = document.getElementById('new-topic').value;
    const desc = document.getElementById('new-desc').value;
    const link = document.getElementById('new-link').value;

    if (!topic || !desc || !link) {
        alert("Please authorize all required fields.");
        return;
    }

    const newDataset = { topic, description: desc, link, category: 'Community' };
    state.datasets.unshift(newDataset);
    localStorage.setItem('datasets', JSON.stringify(state.datasets));
    
    closeDatasetModal();
    renderSandbox();
}

function filterDatasets(query) {
    const q = query.toLowerCase();
    document.querySelectorAll('.dataset-item').forEach(el => {
        const topic = el.dataset.topic.toLowerCase();
        el.style.display = topic.includes(q) ? 'block' : 'none';
    });
}

function renderClaims() {
    contentArea.innerHTML = `
        <div class="mb-8">
            <h2 class="text-4xl font-bold">Clinical <span style="color: var(--secondary-teal);">Audit</span></h2>
            <p class="text-slate-500 mt-1">Cross-referencing medical claims against AI fraudulent patterns.</p>
        </div>

        <div style="display: grid; grid-template-columns: 350px 1fr; gap: 32px;">
            <div class="premium-card" style="height: fit-content;">
                <h4 style="font-weight: 800; margin-bottom: 20px;">Audit Integrity Score</h4>
                <div style="margin: 30px 0; text-align: center;">
                    <svg width="160" height="160" viewBox="0 0 160 160">
                        <circle cx="80" cy="80" r="70" fill="none" stroke="var(--border-main)" stroke-width="12" />
                        <circle cx="80" cy="80" r="70" fill="none" stroke="var(--secondary-teal)" stroke-width="12" 
                                stroke-dasharray="440" stroke-dashoffset="44" stroke-linecap="round" />
                        <text x="50%" y="50%" dy=".3em" text-anchor="middle" font-size="32" font-weight="800" fill="var(--text-primary)">92%</text>
                    </svg>
                </div>
                <p style="font-size: 13px; color: var(--text-secondary); text-align: center;">Your documentation profile shows high adherence to medical standards.</p>
            </div>

            <div class="space-y-6">
                <h3 style="font-size: 18px; font-weight: 800;">Recent Audit Operations</h3>
                <div class="premium-card">
                    <p style="font-weight: 700; margin-bottom: 4px;">Discrepancy Check #8812</p>
                    <p style="font-size: 12px; color: var(--text-secondary);">Radiology Report vs Pathology Records</p>
                    <div style="margin-top: 16px; padding: 12px; background: rgba(34, 197, 94, 0.05); border-radius: 8px; border: 1px solid rgba(34, 197, 94, 0.2); color: var(--medical-green); font-size: 12px; font-weight: 600;">
                        ✓ 100% Correlation found. No risk indicators.
                    </div>
                </div>
                <div class="premium-card">
                    <p style="font-weight: 700; margin-bottom: 4px;">Policy Verification #4421</p>
                    <p style="font-size: 12px; color: var(--text-secondary);">Medication Reimbursement Review</p>
                    <div style="margin-top: 16px; padding: 12px; background: rgba(245, 158, 11, 0.05); border-radius: 8px; border: 1px solid rgba(245, 158, 11, 0.2); color: var(--medical-warning); font-size: 12px; font-weight: 600;">
                        ! Missing physician node signature. Pending authorization.
                    </div>
                </div>
            </div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

function renderDiseases() {
    contentArea.innerHTML = `
        <div class="mb-8">
            <h2 class="text-4xl font-bold">Outbreak <span style="color: #f43f5e;">Radar</span></h2>
            <p class="text-slate-500 mt-1">Simulated epidemiological data visualization and epidemic tracking.</p>
        </div>
        <div class="premium-card" style="height: 500px; display: flex; items-center; justify-content: center; background: #0f172a; border-color: #f43f5e33;">
            <div style="text-align: center;">
                <div style="width: 120px; height: 120px; border: 4px solid #f43f5e; border-top-color: transparent; border-radius: 50%; animation: spin 2s linear infinite; margin: 0 auto 32px;"></div>
                <h3 style="color: white; font-size: 24px; font-weight: 800;">Real-time Mapping Active</h3>
                <p style="color: #94a3b8; margin-top: 12px;">Synthesizing geographical health node data...</p>
            </div>
        </div>
        <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;
    if (window.lucide) lucide.createIcons();
}

function renderReports() {
    contentArea.innerHTML = `
        <div class="mb-8">
            <h2 class="text-4xl font-bold">Medical <span style="color: var(--accent-primary);">Records</span></h2>
            <p class="text-slate-500 mt-1">Historical clinical documentation and AI-extracted insights.</p>
        </div>
        <div style="display: flex; flex-direction: column; gap: 16px;">
            <div class="premium-card" style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 20px;">
                    <div style="padding: 14px; background: rgba(37, 99, 235, 0.05); color: var(--accent-primary); border-radius: 12px;"><i data-lucide="file-text"></i></div>
                    <div>
                        <p style="font-weight: 800;">Complete Metabolic Panel</p>
                        <p style="font-size: 12px; color: var(--text-secondary);">Diagnostics Laboratory • Sep 24, 2026</p>
                    </div>
                </div>
                <button class="btn" style="border: 1px solid var(--border-main); background: transparent;">View AI Analysis</button>
            </div>
             <div class="premium-card" style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 20px;">
                    <div style="padding: 14px; background: rgba(37, 99, 235, 0.05); color: var(--accent-primary); border-radius: 12px;"><i data-lucide="file-text"></i></div>
                    <div>
                        <p style="font-weight: 800;">MRI Brain Scan - Contrast</p>
                        <p style="font-size: 12px; color: var(--text-secondary);">Neurology Center • Aug 14, 2026</p>
                    </div>
                </div>
                <button class="btn" style="border: 1px solid var(--border-main); background: transparent;">View AI Analysis</button>
            </div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

function renderProfile() {
    contentArea.innerHTML = `
        <div class="mb-8">
            <h2 class="text-4xl font-bold">Patient <span style="color: #ec4899;">Identity</span></h2>
            <p class="text-slate-500 mt-1">Verified patient node and emergency biometric credentials.</p>
        </div>
        <div style="display: grid; grid-template-columns: 350px 1fr; gap: 32px;">
            <div class="premium-card" style="text-align: center; padding-top: 48px;">
                <div style="width: 120px; height: 120px; background: #ec4899; color: white; border-radius: 24px; display: flex; items-center; justify-content: center; margin: 0 auto 24px;">
                    <i data-lucide="user" size="60"></i>
                </div>
                <h3 style="font-size: 24px; font-weight: 800;">${state.user.name}</h3>
                <p style="font-size: 12px; font-weight: 800; color: #ec4899; text-transform: uppercase; margin-top: 4px;">Verified Patient Node</p>
                <div style="margin-top: 32px; border-top: 1px solid var(--border-main); padding-top: 24px; text-align: left;">
                    <p style="font-size: 10px; font-weight: 800; color: var(--text-secondary); margin-bottom: 12px;">EMERGENCY ACCESS CODE</p>
                    <div style="background: var(--bg-primary); padding: 12px; border-radius: 12px; font-family: monospace; font-weight: 800; border: 1px solid var(--border-main);">SS-AI-9921-XRT</div>
                </div>
            </div>
            <div class="space-y-6">
                <div class="premium-card">
                    <h4 style="font-weight: 800; margin-bottom: 20px;">Health Markers</h4>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <div style="display: flex; justify-content: space-between;"><span>Blood Type</span><span style="font-weight: 800;">O Positive</span></div>
                        <div style="display: flex; justify-content: space-between;"><span>Allergies</span><span style="font-weight: 800; color: #f43f5e;">Penicillin, Shellfish</span></div>
                        <div style="display: flex; justify-content: space-between;"><span>Primary Provider</span><span style="font-weight: 800;">Dr. Aris Thorne</span></div>
                    </div>
                </div>
                 <div class="premium-card" style="border-color: #ec489933;">
                    <h4 style="font-weight: 800; margin-bottom: 20px; color: #ec4899;">Biometric Security</h4>
                    <p style="font-size: 14px; color: var(--text-secondary);">Last biometric verification: Oct 17, 2026. Secure Enclave status: ACTIVE.</p>
                </div>
            </div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

function renderProblems() {
    contentArea.innerHTML = `
        <div class="mb-8">
            <h2 class="text-4xl font-bold">Research <span style="color: #8b5cf6;">Challenges</span></h2>
            <p class="text-slate-500 mt-1">Open problems in clinical medicine seeking technological breakthroughs.</p>
        </div>
        <div style="display: flex; flex-direction: column; gap: 20px;">
             <div class="premium-card" style="border-left: 6px solid #8b5cf6;">
                <h4 style="font-size: 20px; font-weight: 800; margin-bottom: 12px;">Non-Invasive Glucose Monitoring</h4>
                <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 20px;">Seeking high-fidelity optical sensors for real-time interstitial fluid glucose tracking without needles.</p>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 12px; font-weight: 800; color: #8b5cf6;">$25,000 GRANT AVAILABLE</span>
                    <button class="btn btn-primary" style="background: #8b5cf6;">Submit Solution</button>
                </div>
            </div>
             <div class="premium-card" style="border-left: 6px solid #8b5cf6;">
                <h4 style="font-size: 20px; font-weight: 800; margin-bottom: 12px;">Post-Stroke Rehabilitation VR</h4>
                <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 20px;">Gamifying neuro-rehabilitation exercises to increase patient adherence and motor skill recovery.</p>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 12px; font-weight: 800; color: #8b5cf6;">$12,000 GRANT AVAILABLE</span>
                    <button class="btn btn-primary" style="background: #8b5cf6;">Submit Solution</button>
                </div>
            </div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

function renderIdeas() {
    contentArea.innerHTML = `
        <div class="mb-8">
            <h2 class="text-4xl font-bold">Clinical <span style="color: #f59e0b;">Ideas</span></h2>
            <p class="text-slate-500 mt-1">AI-facilitated brainstorming engine for future clinical workflows.</p>
        </div>
        <div class="premium-card" style="background: #fffbeb; border-color: #f59e0b33;">
            <div style="display: flex; gap: 20px; align-items: center;">
                <div style="padding: 16px; background: #f59e0b; color: white; border-radius: 12px;"><i data-lucide="sparkles"></i></div>
                <div>
                    <h4 style="font-weight: 800; color: #92400e;">Autonomous Triage Assistant</h4>
                    <p style="font-size: 14px; color: #b45309;">Idea generated by AI Node Alpha-7 based on recent Emergency Room bottlenecks.</p>
                </div>
            </div>
            <div style="margin-top: 24px; padding: 20px; background: white; border-radius: 16px; border: 1px solid #fde68a;">
                <p style="font-size: 14px; line-height: 1.6; color: #92400e;">Implement a voice-activated LLM workstation at the check-in desk to automatically categorize patient urgency while gathering initial symptoms via natural speech.</p>
            </div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

function renderSettings() {
    contentArea.innerHTML = `
        <div class="mb-8">
            <h2 class="text-4xl font-bold">User <span style="color: var(--text-secondary);">Preferences</span></h2>
            <p class="text-slate-500 mt-1">Manage global AI interaction tokens and secure node configurations.</p>
        </div>
        <div class="premium-card space-y-8">
            <div>
                <h4 style="font-weight: 800; margin-bottom: 16px;">General Configuration</h4>
                <div style="display: flex; items-center; justify-content: space-between; padding-bottom: 16px; border-bottom: 1px solid var(--border-main);">
                    <div><p style="font-weight: 700;">Biometric Lock</p><p style="font-size: 12px; color: var(--text-secondary);">Require verification for medical vault access.</p></div>
                    <div style="width: 48px; height: 24px; background: var(--accent-primary); border-radius: 20px; padding: 3px;"><div style="width: 18px; height: 18px; background: white; border-radius: 50%; translate: 24px;"></div></div>
                </div>
            </div>
            <div>
                 <div style="display: flex; items-center; justify-content: space-between; padding-bottom: 16px; border-bottom: 1px solid var(--border-main);">
                    <div><p style="font-weight: 700;">Privacy Node Isolation</p><p style="font-size: 12px; color: var(--text-secondary);">Anonymize demographic data in crowdsourced research.</p></div>
                    <div style="width: 48px; height: 24px; background: #e2e8f0; border-radius: 20px; padding: 3px;"><div style="width: 18px; height: 18px; background: white; border-radius: 50%;"></div></div>
                </div>
            </div>
            <button class="btn btn-primary" onclick="alert('Configuration updated successfully.')">Save Preferences</button>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

// --- AI Search Simulation ---

function initSearchSimulation() {
    let suggestionsBox = null;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        
        if (suggestionsBox) suggestionsBox.remove();
        if (!query) return;

        const filtered = state.searchSuggestions.filter(s => s.toLowerCase().includes(query));
        if (filtered.length === 0) return;

        suggestionsBox = document.createElement('div');
        suggestionsBox.className = 'premium-card';
        Object.assign(suggestionsBox.style, {
            position: 'absolute',
            top: '85px',
            left: '40px',
            width: '320px',
            zIndex: '1000',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
        });

        filtered.forEach(s => {
            const item = document.createElement('div');
            item.textContent = s;
            Object.assign(item.style, {
                padding: '10px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                transition: 'all 0.2s'
            });
            item.onmouseover = () => item.style.background = 'rgba(37, 99, 235, 0.05)';
            item.onmouseout = () => item.style.background = 'transparent';
            item.onclick = () => {
                searchInput.value = s;
                suggestionsBox.remove();
            };
            suggestionsBox.appendChild(item);
        });

        document.querySelector('main').appendChild(suggestionsBox);
    });

    document.addEventListener('click', (e) => {
        if (suggestionsBox && !searchBox.contains(e.target) && !suggestionsBox.contains(e.target)) {
            suggestionsBox.remove();
        }
    });
}
