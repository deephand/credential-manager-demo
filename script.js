import { getOptionsFromUrl } from './config.js';

const executionContainer = document.getElementById('executionContainer');
const executionLog = document.getElementById('executionLog');
const resultViewer = document.getElementById('resultViewer');
const featureWarning = document.getElementById('featureWarning');
const stepTemplate = document.getElementById('stepContainerTemplate');



/* --- Logging --- */
function log(message, type = 'info') {
  const div = document.createElement('div');
  div.className = `log-entry log-${type}`;
  div.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  executionLog.appendChild(div);
  executionLog.scrollTop = executionLog.scrollHeight;
}

/* --- Feature Detection --- */
function checkFeatures() {
  const warnings = [];
  if (!window.navigator.credentials) {
    warnings.push("navigator.credentials is not supported.");
  }
  if (!window.PublicKeyCredential) {
    warnings.push("WebAuthn (PublicKeyCredential) is not supported.");
  }
  if (!window.IdentityCredential) {
    warnings.push("FedCM (IdentityCredential) is not supported.");
  }

  if (warnings.length > 0) {
    featureWarning.innerHTML = warnings.join('<br>');
    featureWarning.classList.remove('hidden');
  }

  // Check Client Capabilities
  if (window.PublicKeyCredential && PublicKeyCredential.getClientCapabilities) {
    PublicKeyCredential.getClientCapabilities().then(caps => {
      log(`Client Capabilities: ${JSON.stringify(caps)}`, 'info');
    }).catch(e => {
      log(`Failed to get Client Capabilities: ${e.message}`, 'warn');
    });
  }
}

/* --- Execution Logic --- */
function runDemo() {
  checkFeatures();

  const { global, calls } = getOptionsFromUrl();
  if (calls.length === 0) {
    log("No requests configured.", 'warn');
    return;
  }

  log(`Loaded configuration with ${calls.length} requests.`, 'info');

  // Render Global Form if Enabled
  if (global.includeForm) {
    renderGlobalForm();
    log("Global: Password Form enabled (Single instance).", 'info');
  }

  // Render ALL steps
  calls.forEach((callConfig, index) => {
    const stepId = index + 1;
    renderStep(stepId, callConfig);
  });
}

function renderGlobalForm() {
  const form = document.createElement('form');
  form.className = 'form-wrapper';
  form.onsubmit = (e) => { e.preventDefault(); };
  form.style.marginBottom = '2rem';

  // Label
  const label = document.createElement('div');
  label.className = 'form-label-tag';
  label.textContent = "Login Form";
  form.appendChild(label);

  // Inputs (One set for the whole page)
  form.innerHTML += `
        <div style="margin-bottom: 1rem;">
            <label style="font-size: 0.9rem; margin-bottom: 0.25rem;">Username</label>
            <input type="text" name="username" autocomplete="username webauthn" placeholder="e.g. user@example.com">
        </div>
        <div style="margin-bottom: 1rem;">
            <label style="font-size: 0.9rem; margin-bottom: 0.25rem;">Password</label>
            <input type="password" name="password" autocomplete="current-password" placeholder="••••••••">
        </div>
        <div style="font-size: 0.8rem; color: #64748b; font-style: italic;">
            * All requests below will operate in the context of this form if they require inputs.
        </div>
    `;

  // Prepend to container
  executionContainer.insertBefore(form, executionContainer.firstChild);
}

/**
 * Renders a single step and schedules execution if needed.
 */
function renderStep(stepId, config) {
  // Create UI Container
  const clone = stepTemplate.content.cloneNode(true);
  const card = clone.querySelector('.step-card');
  card.querySelector('.step-title').textContent = `Request #${stepId}`;
  const contentBox = card.querySelector('.step-content');
  const statusBox = card.querySelector('.step-status');

  // Request Summary
  const summary = document.createElement('div');
  summary.style.marginBottom = '1rem';
  summary.style.fontSize = '0.9rem';
  summary.style.color = 'var(--text-color)';
  summary.style.opacity = '0.8';

  const parts = [];
  parts.push(`<strong>Mediation:</strong> ${config.mediation}`);
  if (config.uiMode) parts.push(`<strong>UI Mode:</strong> ${config.uiMode}`);
  if (config.types.length > 0) parts.push(`<strong>Types:</strong> ${config.types.join(', ')}`);
  if (config.hints && config.hints.length > 0) parts.push(`<strong>Hints:</strong> ${config.hints.join(', ')}`);

  summary.innerHTML = parts.join(' | ');
  contentBox.appendChild(summary);

  // Request Options Accordion
  const details = document.createElement('details');
  details.style.marginBottom = '1rem';
  details.style.border = '1px solid var(--card-border)';
  details.style.borderRadius = 'var(--radius)';
  details.style.overflow = 'hidden';

  const detailsSummary = document.createElement('summary');
  detailsSummary.style.padding = '0.75rem 1rem';
  detailsSummary.style.cursor = 'pointer';
  detailsSummary.style.backgroundColor = 'rgba(255,255,255,0.03)';
  detailsSummary.style.fontSize = '0.9rem';
  detailsSummary.style.display = 'flex';
  detailsSummary.style.alignItems = 'center';
  detailsSummary.style.justifyContent = 'space-between';
  detailsSummary.innerHTML = `
        <span>Show Request Options</span>
        <svg class="icon-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9l6 6 6-6"/>
        </svg>
    `;

  const pre = document.createElement('pre');
  pre.style.margin = '0';
  pre.style.padding = '0'; // Padding handled by hljs
  pre.style.overflowX = 'auto';
  pre.style.background = 'transparent';

  const code = document.createElement('code');
  code.className = 'language-json hljs'; // Add hljs class directly

  const displayParams = buildCredentialParams(config);
  // Serialize with formatting
  code.textContent = JSON.stringify(displayParams, (key, value) => {
    if (value instanceof Uint8Array) return `Uint8Array(${value.length})`;
    return value;
  }, 2);

  pre.appendChild(code);
  details.appendChild(detailsSummary);
  details.appendChild(pre);

  // Toggle chevron on click
  details.addEventListener('toggle', () => {
    const icon = detailsSummary.querySelector('.icon-chevron');
    if (details.open) {
      icon.style.transform = 'rotate(180deg)';
    } else {
      icon.style.transform = 'rotate(0deg)';
    }
  });

  if (window.hljs) {
    hljs.highlightElement(code);
  }

  contentBox.appendChild(details);

  executionContainer.appendChild(card);

  // Execution Action
  const runAction = async () => {
    // Reset visuals
    statusBox.textContent = "Awaiting response...";
    statusBox.style.color = "";
    card.classList.remove('success', 'error');

    log(`Request #${stepId}: execute() started...`, 'info');

    try {
      const executeParams = buildCredentialParams(config);
      log(`Request #${stepId} Params: ${JSON.stringify(executeParams, null, 2)}`, 'info');

      const credential = await navigator.credentials.get(executeParams);

      if (credential) {
        statusBox.textContent = "Success";
        statusBox.style.color = "var(--success)";
        card.classList.add('success');
        log(`Request #${stepId}: Success! Type: ${credential.type}`, 'success');
        displayResult(credential);
      } else {
        statusBox.textContent = "Completed (No credential returned)";
        log(`Request #${stepId}: Completed with null result.`, 'warn');
      }
    } catch (err) {
      statusBox.textContent = `Error: ${err.name}`;
      statusBox.style.color = "var(--danger)";
      card.classList.add('error');
      log(`Request #${stepId} Error: ${err.message} (${err.name})`, 'error');
      displayResult({ error: err.name, message: err.message });
    }
  };

  // Determine Trigger
  if (config.trigger === 'button') {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = `Run Request #${stepId}`;
    btn.onclick = () => {
      btn.disabled = true;
      runAction().finally(() => {
        btn.disabled = false;
      });
    };
    contentBox.appendChild(btn);

  } else if (config.trigger === 'load' || config.trigger === 'load-delay') {
    const delay = config.trigger === 'load-delay' ? config.delay : 0;

    // Just execute independently
    if (delay > 0) {
      statusBox.textContent = `Scheduled (Delay: ${delay}ms)...`;
      setTimeout(() => runAction(), delay);
    } else {
      runAction();
    }
  }
}

function buildCredentialParams(config) {
  const options = {};

  if (config.mediation && config.mediation !== 'optional') {
    options.mediation = config.mediation;
  }

  if (config.uiMode) {
    options.uiMode = config.uiMode;
  }

  // Hints will be added only if public-key is present logic below


  if (config.types.includes('password')) {
    options.password = true;
  }

  if (config.types.includes('public-key')) {
    options.publicKey = {
      challenge: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]),
      rpId: window.location.hostname,
      userVerification: config.publicKey.userVerification || 'preferred',
      timeout: config.publicKey.timeout || 60000,
      allowCredentials: [],
    };

    // Hints are only for Public Key
    if (config.hints && config.hints.length > 0) {
      options.publicKey.hints = config.hints;
    }

    if (config.publicKey.relatedOrigin) {
      options.publicKey.extensions = {
        relatedOrigins: [{
          name: 'Related Origin Demo',
          icon: 'https://deephand-related-origin.netlify.app/icon.png',
          id: 'https://deephand-related-origin.netlify.app'
        }]
      };
    }
  }

  if (config.types.includes('fedcm')) {
    options.identity = {
      providers: [{
        configURL: config.fedcm.provider || "https://fedcm-idp-demo.onrender.com/fedcm.json",
        clientId: window.location.origin,
        nonce: "1234567890"
      }]
    };

    if (config.fedcm.mode) {
      options.identity.mode = config.fedcm.mode;
    }
  }

  return options;
}

function displayResult(result) {
  let output = {};

  if (result.error) {
    resultViewer.innerHTML = `<span class="boolean">Error:</span> <span class="string">"${result.message}"</span>`;
    return;
  }

  output.id = result.id;
  output.type = result.type;

  if (result.type === 'public-key') {
    output.authenticatorAttachment = result.authenticatorAttachment;

    const response = result.response;
    output.response = {};

    if (response.clientDataJSON) {
      try {
        const text = new TextDecoder().decode(response.clientDataJSON);
        output.response.clientDataJSON = JSON.parse(text);
      } catch (e) {
        output.response.clientDataJSON = "<Error decoding JSON>";
      }
    }

    if (response.authenticatorData) {
      const authData = parseAuthenticatorData(response.authenticatorData);
      output.response.authenticatorData = authData;
    }

    if (response.signature) {
      output.response.signature = bufferToHex(response.signature);
    }

    if (response.userHandle) {
      output.response.userHandle = bufferToHex(response.userHandle);
    }

    if (response.attestationObject) {
      output.response.attestationObject = "Uint8Array(" + response.attestationObject.byteLength + ")";
    }

    try {
      output.clientExtensionResults = result.getClientExtensionResults();
    } catch (e) { }
  }
  else if (result.type === 'password') {
    output.password = "********";
  }
  else if (result.type === 'identity') {
    output.token = "******** (JWT)";
  }

  const json = JSON.stringify(output, null, 2);
  resultViewer.textContent = json;

  // Highlight result too
  resultViewer.className = 'language-json hljs';
  if (window.hljs) hljs.highlightElement(resultViewer);
}

// --- Helpers ---

function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function parseAuthenticatorData(buffer) {
  const view = new DataView(buffer);
  let offset = 0;

  // RP ID Hash (32 bytes)
  const rpIdHash = bufferToHex(buffer.slice(offset, offset + 32));
  offset += 32;

  // Flags (1 byte)
  const flagsByte = view.getUint8(offset);
  const flags = {
    UP: !!(flagsByte & 0x01), // User Present
    UV: !!(flagsByte & 0x04), // User Verified
    BE: !!(flagsByte & 0x08), // Backup Eligibility
    BS: !!(flagsByte & 0x10), // Backup State
    AT: !!(flagsByte & 0x40), // Attested Credential Data Included
    ED: !!(flagsByte & 0x80)  // Extension Data Included
  };
  offset += 1;

  // Sign Counter (4 bytes)
  const signCount = view.getUint32(offset, false); // Big-Endian
  offset += 4;

  return {
    rpIdHash: rpIdHash,
    flags: flags,
    signCount: signCount,
    hex: bufferToHex(buffer)
  };
}

runDemo();
