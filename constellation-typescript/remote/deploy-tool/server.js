import express from "express";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3456;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    fieldset.deploy-section {
      border-color: #4a90d9;
      background: #f8fafc;
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
    .button-row {
      display: flex;
      gap: 12px;
      margin-top: 8px;
    }
    button {
      flex: 1;
      padding: 14px;
      background: #4a90d9;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { background: #3a7bc8; }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    button.secondary {
      background: #28a745;
    }
    button.secondary:hover {
      background: #218838;
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
  <p class="subtitle">Build and deploy the remote backend to GCP</p>

  <form id="deployForm">
    <fieldset>
      <legend>1. Build Configuration</legend>
      <div class="section-note">Build a generic image and push to Google Artifact Registry</div>
      <div class="form-group">
        <label for="gcpProject">GCP Project ID *</label>
        <input type="text" id="gcpProject" name="gcpProject" required placeholder="my-project-id">
      </div>
      <div class="form-group">
        <label for="registryRegion">Registry Region *</label>
        <input type="text" id="registryRegion" name="registryRegion" value="us-central1" placeholder="us-central1">
        <div class="help-text">Artifact Registry region (e.g., us-central1, us-east1)</div>
      </div>
      <div class="form-group">
        <label for="repoName">Repository Name *</label>
        <input type="text" id="repoName" name="repoName" value="constellation-remote" placeholder="constellation-remote">
        <div class="help-text">Artifact Registry repository name</div>
      </div>
      <div class="form-group">
        <label for="imageName">Image Name</label>
        <input type="text" id="imageName" name="imageName" value="constellation-remote" placeholder="constellation-remote">
      </div>
      <div class="form-group">
        <label for="imageTag">Image Tag</label>
        <input type="text" id="imageTag" name="imageTag" value="latest" placeholder="latest">
      </div>
    </fieldset>

    <fieldset class="deploy-section">
      <legend>2. VM Deployment (Optional)</legend>
      <div class="form-group">
        <label for="createVm">
          <input type="checkbox" id="createVm" name="createVm" style="width: auto; margin-right: 8px;">
          Create a new GCP VM with this container
        </label>
      </div>

      <div id="vmConfig" class="conditional-section">
        <div class="section-note">Creates a Container-Optimized OS VM running the container</div>

        <div class="form-group">
          <label for="vmName">VM Instance Name *</label>
          <input type="text" id="vmName" name="vmName" placeholder="constellation-vm">
        </div>
        <div class="form-group">
          <label for="vmZone">VM Zone *</label>
          <input type="text" id="vmZone" name="vmZone" value="us-central1-a" placeholder="us-central1-a">
        </div>
        <div class="form-group">
          <label for="machineType">Machine Type</label>
          <input type="text" id="machineType" name="machineType" value="e2-medium" placeholder="e2-medium">
        </div>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
        <div style="font-weight: 600; margin-bottom: 12px;">Runtime Configuration</div>

        <div class="form-group">
          <label for="storageType">Storage Type *</label>
          <select id="storageType" name="storageType">
            <option value="local">Local</option>
            <option value="archil">Archil (GCP Bucket)</option>
          </select>
        </div>

        <div id="archilConfig" class="conditional-section">
          <div class="form-group">
            <label for="archilApiKey">Archil API Key *</label>
            <input type="password" id="archilApiKey" name="archilApiKey" placeholder="your-api-key">
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

        <div class="form-group">
          <label for="sshUser">SSH Username *</label>
          <input type="text" id="sshUser" name="sshUser" value="dev" placeholder="dev">
        </div>
        <div class="form-group">
          <label for="sshPassword">SSH Password *</label>
          <input type="password" id="sshPassword" name="sshPassword" placeholder="secure-password">
        </div>
      </div>
    </fieldset>

    <div class="button-row">
      <button type="submit" id="submitBtn">Build & Push to GCR</button>
    </div>
  </form>

  <div id="output"></div>

  <script>
    const form = document.getElementById('deployForm');
    const output = document.getElementById('output');
    const submitBtn = document.getElementById('submitBtn');
    const createVm = document.getElementById('createVm');
    const vmConfig = document.getElementById('vmConfig');
    const storageType = document.getElementById('storageType');
    const archilConfig = document.getElementById('archilConfig');

    // Fields to persist (exclude sensitive fields)
    const STORAGE_KEY = 'constellation-deploy-config';
    const PERSIST_FIELDS = [
      'gcpProject', 'registryRegion', 'repoName', 'imageName', 'imageTag',
      'vmName', 'vmZone', 'machineType',
      'storageType', 'archilBucket', 'archilRegion',
      'sshUser'
    ];
    const PERSIST_CHECKBOXES = ['createVm'];

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

        PERSIST_CHECKBOXES.forEach(field => {
          const el = document.getElementById(field);
          if (el && saved[field] !== undefined) {
            el.checked = saved[field];
            el.dispatchEvent(new Event('change'));
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
        PERSIST_CHECKBOXES.forEach(field => {
          const el = document.getElementById(field);
          if (el) values[field] = el.checked;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
      } catch (e) {
        console.error('Failed to save values:', e);
      }
    }

    // Load on page ready
    loadSavedValues();

    createVm.addEventListener('change', () => {
      vmConfig.classList.toggle('visible', createVm.checked);
      submitBtn.textContent = createVm.checked ? 'Build & Create VM' : 'Build & Push to GCR';
    });

    storageType.addEventListener('change', () => {
      archilConfig.classList.toggle('visible', storageType.value === 'archil');
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Save non-sensitive values
      saveValues();

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      data.createVm = createVm.checked;

      // Validation
      if (data.createVm) {
        if (!data.vmName || !data.vmZone) {
          alert('VM Name and Zone are required');
          return;
        }
        if (!data.sshPassword) {
          alert('SSH Password is required');
          return;
        }
        if (data.storageType === 'archil') {
          if (!data.archilApiKey || !data.archilBucket) {
            alert('Archil API Key and Bucket are required when using Archil storage');
            return;
          }
        }
      }

      output.classList.add('visible');
      output.textContent = 'Starting...\\n';
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
    registryRegion = "us-central1",
    repoName = "constellation-remote",
    imageName = "constellation-remote",
    imageTag = "latest",
    createVm,
    vmName,
    vmZone,
    machineType = "e2-medium",
    storageType = "local",
    archilApiKey,
    archilBucket,
    archilRegion,
    sshUser = "dev",
    sshPassword,
  } = req.body;

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Transfer-Encoding", "chunked");

  const log = (msg) => res.write(msg + "\n");
  const logError = (msg) => res.write(`[ERROR] ${msg}\n`);
  const logSuccess = (msg) => res.write(`[SUCCESS] ${msg}\n`);

  const remoteDir = path.resolve(__dirname, "..");
  const contextDir = path.resolve(__dirname, "../..");

  // Artifact Registry URL format: REGION-docker.pkg.dev/PROJECT/REPO/IMAGE:TAG
  const imageUrl = `${registryRegion}-docker.pkg.dev/${gcpProject}/${repoName}/${imageName}:${imageTag}`;

  log(`=== ConstellationFS Deploy ===`);
  log(`Project: ${gcpProject}`);
  log(`Image: ${imageUrl}`);
  log(``);

  // Step 1: Build and push with Cloud Build
  log(`[1/${createVm ? "2" : "1"}] Building and pushing image to Artifact Registry...`);
  log(`Context: ${contextDir}`);
  log(``);

  const buildSuccess = await runCommand(
    "gcloud",
    [
      "builds",
      "submit",
      "--config",
      path.join(remoteDir, "cloudbuild.yaml"),
      "--substitutions",
      `_IMAGE_URL=${imageUrl}`,
      "--project",
      gcpProject,
      contextDir,
    ],
    log
  );

  if (!buildSuccess) {
    logError("Build failed!");
    return res.end();
  }

  logSuccess(`Image pushed to ${imageUrl}`);
  log(``);

  // Step 2: Create VM if requested
  if (createVm) {
    log(`[2/2] Creating VM ${vmName} in ${vmZone}...`);

    // Build environment variables for the container
    const envVars = [
      `STORAGE_TYPE=${storageType}`,
      `SSH_USERS=${sshUser}:${sshPassword}`,
    ];

    if (storageType === "archil") {
      envVars.push(`ARCHIL_API_KEY=${archilApiKey}`);
      envVars.push(`ARCHIL_BUCKET=${archilBucket}`);
      if (archilRegion) {
        envVars.push(`ARCHIL_REGION=${archilRegion}`);
      }
    }

    // Create VM with Container-Optimized OS
    const createVmArgs = [
      "compute",
      "instances",
      "create-with-container",
      vmName,
      "--project",
      gcpProject,
      "--zone",
      vmZone,
      "--machine-type",
      machineType,
      "--container-image",
      imageUrl,
      "--container-privileged", // Required for FUSE/Archil
      "--tags",
      "constellation-ssh",
    ];

    // Add environment variables
    for (const envVar of envVars) {
      createVmArgs.push("--container-env", envVar);
    }

    const vmSuccess = await runCommand("gcloud", createVmArgs, log);

    if (!vmSuccess) {
      logError("VM creation failed!");
      log(``);
      log(`Note: If the VM already exists, you may need to delete it first:`);
      log(`  gcloud compute instances delete ${vmName} --zone=${vmZone} --project=${gcpProject}`);
      return res.end();
    }

    logSuccess(`VM ${vmName} created!`);
    log(``);

    // Get external IP
    log(`Getting VM external IP...`);
    await runCommand(
      "gcloud",
      [
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
      ],
      log
    );

    log(``);
    log(`To connect via SSH (once container starts):`);
    log(`  ssh ${sshUser}@<EXTERNAL_IP>`);
    log(``);
    log(`Note: You may need to create a firewall rule to allow SSH on port 22:`);
    log(`  gcloud compute firewall-rules create allow-constellation-ssh \\`);
    log(`    --allow tcp:22 --target-tags constellation-ssh --project ${gcpProject}`);
  } else {
    log(`Image built and pushed. To use it:`);
    log(``);
    log(`1. Create a VM manually:`);
    log(`   gcloud compute instances create-with-container ${imageName}-vm \\`);
    log(`     --container-image=${imageUrl} \\`);
    log(`     --container-privileged \\`);
    log(`     --container-env=STORAGE_TYPE=local \\`);
    log(`     --container-env=SSH_USERS=dev:yourpassword \\`);
    log(`     --project=${gcpProject}`);
  }

  log(``);
  log(`=== Done ===`);
  res.end();
});

// Helper to run a command and stream output
function runCommand(cmd, args, log) {
  return new Promise((resolve) => {
    const fullCommand = `${cmd} ${args.map((a) => `'${a}'`).join(" ")}`;
    log(`> ${fullCommand}\n`);

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

app.listen(PORT, () => {
  console.log(`\n🚀 ConstellationFS Deploy Tool`);
  console.log(`   Open http://localhost:${PORT} in your browser\n`);
});
