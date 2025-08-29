"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const zod = require("zod");
const child_process = require("child_process");
const promises = require("fs/promises");
const path = require("path");
const fs = require("fs");
const os = require("os");
const BACKEND_TYPES = ["local", "remote", "docker"];
const SHELL_TYPES = ["bash", "sh", "auto"];
const AUTH_TYPES = ["key", "password"];
const DEFAULTS = {
  PREVENT_DANGEROUS: true,
  SHELL: "auto",
  VALIDATE_UTILS: false,
  DOCKER_IMAGE: "ubuntu:latest"
};
const ERROR_CODES = {
  // Backend errors
  BACKEND_NOT_IMPLEMENTED: "BACKEND_NOT_IMPLEMENTED",
  UNSUPPORTED_BACKEND: "UNSUPPORTED_BACKEND",
  UNKNOWN_BACKEND: "UNKNOWN_BACKEND",
  MISSING_UTILITIES: "MISSING_UTILITIES",
  ABSOLUTE_PATH_REJECTED: "ABSOLUTE_PATH_REJECTED",
  PATH_ESCAPE_ATTEMPT: "PATH_ESCAPE_ATTEMPT",
  // Operation errors
  EXEC_FAILED: "EXEC_FAILED",
  EXEC_ERROR: "EXEC_ERROR",
  READ_FAILED: "READ_FAILED",
  WRITE_FAILED: "WRITE_FAILED",
  LS_FAILED: "LS_FAILED",
  // Validation errors
  EMPTY_COMMAND: "EMPTY_COMMAND",
  EMPTY_PATH: "EMPTY_PATH",
  DANGEROUS_OPERATION: "DANGEROUS_OPERATION"
};
const BaseBackendConfigSchema = zod.z.object({
  preventDangerous: zod.z.boolean().default(DEFAULTS.PREVENT_DANGEROUS),
  onDangerousOperation: zod.z.function().args(zod.z.string()).returns(zod.z.void()).optional(),
  maxOutputLength: zod.z.number().positive().optional()
});
const LocalBackendConfigSchema = BaseBackendConfigSchema.extend({
  type: zod.z.literal("local").default("local"),
  shell: zod.z.enum(SHELL_TYPES).default(DEFAULTS.SHELL),
  validateUtils: zod.z.boolean().default(DEFAULTS.VALIDATE_UTILS),
  userId: zod.z.string().min(1, "userId is required for local backend")
});
const RemoteBackendConfigSchema = BaseBackendConfigSchema.extend({
  type: zod.z.literal("remote"),
  workspace: zod.z.string().min(1, "Workspace path is required for remote backend"),
  host: zod.z.string().min(1, "Host is required for remote backend"),
  auth: zod.z.object({
    type: zod.z.enum(AUTH_TYPES),
    credentials: zod.z.record(zod.z.unknown())
  })
});
const DockerBackendConfigSchema = BaseBackendConfigSchema.extend({
  type: zod.z.literal("docker"),
  workspace: zod.z.string().min(1, "Workspace path is required for docker backend"),
  image: zod.z.string().default(DEFAULTS.DOCKER_IMAGE),
  options: zod.z.object({
    network: zod.z.string().optional(),
    volumes: zod.z.array(zod.z.string()).optional(),
    environment: zod.z.record(zod.z.string()).optional()
  }).optional()
});
const BackendConfigSchema = zod.z.discriminatedUnion("type", [
  LocalBackendConfigSchema,
  RemoteBackendConfigSchema,
  DockerBackendConfigSchema
]);
function validateLocalBackendConfig(config) {
  if (!config.userId) {
    throw new Error("userId is required for local backend");
  }
}
class FileSystemError extends Error {
  constructor(message, code, command) {
    super(message);
    this.code = code;
    this.command = command;
    this.name = "FileSystemError";
  }
}
class DangerousOperationError extends FileSystemError {
  constructor(command) {
    super(
      `Dangerous operation blocked: ${command}`,
      "DANGEROUS_OPERATION",
      command
    );
    this.name = "DangerousOperationError";
  }
}
class DockerBackend {
  /**
   * Create a new DockerBackend instance
   * @param options - Configuration for Docker backend
   * @throws {FileSystemError} Always throws as this backend is not yet implemented
   */
  constructor(options) {
    this.options = options;
    this.workspace = options.workspace;
    throw new FileSystemError(
      "Docker backend is not yet implemented. Please use the local backend for development. Docker backend support is planned for a future release and will provide containerized execution for enhanced security and isolation.",
      ERROR_CODES.BACKEND_NOT_IMPLEMENTED
    );
  }
  async exec(_command) {
    throw new FileSystemError("Docker backend not implemented", ERROR_CODES.BACKEND_NOT_IMPLEMENTED);
  }
  async read(_path) {
    throw new FileSystemError("Docker backend not implemented", ERROR_CODES.BACKEND_NOT_IMPLEMENTED);
  }
  async write(_path, _content) {
    throw new FileSystemError("Docker backend not implemented", ERROR_CODES.BACKEND_NOT_IMPLEMENTED);
  }
  // eslint-disable-next-line no-dupe-class-members
  async ls() {
    throw new FileSystemError("Docker backend not implemented", ERROR_CODES.BACKEND_NOT_IMPLEMENTED);
  }
}
const DANGEROUS_PATTERNS$1 = [
  // System-wide destructive operations
  /^rm\s+.*-rf?\s+\/($|\s)/,
  /^rm\s+.*-rf?\s+~($|\s)/,
  /^rm\s+.*-rf?\s+\*($|\s)/,
  // Privilege escalation
  /^sudo\b/,
  /^su\b/,
  // System modification
  /^chmod\s+.*777/,
  /^chown\s+.*root/,
  // Dangerous network downloads and execution
  /curl\b.*\|\s*(sh|bash|zsh|fish)\b/,
  /wget\b.*\|\s*(sh|bash|zsh|fish)\b/,
  /\|\s*(sh|bash|zsh|fish)\s*$/,
  // Direct network tools
  /^nc\b/,
  /^ncat\b/,
  /^telnet\b/,
  /^ftp\b/,
  /^ssh\b/,
  // Process/system control
  /^kill\s+-9/,
  /^killall\b/,
  /^pkill\b/,
  /^shutdown\b/,
  /^reboot\b/,
  /^halt\b/,
  /^init\s+[06]\b/,
  // File system manipulation outside workspace context
  /^mount\b/,
  /^umount\b/,
  /^fdisk\b/,
  /^mkfs\b/,
  /^fsck\b/,
  // Command substitution with dangerous commands
  /`(sudo|su|rm\s+-rf?\s*\/|shutdown|reboot)/,
  /\$\((sudo|su|rm\s+-rf?\s*\/|shutdown|reboot)/,
  // Path traversal attempts in sensitive operations
  /^(cp|mv|ln)\b.*\.\.\//
];
const ESCAPE_PATTERNS = [
  // Change directory commands
  /\bcd\b/,
  /\bpushd\b/,
  /\bpopd\b/,
  // Environment manipulation that could affect paths
  /export\s+PATH=/,
  /export\s+HOME=/,
  /export\s+PWD=/,
  // Absolute paths
  /\s\/[^\s]+/,
  // Space followed by /path
  /^\/[^\s]+/,
  // Starting with /path
  // Shell expansion
  /~\//,
  // Home directory
  /\$HOME/,
  // HOME variable
  /\$\{[^}]+\}/
  // Shell variable expansion
];
function isDangerous(command) {
  const normalized = command.trim().toLowerCase();
  return DANGEROUS_PATTERNS$1.some((pattern) => pattern.test(normalized));
}
function isEscapingWorkspace(command) {
  return ESCAPE_PATTERNS.some((pattern) => pattern.test(command));
}
class NoOpLogger {
  error() {
  }
  warn() {
  }
  info() {
  }
  debug() {
  }
}
let currentLogger = new NoOpLogger();
function getLogger() {
  return currentLogger;
}
class POSIXCommands {
  /**
   * Generate ls command with consistent options
   */
  static ls(path2, options = {}) {
    let flags = "";
    if (options.long) {
      flags += "l";
    }
    if (options.all) {
      flags += "a";
    }
    if (options.recursive) {
      flags += "R";
    }
    if (!flags) {
      flags = "1";
    }
    const cmd = `ls -${flags}`;
    return path2 ? `${cmd} "${path2}"` : cmd;
  }
  /**
   * Generate find command with proper escaping and options
   */
  static find(pattern, searchPath = ".", options = {}) {
    let cmd = `find "${searchPath}"`;
    if (options.maxDepth) {
      cmd += ` -maxdepth ${options.maxDepth}`;
    }
    if (options.type) {
      cmd += ` -type ${options.type}`;
    }
    cmd += ` -name "${pattern}"`;
    return cmd;
  }
  /**
   * Generate grep command with consistent options
   */
  static grep(pattern, files, options = {}) {
    let cmd = "grep";
    if (options.ignoreCase) {
      cmd += " -i";
    }
    if (options.lineNumbers) {
      cmd += " -n";
    }
    if (options.context) {
      cmd += ` -C ${options.context}`;
    }
    cmd += ` -- "${pattern}"`;
    if (files) {
      cmd += ` ${files}`;
    } else if (options.recursive) {
      cmd += " -r .";
    }
    return cmd;
  }
  /**
   * cat command for file reading
   */
  static cat(path2) {
    return `cat "${path2}"`;
  }
  /**
   * touch command for file creation
   */
  static touch(path2) {
    return `touch "${path2}"`;
  }
  /**
   * mkdir command with parent directory creation
   */
  static mkdir(path2, parents = true) {
    return parents ? `mkdir -p "${path2}"` : `mkdir "${path2}"`;
  }
  /**
   * stat command for file information
   */
  static stat(path2) {
    return `stat -c '%n|%F|%s|%Y' "${path2}" 2>/dev/null || stat -f '%N|%HT|%z|%m' "${path2}"`;
  }
  /**
   * wc command for counting
   */
  static wc(path2, options = {}) {
    let flags = "";
    if (options.lines) {
      flags += "l";
    }
    if (options.words) {
      flags += "w";
    }
    if (options.chars) {
      flags += "c";
    }
    const cmd = flags ? `wc -${flags}` : "wc";
    return path2 ? `${cmd} "${path2}"` : cmd;
  }
  /**
   * head command for reading file beginnings
   */
  static head(path2, lines = 10) {
    return `head -n ${lines} "${path2}"`;
  }
  /**
   * tail command for reading file endings
   */
  static tail(path2, lines = 10) {
    return `tail -n ${lines} "${path2}"`;
  }
  /**
   * sort command
   */
  static sort(path2, options = {}) {
    let flags = "";
    if (options.reverse) {
      flags += "r";
    }
    if (options.numeric) {
      flags += "n";
    }
    if (options.unique) {
      flags += "u";
    }
    const cmd = flags ? `sort -${flags}` : "sort";
    return path2 ? `${cmd} "${path2}"` : cmd;
  }
  /**
   * uniq command for removing duplicates
   */
  static uniq(path2, count = false) {
    const cmd = count ? "uniq -c" : "uniq";
    return path2 ? `${cmd} "${path2}"` : cmd;
  }
  /**
   * cut command for column extraction
   */
  static cut(fields, path2, delimiter = "	") {
    const cmd = `cut -d "${delimiter}" -f ${fields}`;
    return path2 ? `${cmd} "${path2}"` : cmd;
  }
  /**
   * Escape shell arguments to prevent command injection
   */
  static escapeShellArg(arg) {
    return `'${arg.replace(/'/g, `'"'"'`)}'`;
  }
  /**
   * Check if a command exists in the system
   */
  static checkCommand(command) {
    return `command -v ${command} >/dev/null 2>&1`;
  }
}
class ConstellationFS {
  static {
    this.instance = null;
  }
  constructor() {
    this.config = {
      workspaceRoot: path.join(os.tmpdir(), "constellation-fs", "users")
    };
    this.loadConfigFile();
  }
  /**
   * Load configuration from .constellationfs.json if it exists
   */
  loadConfigFile() {
    const configPath = ".constellationfs.json";
    if (fs.existsSync(configPath)) {
      try {
        const fileContent = fs.readFileSync(configPath, "utf-8");
        const loadedConfig = JSON.parse(fileContent);
        this.config = {
          ...this.config,
          ...loadedConfig
        };
      } catch (error) {
        console.warn(`Failed to load config from ${configPath}:`, error);
      }
    }
  }
  /**
   * Get the singleton instance
   * @returns ConstellationFS instance (creates with defaults if not loaded)
   */
  static getInstance() {
    if (!ConstellationFS.instance) {
      ConstellationFS.instance = new ConstellationFS();
    }
    return ConstellationFS.instance;
  }
  /**
   * Get the workspace root directory
   */
  get workspaceRoot() {
    return this.config.workspaceRoot;
  }
  /**
   * Get the full configuration object
   */
  get configuration() {
    return { ...this.config };
  }
  /**
   * Reset the singleton instance (useful for testing)
   */
  static reset() {
    ConstellationFS.instance = null;
  }
}
class WorkspaceManager {
  /**
   * Get the workspace path for a specific user
   * @param userId - The user identifier
   * @returns Absolute path to the user's workspace
   */
  static getUserWorkspacePath(userId) {
    const libraryConfig = ConstellationFS.getInstance();
    return path.join(libraryConfig.workspaceRoot, userId);
  }
  /**
   * Ensure a user's workspace directory exists
   * @param userId - The user identifier
   * @returns Absolute path to the created/existing workspace
   */
  static ensureUserWorkspace(userId) {
    const workspacePath = this.getUserWorkspacePath(userId);
    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath, { recursive: true });
    }
    return workspacePath;
  }
  /**
   * Check if a user workspace exists
   * @param userId - The user identifier
   * @returns True if the workspace exists
   */
  static workspaceExists(userId) {
    const workspacePath = this.getUserWorkspacePath(userId);
    return fs.existsSync(workspacePath);
  }
  /**
   * Validate a user ID for safe directory naming
   * @param userId - The user identifier to validate
   * @throws Error if userId is invalid
   */
  static validateUserId(userId) {
    if (!userId || userId.trim().length === 0) {
      throw new Error("User ID cannot be empty");
    }
    const validChars = /^[a-zA-Z0-9._-]+$/;
    if (!validChars.test(userId)) {
      throw new Error(`User ID '${userId}' can only contain letters, numbers, hyphens, underscores, and periods`);
    }
    if (userId.includes("..") || userId.includes("./") || userId.includes("/") || userId.includes("\\")) {
      throw new Error("User ID cannot contain path traversal sequences");
    }
  }
}
const DANGEROUS_PATTERNS = [
  // Directory navigation
  /\bcd\b/,
  /\bpushd\b/,
  /\bpopd\b/,
  // Shell expansion that could escape
  /~\//,
  // Home directory expansion
  /\$HOME/,
  // HOME variable
  /\$\{HOME\}/,
  // HOME variable with braces
  // Command substitution that could be used to escape
  /\$\([^)]+\)/,
  // $() command substitution
  /`[^`]+`/,
  // Backtick command substitution
  // Glob patterns that could access parent directories
  /\.\.[\/\\]/,
  // Parent directory traversal
  // Potential symlink creation to escape
  /\bln\s+-s/
  // Symbolic link creation
];
function parseCommand(command) {
  const issues = [];
  const filePaths = [];
  let hasAbsolutePath = false;
  let hasDangerousPattern = false;
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      hasDangerousPattern = true;
      issues.push(`Dangerous pattern detected: ${pattern}`);
    }
  }
  if (/\b(cd|pushd|popd)\b/.test(command)) {
    issues.push("Directory change commands are not allowed");
    hasDangerousPattern = true;
  }
  const pathPatterns = [
    // Absolute paths (but not URLs - check separately)
    /\s(\/[^\s;|&<>]*)/g,
    // Space before /path
    /^(\/[^\s;|&<>]*)/g,
    // Start of string /path
    // Relative paths with dots
    /\.\.\/[^\s;|&<>]*/g,
    /\.\/[^\s;|&<>]*/g,
    // Quoted paths
    /"([^"]*)"/g,
    /'([^']*)'/g,
    // Common file operations with paths
    /(?:cat|less|more|tail|head|grep|find|ls|rm|cp|mv|touch|mkdir)\s+([^\s;|&<>]+)/g
  ];
  for (const pattern of pathPatterns) {
    const matches = command.matchAll(pattern);
    for (const match of matches) {
      const path2 = match[1] || match[0];
      if (path2.startsWith("-")) continue;
      if (path2.match(/^[a-z]+:\/\//)) continue;
      if (path2.startsWith("/")) {
        hasAbsolutePath = true;
        issues.push(`Absolute path detected: ${path2}`);
      }
      if (path2.includes("../")) {
        issues.push(`Parent directory traversal detected: ${path2}`);
        hasDangerousPattern = true;
      }
      if (path2.startsWith("~")) {
        issues.push(`Home directory reference detected: ${path2}`);
        hasDangerousPattern = true;
      }
      filePaths.push(path2);
    }
  }
  const parts = command.trim().split(/\s+/);
  const baseCommand = parts[0] || "";
  const args = parts.slice(1);
  return {
    command: baseCommand,
    args,
    filePaths: [...new Set(filePaths)],
    // Remove duplicates
    hasAbsolutePath,
    hasDangerousPattern,
    issues
  };
}
function isCommandSafe(command) {
  const parsed = parseCommand(command);
  const dangerousCommands = ["wget", "curl", "nc", "ncat", "ssh", "scp", "rsync"];
  if (dangerousCommands.includes(parsed.command)) {
    return { safe: false, reason: `Network command '${parsed.command}' is not allowed` };
  }
  if (parsed.hasDangerousPattern) {
    return { safe: false, reason: parsed.issues.join("; ") };
  }
  if (parsed.hasAbsolutePath) {
    return { safe: false, reason: "Command contains absolute paths" };
  }
  return { safe: true };
}
function isPathEscaping(workspacePath, targetPath) {
  const normalizedWorkspace = path.normalize(workspacePath);
  const resolvedTarget = path.resolve(workspacePath, targetPath);
  const relativePath = path.relative(normalizedWorkspace, resolvedTarget);
  return relativePath.startsWith("..") || path.isAbsolute(relativePath);
}
function checkSymlinkSafety(workspacePath, targetPath) {
  try {
    const segments = targetPath.split("/");
    let currentPath = workspacePath;
    for (const segment of segments) {
      if (!segment || segment === ".") continue;
      currentPath = path.join(currentPath, segment);
      try {
        const stats = fs.lstatSync(currentPath);
        if (stats.isSymbolicLink()) {
          const linkTarget = fs.readlinkSync(currentPath);
          const resolvedLink = path.isAbsolute(linkTarget) ? linkTarget : path.resolve(currentPath, "..", linkTarget);
          const relativePath = path.relative(workspacePath, resolvedLink);
          if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
            return {
              safe: false,
              reason: `Symlink at ${currentPath} points outside workspace to ${linkTarget}`
            };
          }
        }
      } catch (err) {
        break;
      }
    }
    return { safe: true };
  } catch (err) {
    return { safe: false, reason: `Error checking symlink: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}
function validatePaths(workspacePath, paths) {
  const invalidPaths = [];
  for (const path$1 of paths) {
    if (path.isAbsolute(path$1)) {
      invalidPaths.push({ path: path$1, reason: "Absolute path not allowed" });
      continue;
    }
    if (isPathEscaping(workspacePath, path$1)) {
      invalidPaths.push({ path: path$1, reason: "Path escapes workspace" });
      continue;
    }
    if (path$1.includes("../")) {
      invalidPaths.push({ path: path$1, reason: "Parent directory traversal not allowed" });
      continue;
    }
    const symlinkCheck = checkSymlinkSafety(workspacePath, path$1);
    if (!symlinkCheck.safe) {
      invalidPaths.push({ path: path$1, reason: symlinkCheck.reason || "Unsafe symlink" });
    }
  }
  return {
    valid: invalidPaths.length === 0,
    invalidPaths
  };
}
class LocalBackend {
  /**
   * Create a new LocalBackend instance
   * @param options - Configuration options for the local backend
   * @throws {FileSystemError} When workspace doesn't exist or utilities are missing
   */
  constructor(options) {
    validateLocalBackendConfig(options);
    this.options = options;
    WorkspaceManager.validateUserId(options.userId);
    this.workspace = WorkspaceManager.ensureUserWorkspace(options.userId);
    this.shell = this.detectShell();
    if (options.validateUtils) {
      this.validateEnvironment();
    }
  }
  /**
   * Detect the best available shell for command execution
   */
  detectShell() {
    if (this.options.shell === "bash") {
      return "bash";
    } else if (this.options.shell === "sh") {
      return "sh";
    } else if (this.options.shell === "auto") {
      try {
        child_process.execSync("command -v bash", { stdio: "ignore" });
        return "bash";
      } catch {
        return "sh";
      }
    }
    return "sh";
  }
  /**
   * Validate that required POSIX utilities are available
   */
  validateEnvironment() {
    const requiredUtils = ["ls", "find", "grep", "cat", "wc", "head", "tail", "sort"];
    const missing = [];
    for (const util of requiredUtils) {
      try {
        child_process.execSync(`command -v ${util}`, { stdio: "ignore" });
      } catch {
        missing.push(util);
      }
    }
    if (missing.length > 0) {
      throw new FileSystemError(
        `Missing required POSIX utilities: ${missing.join(", ")}. Please ensure they are installed and available in PATH.`,
        ERROR_CODES.MISSING_UTILITIES
      );
    }
  }
  async exec(command) {
    if (this.options.preventDangerous && isDangerous(command)) {
      if (this.options.onDangerousOperation) {
        this.options.onDangerousOperation(command);
        return "";
      } else {
        throw new DangerousOperationError(command);
      }
    }
    if (isEscapingWorkspace(command)) {
      throw new FileSystemError(
        `Command attempts to escape workspace: ${command}`,
        ERROR_CODES.PATH_ESCAPE_ATTEMPT,
        command
      );
    }
    const safetyCheck = isCommandSafe(command);
    if (!safetyCheck.safe) {
      throw new FileSystemError(
        `Command failed safety check: ${safetyCheck.reason}`,
        ERROR_CODES.DANGEROUS_OPERATION,
        command
      );
    }
    const parsed = parseCommand(command);
    if (parsed.filePaths.length > 0) {
      const validation = validatePaths(this.workspace, parsed.filePaths);
      if (!validation.valid) {
        const reasons = validation.invalidPaths.map((p) => `${p.path}: ${p.reason}`).join(", ");
        throw new FileSystemError(
          `Command contains invalid paths: ${reasons}`,
          ERROR_CODES.PATH_ESCAPE_ATTEMPT,
          command
        );
      }
    }
    return new Promise((resolve2, reject) => {
      const child = child_process.spawn(this.shell, ["-c", command], {
        cwd: this.workspace,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          // Start with minimal environment
          PATH: "/usr/local/bin:/usr/bin:/bin",
          USER: process.env.USER,
          SHELL: this.shell,
          // Force working directory
          PWD: this.workspace,
          HOME: this.workspace,
          TMPDIR: path.join(this.workspace, ".tmp"),
          // Locale settings
          LANG: "C",
          LC_ALL: "C",
          // Block dangerous variables
          LD_PRELOAD: void 0,
          LD_LIBRARY_PATH: void 0,
          DYLD_INSERT_LIBRARIES: void 0,
          DYLD_LIBRARY_PATH: void 0
        }
      });
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });
      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });
      child.on("close", (code) => {
        if (code === 0) {
          let output = stdout.trim();
          if (this.options.maxOutputLength && output.length > this.options.maxOutputLength) {
            const truncatedLength = this.options.maxOutputLength - 50;
            output = `${output.substring(0, truncatedLength)}

... [Output truncated. Full output was ${output.length} characters, showing first ${truncatedLength}]`;
          }
          resolve2(output);
        } else {
          reject(
            new FileSystemError(
              `Command execution failed with exit code ${code}: ${stderr.trim() || stdout.trim()}`,
              ERROR_CODES.EXEC_FAILED,
              command
            )
          );
        }
      });
      child.on("error", (err) => {
        reject(this.wrapError(err, "Execute command", ERROR_CODES.EXEC_ERROR, command));
      });
    });
  }
  async read(path2) {
    const fullPath = this.resolvePath(path2);
    const symlinkCheck = checkSymlinkSafety(this.workspace, path2);
    if (!symlinkCheck.safe) {
      throw new FileSystemError(
        `Cannot read file: ${symlinkCheck.reason}`,
        ERROR_CODES.PATH_ESCAPE_ATTEMPT,
        `read ${path2}`
      );
    }
    try {
      return await promises.readFile(fullPath, "utf-8");
    } catch (error) {
      throw this.wrapError(error, "Read file", ERROR_CODES.READ_FAILED, `read ${path2}`);
    }
  }
  async write(path2, content) {
    const fullPath = this.resolvePath(path2);
    const parentPath = path2.includes("/") ? path2.substring(0, path2.lastIndexOf("/")) : ".";
    if (parentPath !== ".") {
      const symlinkCheck = checkSymlinkSafety(this.workspace, parentPath);
      if (!symlinkCheck.safe) {
        throw new FileSystemError(
          `Cannot write file: ${symlinkCheck.reason}`,
          ERROR_CODES.PATH_ESCAPE_ATTEMPT,
          `write ${path2}`
        );
      }
    }
    try {
      await promises.writeFile(fullPath, content, "utf-8");
    } catch (error) {
      throw this.wrapError(error, "Write file", ERROR_CODES.WRITE_FAILED, `write ${path2}`);
    }
  }
  // eslint-disable-next-line no-dupe-class-members
  async ls(patternOrOptions, options) {
    try {
      let pattern;
      let wantDetails = false;
      if (typeof patternOrOptions === "string") {
        pattern = patternOrOptions;
        wantDetails = options?.details === true;
      } else if (patternOrOptions?.details === true) {
        wantDetails = true;
      }
      if (wantDetails) {
        return this.lsWithDetails(pattern);
      } else {
        return this.lsNamesOnly(pattern);
      }
    } catch (error) {
      throw this.wrapError(error, "List directory", ERROR_CODES.LS_FAILED, `ls ${patternOrOptions || ""}`);
    }
  }
  async lsNamesOnly(pattern) {
    if (pattern) {
      const result = await this.exec(POSIXCommands.ls(pattern));
      return result ? result.split("\n").filter(Boolean) : [];
    } else {
      return await promises.readdir(this.workspace);
    }
  }
  async lsWithDetails(pattern) {
    const filenames = await this.lsNamesOnly(pattern);
    const fileInfos = [];
    for (const name of filenames) {
      try {
        const fullPath = path.join(this.workspace, name);
        const stats = await promises.stat(fullPath);
        let type;
        if (stats.isFile()) {
          type = "file";
        } else if (stats.isDirectory()) {
          type = "directory";
        } else if (stats.isSymbolicLink()) {
          type = "symlink";
        } else {
          type = "file";
        }
        fileInfos.push({
          name,
          type,
          size: stats.size,
          modified: stats.mtime
        });
      } catch (error) {
        getLogger().warn(`Failed to get stats for ${name}:`, error);
      }
    }
    return fileInfos;
  }
  /**
   * Wrap errors consistently across all operations
   */
  wrapError(error, operation, errorCode, command) {
    if (error instanceof FileSystemError) {
      return error;
    }
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return new FileSystemError(
      `${operation} failed: ${message}`,
      errorCode,
      command
    );
  }
  /**
   * Resolve a relative path within the workspace and validate it's safe
   */
  resolvePath(path$1) {
    if (path.isAbsolute(path$1)) {
      throw new FileSystemError(
        "Absolute paths are not allowed",
        ERROR_CODES.ABSOLUTE_PATH_REJECTED,
        path$1
      );
    }
    const fullPath = path.resolve(path.join(this.workspace, path$1));
    const relativePath = path.relative(this.workspace, fullPath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new FileSystemError(
        "Path escapes workspace boundary",
        ERROR_CODES.PATH_ESCAPE_ATTEMPT,
        path$1
      );
    }
    return fullPath;
  }
}
class RemoteBackend {
  /**
   * Create a new RemoteBackend instance
   * @param options - Configuration for remote backend
   * @throws {FileSystemError} Always throws as this backend is not yet implemented
   */
  constructor(options) {
    this.options = options;
    this.workspace = options.workspace;
    throw new FileSystemError(
      "Remote backend is not yet implemented. Please use the local backend for development or the Docker backend for isolation. Remote backend support is planned for a future release.",
      ERROR_CODES.BACKEND_NOT_IMPLEMENTED
    );
  }
  async exec(_command) {
    throw new FileSystemError("Remote backend not implemented", ERROR_CODES.BACKEND_NOT_IMPLEMENTED);
  }
  async read(_path) {
    throw new FileSystemError("Remote backend not implemented", ERROR_CODES.BACKEND_NOT_IMPLEMENTED);
  }
  async write(_path, _content) {
    throw new FileSystemError("Remote backend not implemented", ERROR_CODES.BACKEND_NOT_IMPLEMENTED);
  }
  // eslint-disable-next-line no-dupe-class-members
  async ls() {
    throw new FileSystemError("Remote backend not implemented", ERROR_CODES.BACKEND_NOT_IMPLEMENTED);
  }
}
class BackendFactory {
  /**
   * Create a backend instance based on configuration
   * @param config - Backend configuration object
   * @returns Configured backend instance
   * @throws {FileSystemError} When backend type is unsupported
   */
  static create(config) {
    const validatedConfig = BackendConfigSchema.parse(config);
    switch (validatedConfig.type) {
      case "local":
        return new LocalBackend(validatedConfig);
      case "remote":
        return new RemoteBackend(validatedConfig);
      case "docker":
        return new DockerBackend(validatedConfig);
      default:
        throw new FileSystemError(
          `Unsupported backend type: ${validatedConfig.type}`,
          ERROR_CODES.UNSUPPORTED_BACKEND
        );
    }
  }
  /**
   * Get list of available backend types
   * @returns Array of supported backend type strings
   */
  static getAvailableBackends() {
    return BACKEND_TYPES;
  }
  /**
   * Get default configuration for a backend type
   */
  static getDefaultConfig(backendType, workspace) {
    const baseConfig = {
      workspace,
      preventDangerous: true
    };
    switch (backendType) {
      case "local":
        return {
          ...baseConfig,
          type: "local",
          shell: "auto",
          validateUtils: false
        };
      case "remote":
        return {
          ...baseConfig,
          type: "remote",
          host: "",
          auth: {
            type: "key",
            credentials: {}
          }
        };
      case "docker":
        return {
          ...baseConfig,
          type: "docker",
          image: "ubuntu:latest",
          options: {}
        };
      default:
        throw new FileSystemError(
          `Unknown backend type: ${backendType}`,
          ERROR_CODES.UNKNOWN_BACKEND
        );
    }
  }
}
class FileSystem {
  /**
   * Create a new FileSystem instance
   * @param input - Backend configuration object with userId
   * @throws {FileSystemError} When configuration is invalid
   */
  constructor(input) {
    let backendConfig;
    if (input.type) {
      backendConfig = input;
    } else {
      backendConfig = {
        type: "local",
        shell: "auto",
        validateUtils: false,
        preventDangerous: true,
        ...input
      };
    }
    this.backend = BackendFactory.create(backendConfig);
  }
  /**
   * Get the workspace directory path
   * @returns Absolute path to the workspace directory
   */
  get workspace() {
    return this.backend.workspace;
  }
  /**
   * Get the full backend configuration
   * @returns Complete backend configuration object
   */
  get backendConfig() {
    return this.backend.options;
  }
  /**
   * Execute a shell command in the workspace
   * @param command - The shell command to execute
   * @returns Promise resolving to the command output
   * @throws {FileSystemError} When command is empty or execution fails
   * @throws {DangerousOperationError} When dangerous operations are blocked
   */
  async exec(command) {
    if (!command.trim()) {
      throw new FileSystemError("Command cannot be empty", ERROR_CODES.EMPTY_COMMAND);
    }
    return this.backend.exec(command);
  }
  /**
   * Read the contents of a file
   * @param path - Relative path to the file within the workspace
   * @returns Promise resolving to the file contents as UTF-8 string
   * @throws {FileSystemError} When path is empty, file doesn't exist, or read fails
   */
  async read(path2) {
    if (!path2.trim()) {
      throw new FileSystemError("Path cannot be empty", ERROR_CODES.EMPTY_PATH);
    }
    return this.backend.read(path2);
  }
  /**
   * Write content to a file
   * @param path - Relative path to the file within the workspace
   * @param content - Content to write to the file as UTF-8 string
   * @returns Promise that resolves when the write is complete
   * @throws {FileSystemError} When path is empty or write fails
   */
  async write(path2, content) {
    if (!path2.trim()) {
      throw new FileSystemError("Path cannot be empty", ERROR_CODES.EMPTY_PATH);
    }
    return this.backend.write(path2, content);
  }
  // eslint-disable-next-line no-dupe-class-members
  async ls(patternOrOptions, options) {
    if (typeof patternOrOptions === "string" && options?.details === true) {
      return this.backend.ls(patternOrOptions, options);
    } else if (patternOrOptions && typeof patternOrOptions === "object" && patternOrOptions.details === true) {
      return this.backend.ls(patternOrOptions);
    } else {
      return this.backend.ls(patternOrOptions);
    }
  }
}
class BaseSDKAdapter {
  constructor(fs2) {
    this.fs = fs2;
  }
  get fileSystem() {
    return this.fs;
  }
  get workspace() {
    return this.fs.workspace;
  }
  get backendConfig() {
    return this.fs.backendConfig;
  }
  /**
   * Execute a shell command (common across most SDKs)
   * @param command - The shell command to execute
   * @returns Promise resolving to command output
   */
  async exec(command) {
    return this.fs.exec(command);
  }
  /**
   * Read a file (common across most SDKs)  
   * @param path - Path to file to read
   * @returns Promise resolving to file contents
   */
  async read(path2) {
    return this.fs.read(path2);
  }
  /**
   * Write a file (common across most SDKs)
   * @param path - Path to file to write
   * @param content - Content to write
   * @returns Promise that resolves when write is complete
   */
  async write(path2, content) {
    return this.fs.write(path2, content);
  }
  /**
   * List files (common across most SDKs)
   * @param pattern - Optional pattern to filter files
   * @returns Promise resolving to file list
   */
  async ls(pattern) {
    return this.fs.ls(pattern);
  }
}
class ClaudeCodeAdapter extends BaseSDKAdapter {
  constructor(fs2) {
    super(fs2);
  }
  /**
   * Execute shell commands - maps to Claude's Bash tool
   * @param command - The shell command to execute
   * @returns Promise resolving to command output
   */
  async Bash(command) {
    return this.exec(command);
  }
  /**
   * List files and directories - maps to Claude's LS tool
   * @param path - Optional path to list (defaults to workspace root)
   * @returns Promise resolving to array of file/directory names
   */
  async LS(path2) {
    if (path2) {
      const command = POSIXCommands.ls(path2);
      return this.exec(command).then(
        (output) => output ? output.split("\n").filter(Boolean) : []
      );
    } else {
      const result = await this.ls();
      return Array.isArray(result) && typeof result[0] === "string" ? result : result.map((f) => f.name);
    }
  }
  /**
   * Find files using glob patterns - maps to Claude's Glob tool
   * @param pattern - Glob pattern to match files
   * @param path - Optional path to search in (defaults to current directory)
   * @returns Promise resolving to array of matching file paths
   */
  async Glob(pattern, path2) {
    const searchPath = path2 || ".";
    const command = POSIXCommands.find(pattern, searchPath, { type: "f" });
    const result = await this.exec(command);
    return result ? result.split("\n").filter(Boolean) : [];
  }
  /**
   * Search for patterns in file contents - maps to Claude's Grep tool
   * @param pattern - Pattern to search for
   * @param options - Search options
   * @returns Promise resolving to search results
   */
  async Grep(pattern, options = {}) {
    const grepOptions = {
      ignoreCase: options.ignoreCase,
      lineNumbers: options.lineNumbers,
      context: options.context,
      recursive: !options.files
    };
    const command = POSIXCommands.grep(pattern, options.files, grepOptions);
    try {
      return await this.exec(command);
    } catch {
      return "";
    }
  }
  /**
   * Read file contents - maps to Claude's Read tool
   * @param path - Path to file to read
   * @returns Promise resolving to file contents
   */
  async Read(path2) {
    return this.read(path2);
  }
  /**
   * Write content to file - maps to Claude's Write tool
   * @param path - Path to file to write
   * @param content - Content to write to file
   * @returns Promise that resolves when write is complete
   */
  async Write(path2, content) {
    return this.write(path2, content);
  }
  /**
   * Edit files by replacing specific text - maps to Claude's Edit tool
   * This is a simplified version that uses sed for basic find-replace operations
   * @param path - Path to file to edit
   * @param oldText - Text to replace
   * @param newText - Replacement text
   * @returns Promise that resolves when edit is complete
   */
  async Edit(path2, oldText, newText) {
    const escapedOld = oldText.replace(/[/\\&]/g, "\\$&");
    const escapedNew = newText.replace(/[/\\&]/g, "\\$&");
    await this.exec(`sed -i '' 's/${escapedOld}/${escapedNew}/g' "${path2}"`);
  }
}
exports.BaseSDKAdapter = BaseSDKAdapter;
exports.ClaudeCodeAdapter = ClaudeCodeAdapter;
exports.ConstellationFS = ConstellationFS;
exports.DangerousOperationError = DangerousOperationError;
exports.FileSystem = FileSystem;
exports.FileSystemError = FileSystemError;
