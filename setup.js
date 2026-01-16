import { buildUrlFromOptions, MEDIATION_MODES, UI_MODES } from './config.js';

const callsContainer = document.getElementById('callsParamsContainer');
const addCallBtn = document.getElementById('addCallBtn');
const createPageBtn = document.getElementById('createPageBtn');
const includeFormGlobal = document.getElementById('includeFormGlobal');
const template = document.getElementById('callCardTemplate');

let callCount = 0;

/* --- Code Generation Logic (Per Call) --- */
function generateCallCode(config, index) {
  let output = `/* --- Request #${index + 1} (${config.trigger}) --- */\n`;
  output += `// Feature Checks\n`;
  if (config.types.includes('public-key')) {
    output += `if (window.PublicKeyCredential) { ... }\n`;
  }
  if (config.types.includes('fedcm')) {
    output += `if (window.IdentityCredential) { ... }\n`;
  }

  output += `\nconst options = {\n`;

  if (config.mediation && config.mediation !== 'optional') {
    output += `  mediation: '${config.mediation}',\n`;
  }

  if (config.uiMode) output += `  uiMode: '${config.uiMode}',\n`;

  if (config.types.includes('password')) {
    output += `  password: true,\n`;
  }

  if (config.types.includes('public-key')) {
    output += `  publicKey: {\n`;
    if (config.hints && config.hints.length > 0) {
      output += `    hints: [${config.hints.map(h => `'${h}'`).join(', ')}],\n`;
    }
    output += `    challenge: new Uint8Array([...]),\n`;
    output += `    rpId: '${window.location.hostname}',\n`;
    output += `    userVerification: '${config.publicKey.userVerification}',\n`;
    output += `    timeout: ${config.publicKey.timeout},\n`;
    if (config.publicKey.relatedOrigin) {
      output += `    extensions: {\n`;
      output += `      relatedOrigins: [{\n`;
      output += `        name: 'Related Origin Demo',\n`;
      output += `        id: 'https://deephand-related-origin.netlify.app'\n`;
      output += `      }]\n`;
      output += `    }\n`;
    }
    output += `  },\n`;
  }

  if (config.types.includes('fedcm')) {
    output += `  identity: {\n`;
    if (config.fedcm.mode) output += `    mode: '${config.fedcm.mode}',\n`;
    output += `    providers: [{\n`;
    output += `      configURL: '${config.fedcm.provider}',\n`;
    output += `      clientId: '${window.location.origin}'\n`;
    output += `    }]\n`;
    output += `  },\n`;
  }

  output += `};\n\n`;
  output += `navigator.credentials.get(options);`;

  return output;
}

/**
 * Creates a new Call Card from the template and appends it.
 */
function addCall() {
  callCount++;
  const clone = template.content.cloneNode(true);
  const card = clone.querySelector('.call-card');

  // Set ID
  const callId = `call-${Date.now()}`;
  card.setAttribute('data-id', callId);

  // Update Title
  card.querySelector('.call-number').textContent = `Request #${callCount}`;

  // Remove Button Logic
  const removeBtn = card.querySelector('.remove-call-btn');
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent accordion toggle
    card.remove();
    updateCallNumbers();
  });

  // Main Card Accordion Logic
  const cardHeader = card.querySelector('.call-card-header');
  const cardContent = card.querySelector(':scope > .accordion-content');

  // Default open for new cards
  cardContent.style.maxHeight = '3000px';
  cardContent.style.paddingTop = '0';
  cardContent.style.paddingBottom = '0';
  cardHeader.classList.add('accordion-open');

  cardHeader.addEventListener('click', (e) => {
    if (e.target.closest('.remove-call-btn')) return;

    const isOpen = cardHeader.classList.contains('accordion-open');
    if (isOpen) {
      cardHeader.classList.remove('accordion-open');
      cardContent.style.maxHeight = '0';
    } else {
      cardHeader.classList.add('accordion-open');
      cardContent.style.maxHeight = '3000px';
    }
  });

  // Populate Trigger Radio Group
  const triggerGroup = card.querySelector('.trigger-group');
  const triggers = [
    { value: 'button', label: 'Button' },
    { value: 'load', label: 'Page Load' },
    { value: 'load-delay', label: 'Delayed Load' }
  ];

  const delayInputGroup = card.querySelector('.delay-input-group');

  triggers.forEach(trigger => {
    const name = `trigger-${callId}`;
    const label = document.createElement('label');
    label.className = 'radio-card';
    label.innerHTML = `
            <input type="radio" name="${name}" value="${trigger.value}" ${trigger.value === 'button' ? 'checked' : ''}>
            <div class="radio-card-content">${trigger.label}</div>
        `;

    label.querySelector('input').addEventListener('change', (e) => {
      if (e.target.value === 'load-delay') {
        delayInputGroup.classList.remove('hidden');
      } else {
        delayInputGroup.classList.add('hidden');
      }
      updateCardPreview(card);
    });

    triggerGroup.appendChild(label);
  });

  // Populate Mediation Radio Group
  const mediationGroup = card.querySelector('.mediation-group');
  MEDIATION_MODES.forEach(mode => {
    const name = `mediation-${callId}`;
    const label = document.createElement('label');
    label.className = 'radio-card';
    label.innerHTML = `
            <input type="radio" name="${name}" value="${mode.value}" ${mode.value === 'optional' ? 'checked' : ''}>
            <div class="radio-card-content">${mode.label}</div>
        `;
    label.querySelector('input').addEventListener('change', () => updateCardPreview(card));
    mediationGroup.appendChild(label);
  });

  // Populate UI Mode Radio Group
  const uiModeGroup = card.querySelector('.uimode-group');
  UI_MODES.forEach(mode => {
    const name = `uimode-${callId}`;
    const label = document.createElement('label');
    label.className = 'radio-card';
    if (mode.value === 'immediate') {
      label.title = "https://github.com/w3c/webauthn/wiki/Explainer:-WebAuthn-immediate-mediation";
    }
    label.innerHTML = `
            <input type="radio" name="${name}" value="${mode.value}" ${mode.value === '' ? 'checked' : ''}>
            <div class="radio-card-content">${mode.label}</div>
        `;
    label.querySelector('input').addEventListener('change', () => updateCardPreview(card));
    uiModeGroup.appendChild(label);
  });

  // Scoped names & listeners
  const uvGroup = card.querySelectorAll('.uv-group input');
  uvGroup.forEach(input => {
    input.name = `uv-${callId}`;
    input.addEventListener('change', () => updateCardPreview(card));
  });

  const fedcmModeGroup = card.querySelectorAll('.identity-mode-group input');
  fedcmModeGroup.forEach(input => {
    input.name = `fedcm-mode-${callId}`;
    input.addEventListener('change', () => updateCardPreview(card));
  });

  // Sub-Accordion Logic (Passkey/FedCM)
  const subAccordions = card.querySelectorAll('.credential-option .accordion-header');
  subAccordions.forEach(header => {
    const checkbox = header.querySelector('input[type="checkbox"]');

    header.addEventListener('click', (e) => {
      if (e.target !== checkbox) {
        e.preventDefault();
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    checkbox.addEventListener('change', () => {
      const parent = header.parentElement;
      if (checkbox.checked) {
        parent.classList.add('accordion-open');
      } else {
        parent.classList.remove('accordion-open');
      }
      updateCardPreview(card);
    });
  });

  // Preview Toggle Logic
  const togglePreviewBtn = card.querySelector('.toggle-preview-btn');
  const previewContent = card.querySelector('.preview-content');
  togglePreviewBtn.addEventListener('click', () => {
    const isOpen = togglePreviewBtn.classList.contains('accordion-open');
    if (isOpen) {
      togglePreviewBtn.classList.remove('accordion-open');
      previewContent.style.maxHeight = '0';
      togglePreviewBtn.querySelector('span').textContent = 'Show Code Preview';
    } else {
      togglePreviewBtn.classList.add('accordion-open');
      previewContent.style.maxHeight = '500px';
      togglePreviewBtn.querySelector('span').textContent = 'Hide Code Preview';
      updateCardPreview(card);
    }
  });

  // Input listeners for preview updates (text, number, checkboxes including hints)
  const inputs = card.querySelectorAll('input');
  inputs.forEach(input => {
    if (input.type === 'text' || input.type === 'number') {
      input.addEventListener('input', () => updateCardPreview(card));
    } else if (input.type === 'checkbox' || input.type === 'radio') {
      input.addEventListener('change', () => updateCardPreview(card));
    }
  });

  callsContainer.appendChild(card);
  updateCardPreview(card);
}

function updateCardPreview(card) {
  const config = harvestConfigFromCard(card);
  // Find index
  const index = Array.from(callsContainer.children).indexOf(card);
  const code = generateCallCode(config, index);

  const codeBlock = card.querySelector('code');
  codeBlock.textContent = code;
  if (window.hljs) {
    hljs.highlightElement(codeBlock);
  }
}

function updateCallNumbers() {
  const cards = callsContainer.querySelectorAll('.call-card');
  cards.forEach((card, index) => {
    card.querySelector('.call-number').textContent = `Call #${index + 1}`;
    updateCardPreview(card);
  });
  callCount = cards.length;
}

function harvestConfigFromCard(card) {
  const trigger = card.querySelector('.trigger-group input:checked').value;
  const config = {
    trigger: trigger,
    delay: parseInt(card.querySelector('.delay-input').value) || 0,
    mediation: card.querySelector('.mediation-group input:checked').value,
    uiMode: card.querySelector('.uimode-group input:checked').value,
    types: [],
    hints: []
  };

  if (card.querySelector('.cred-type-password').checked) {
    config.types.push('password');
  }

  const pkCheckbox = card.querySelector('input[value="public-key"]');
  if (pkCheckbox.checked) {
    config.types.push('public-key');
    config.publicKey = {
      userVerification: card.querySelector('.uv-group input:checked').value,
      relatedOrigin: card.querySelector('.related-origin-check').checked,
      timeout: parseInt(card.querySelector('.timeout-input').value) || 30000
    };

    // Hints (Only if Passkey is enabled)
    const hintCheckboxes = card.querySelectorAll('.hint-checkbox:checked');
    hintCheckboxes.forEach(cb => {
      config.hints.push(cb.value);
    });
  }

  const fedcmCheckbox = card.querySelector('input[value="fedcm"]');
  if (fedcmCheckbox.checked) {
    config.types.push('fedcm');
    config.fedcm = {
      mode: card.querySelector('.identity-mode-group input:checked').value,
      provider: card.querySelector('.fedcm-provider-input').value
    };
  }

  return config;
}

function harvestAllConfig() {
  const cards = callsContainer.querySelectorAll('.call-card');
  const calls = [];
  cards.forEach(card => {
    calls.push(harvestConfigFromCard(card));
  });
  return {
    global: {
      includeForm: includeFormGlobal.checked
    },
    calls: calls
  };
}

// Initial Call
addCall();

// Event Listeners
addCallBtn.addEventListener('click', addCall);

createPageBtn.addEventListener('click', () => {
  const config = harvestAllConfig();
  const url = buildUrlFromOptions(config);
  window.location.href = url;
});
