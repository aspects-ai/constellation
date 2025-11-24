import express from "express";
import { spawn } from "child_process";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3456;

// Load .env file
function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  const env = {};
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        env[key.trim()] = valueParts.join("=").trim();
      }
    }
  }
  return env;
}

const envConfig = loadEnvFile();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Endpoint to get env defaults (for form prefill)
app.get("/env-defaults", (req, res) => {
  res.json({
    sshUser: envConfig.SSH_USER || "",
    hasArchilKey: !!envConfig.ARCHIL_API_KEY,
    hasSshPassword: !!envConfig.SSH_PASSWORD,
  });
});

// Serve the HTML form
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ConstellationFS Deploy Tool</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 700px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #f5f5f5;
    }
    h1 { color: #333; margin-bottom: 8px; }
    .subtitle { color: #666; margin-bottom: 32px; }
    form {
      background: white;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    fieldset {
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 20px;
    }
    legend {
      font-weight: 600;
      color: #333;
      padding: 0 8px;
    }
    .form-group {
      margin-bottom: 16px;
    }
    .form-group:last-child {
      margin-bottom: 0;
    }
    label {
      display: block;
      font-weight: 500;
      margin-bottom: 6px;
      color: #444;
    }
    input, select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }
    input:focus, select:focus {
      outline: none;
      border-color: #4a90d9;
      box-shadow: 0 0 0 3px rgba(74, 144, 217, 0.1);
    }
    .help-text {
      font-size: 12px;
      color: #888;
      margin-top: 4px;
    }
    .conditional-section {
      display: none;
      background: #f9f9f9;
      padding: 16px;
      border-radius: 4px;
      margin-top: 12px;
    }
    .conditional-section.visible { display: block; }
    button {
      width: 100%;
      padding: 14px;
      background: #4a90d9;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 8px;
    }
    button:hover { background: #3a7bc8; }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    #output {
      margin-top: 24px;
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 16px;
      border-radius: 6px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 13px;
      white-space: pre-wrap;
      max-height: 400px;
      overflow-y: auto;
      display: none;
    }
    #output.visible { display: block; }
    .section-note {
      font-size: 13px;
      color: #666;
      margin-bottom: 16px;
      padding: 8px 12px;
      background: #e8f4fd;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <h1>ConstellationFS Deploy Tool</h1>
  <p class="subtitle">Deploy a ConstellationFS remote backend VM to GCP</p>

  <form id="deployForm">
    <fieldset>
      <legend>GCP Configuration</legend>
      <div class="form-group">
        <label for="gcpProject">GCP Project ID *</label>
        <input type="text" id="gcpProject" name="gcpProject" required placeholder="my-project-id">
      </div>
      <div class="form-group">
        <label for="vmName">VM Instance Name *</label>
        <input type="text" id="vmName" name="vmName" required placeholder="constellation-remote">
      </div>
      <div class="form-group">
        <label for="vmZone">VM Zone *</label>
        <input type="text" id="vmZone" name="vmZone" value="us-central1-a" placeholder="us-central1-a">
      </div>
      <div class="form-group">
        <label for="machineType">Machine Type</label>
        <input type="text" id="machineType" name="machineType" value="e2-medium" placeholder="e2-medium">
      </div>
    </fieldset>

    <fieldset>
      <legend>Storage Configuration</legend>
      <div class="form-group">
        <label for="storageType">Storage Type *</label>
        <select id="storageType" name="storageType">
          <option value="local">Local (VM disk)</option>
          <option value="archil">Archil (GCP Bucket)</option>
        </select>
      </div>

      <div id="archilConfig" class="conditional-section">
        <div class="form-group">
          <label for="archilApiKey">Archil API Key *</label>
          <input type="password" id="archilApiKey" name="archilApiKey" placeholder="your-api-key">
          <div class="help-text env-hint" id="archilApiKeyHint" style="display:none; color:#28a745;">✓ Using value from .env</div>
        </div>
        <div class="form-group">
          <label for="archilBucket">Archil Bucket *</label>
          <input type="text" id="archilBucket" name="archilBucket" placeholder="user@bucket-name">
          <div class="help-text">Format: user@bucket-name</div>
        </div>
        <div class="form-group">
          <label for="archilRegion">Archil Region</label>
          <input type="text" id="archilRegion" name="archilRegion" placeholder="gcp-us-central1">
          <div class="help-text">Optional. e.g., gcp-us-central1</div>
        </div>
      </div>
    </fieldset>

    <fieldset>
      <legend>SSH Configuration</legend>
      <div class="section-note">Configure SSH access credentials for the VM</div>
      <div class="form-group">
        <label for="sshUser">SSH Username *</label>
        <input type="text" id="sshUser" name="sshUser" value="dev" placeholder="dev">
      </div>
      <div class="form-group">
        <label for="sshPassword">SSH Password *</label>
        <input type="password" id="sshPassword" name="sshPassword" placeholder="secure-password">
        <div class="help-text env-hint" id="sshPasswordHint" style="display:none; color:#28a745;">✓ Using value from .env</div>
      </div>
    </fieldset>

    <button type="submit" id="submitBtn">Create VM</button>
  </form>

  <div id="output"></div>

  <script>
    const form = document.getElementById('deployForm');
    const output = document.getElementById('output');
    const submitBtn = document.getElementById('submitBtn');
    const storageType = document.getElementById('storageType');
    const archilConfig = document.getElementById('archilConfig');

    // Fields to persist (exclude sensitive fields)
    const STORAGE_KEY = 'constellation-deploy-config';
    const PERSIST_FIELDS = [
      'gcpProject', 'vmName', 'vmZone', 'machineType',
      'storageType', 'archilBucket', 'archilRegion',
      'sshUser'
    ];

    // Load saved values on page load
    function loadSavedValues() {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        PERSIST_FIELDS.forEach(field => {
          const el = document.getElementById(field);
          if (el && saved[field]) {
            el.value = saved[field];
          }
        });
        // Trigger change events to show/hide conditional sections
        storageType.dispatchEvent(new Event('change'));
      } catch (e) {
        console.error('Failed to load saved values:', e);
      }
    }

    // Save values before submit
    function saveValues() {
      try {
        const values = {};
        PERSIST_FIELDS.forEach(field => {
          const el = document.getElementById(field);
          if (el) values[field] = el.value;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
      } catch (e) {
        console.error('Failed to save values:', e);
      }
    }

    // Set up event listeners first
    storageType.addEventListener('change', () => {
      archilConfig.classList.toggle('visible', storageType.value === 'archil');
    });

    // Load saved values after listeners are registered
    loadSavedValues();

    // Check for env defaults and show hints
    let envDefaults = {};
    fetch('/env-defaults')
      .then(r => r.json())
      .then(data => {
        envDefaults = data;
        if (data.hasArchilKey) {
          document.getElementById('archilApiKeyHint').style.display = 'block';
          document.getElementById('archilApiKey').placeholder = '(using .env value)';
        }
        if (data.hasSshPassword) {
          document.getElementById('sshPasswordHint').style.display = 'block';
          document.getElementById('sshPassword').placeholder = '(using .env value)';
        }
        if (data.sshUser) {
          document.getElementById('sshUser').value = data.sshUser;
        }
      })
      .catch(() => {});

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Save non-sensitive values
      saveValues();

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      // Mark if we should use env values
      data.useEnvArchilKey = envDefaults.hasArchilKey && !data.archilApiKey;
      data.useEnvSshPassword = envDefaults.hasSshPassword && !data.sshPassword;

      // Validation
      if (data.storageType === 'archil') {
        const hasArchilKey = data.archilApiKey || data.useEnvArchilKey;
        if (!hasArchilKey || !data.archilBucket) {
          alert('Archil API Key and Bucket are required when using Archil storage');
          return;
        }
      }

      output.classList.add('visible');
      output.textContent = 'Starting VM creation...\\n';
      submitBtn.disabled = true;

      try {
        const response = await fetch('/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          output.textContent += text;
          output.scrollTop = output.scrollHeight;
        }
      } catch (err) {
        output.textContent += 'Error: ' + err.message + '\\n';
      } finally {
        submitBtn.disabled = false;
      }
    });
  </script>
</body>
</html>
  `);
});

// Handle deployment
app.post("/deploy", async (req, res) => {
  const {
    gcpProject,
    vmName,
    vmZone = "us-central1-a",
    machineType = "e2-medium",
    storageType = "local",
    archilApiKey: formArchilApiKey = "",
    archilBucket = "",
    archilRegion = "",
    sshUser: formSshUser = "dev",
    sshPassword: formSshPassword,
    useEnvArchilKey,
    useEnvSshPassword,
  } = req.body;

  // Use env values if flagged
  const archilApiKey = useEnvArchilKey ? envConfig.ARCHIL_API_KEY : formArchilApiKey;
  const sshUser = envConfig.SSH_USER || formSshUser;
  const sshPassword = useEnvSshPassword ? envConfig.SSH_PASSWORD : formSshPassword;

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Transfer-Encoding", "chunked");

  const log = (msg) => res.write(msg + "\n");
  const logError = (msg) => res.write(`[ERROR] ${msg}\n`);
  const logSuccess = (msg) => res.write(`[SUCCESS] ${msg}\n`);

  log(`=== ConstellationFS VM Deploy ===`);
  log(`Project: ${gcpProject}`);
  log(`VM: ${vmName} (${machineType}) in ${vmZone}`);
  log(`Storage: ${storageType}`);
  if (useEnvArchilKey) log(`Using Archil API key from .env`);
  if (useEnvSshPassword) log(`Using SSH password from .env`);
  log(``);

  // Load and customize startup script
  log(`Preparing startup script...`);
  const startupScriptPath = path.join(__dirname, "..", "vm-startup.sh");
  let startupScript;
  try {
    startupScript = readFileSync(startupScriptPath, "utf-8");
  } catch (err) {
    logError(`Failed to read startup script: ${err.message}`);
    return res.end();
  }

  // Get mount path from env or default
  const archilMountPath = envConfig.ARCHIL_MOUNT_PATH || "/workspace";

  // Replace placeholders with actual values
  startupScript = startupScript
    .replace("__STORAGE_TYPE__", storageType)
    .replace("__ARCHIL_API_KEY__", archilApiKey)
    .replace("__ARCHIL_BUCKET__", archilBucket)
    .replace("__ARCHIL_REGION__", archilRegion)
    .replace("__ARCHIL_MOUNT_PATH__", archilMountPath)
    .replace("__SSH_USERS__", `${sshUser}:${sshPassword}`);

  // Write startup script to temp file (avoids shell escaping issues)
  const tempScriptPath = path.join(tmpdir(), `constellation-startup-${Date.now()}.sh`);
  writeFileSync(tempScriptPath, startupScript);
  log(`Startup script written to temp file`);

  // Check if VM already exists and delete it
  log(`Checking if VM ${vmName} already exists...`);
  const existsCheck = await runCommandCapture("gcloud", [
    "compute",
    "instances",
    "describe",
    vmName,
    "--zone",
    vmZone,
    "--project",
    gcpProject,
    "--format",
    "value(name)",
  ]);

  if (existsCheck.trim() === vmName) {
    log(`VM ${vmName} exists. Deleting...`);
    const deleteSuccess = await runCommand("gcloud", [
      "compute",
      "instances",
      "delete",
      vmName,
      "--zone",
      vmZone,
      "--project",
      gcpProject,
      "--quiet",
    ], log);

    if (!deleteSuccess) {
      logError("Failed to delete existing VM");
      try { unlinkSync(tempScriptPath); } catch (e) {}
      return res.end();
    }
    logSuccess(`Deleted existing VM ${vmName}`);
    log(``);
  } else {
    log(`No existing VM found, proceeding with creation...`);
  }

  log(`Creating VM ${vmName}...`);
  log(``);

  // Create VM with startup script from file
  const createVmArgs = [
    "compute",
    "instances",
    "create",
    vmName,
    "--project",
    gcpProject,
    "--zone",
    vmZone,
    "--machine-type",
    machineType,
    "--image-family",
    "ubuntu-2204-lts",
    "--image-project",
    "ubuntu-os-cloud",
    "--boot-disk-size",
    "20GB",
    "--tags",
    "constellation-ssh",
    "--scopes",
    "storage-full",
    "--metadata-from-file",
    `startup-script=${tempScriptPath}`,
  ];

  const vmSuccess = await runCommand("gcloud", createVmArgs, log);

  // Clean up temp file
  try {
    unlinkSync(tempScriptPath);
  } catch (e) {
    // Ignore cleanup errors
  }

  if (!vmSuccess) {
    logError("VM creation failed!");
    return res.end();
  }

  logSuccess(`VM ${vmName} created!`);
  log(``);

  // Get external IP
  log(`Getting VM external IP...`);
  const ipResult = await runCommandCapture("gcloud", [
    "compute",
    "instances",
    "describe",
    vmName,
    "--zone",
    vmZone,
    "--project",
    gcpProject,
    "--format",
    "get(networkInterfaces[0].accessConfigs[0].natIP)",
  ]);

  const externalIp = ipResult.trim();
  log(`External IP: ${externalIp}`);
  log(``);

  log(`=== Setup Complete ===`);
  log(``);
  log(`The VM is starting up and running the setup script.`);
  log(`This may take 1-2 minutes. You can monitor progress with:`);
  log(`  gcloud compute ssh ${vmName} --zone=${vmZone} --project=${gcpProject} -- tail -f /var/log/syslog`);
  log(``);
  log(`Once ready, connect via:`);
  log(`  ssh ${sshUser}@${externalIp}`);
  log(``);
  log(`If SSH connection is refused, ensure the firewall rule exists:`);
  log(`  gcloud compute firewall-rules create allow-constellation-ssh \\`);
  log(`    --allow tcp:22 --target-tags constellation-ssh --project ${gcpProject}`);
  log(``);

  res.end();
});

// Helper to run a command and stream output
function runCommand(cmd, args, log) {
  return new Promise((resolve) => {
    const fullCommand = `${cmd} ${args.map((a) => `'${a}'`).join(" ")}`;
    log(`> ${cmd} ${args.slice(0, 6).join(" ")} ...`);
    log(``);

    // Source zshrc to get PATH, then run command
    const wrappedCommand = `source ~/.zshrc 2>/dev/null; ${fullCommand}`;
    const proc = spawn(wrappedCommand, [], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: "/bin/zsh",
    });

    proc.stdout.on("data", (data) => log(data.toString()));
    proc.stderr.on("data", (data) => log(data.toString()));

    proc.on("close", (code) => {
      resolve(code === 0);
    });

    proc.on("error", (err) => {
      log(`Failed to start process: ${err.message}`);
      resolve(false);
    });
  });
}

// Helper to run a command and capture output
function runCommandCapture(cmd, args) {
  return new Promise((resolve) => {
    const fullCommand = `${cmd} ${args.map((a) => `'${a}'`).join(" ")}`;
    const wrappedCommand = `source ~/.zshrc 2>/dev/null; ${fullCommand}`;

    let output = "";
    const proc = spawn(wrappedCommand, [], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: "/bin/zsh",
    });

    proc.stdout.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", () => {
      resolve(output);
    });

    proc.on("error", () => {
      resolve("");
    });
  });
}

app.listen(PORT, () => {
  console.log(`\n🚀 ConstellationFS Deploy Tool`);
  console.log(`   Open http://localhost:${PORT} in your browser\n`);
});
