#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <stdarg.h>
#include <string.h>
#include <errno.h>
#include <sys/wait.h>
#include <sys/types.h>
#include <time.h>
#include <limits.h>
#include <sys/stat.h>

// Declare environ variable
extern char **environ;


// Function pointer types for original functions
typedef int (*orig_execve_f_type)(const char *filename, char *const argv[], char *const envp[]);
typedef int (*orig_execvp_f_type)(const char *file, char *const argv[]);
typedef int (*orig_execl_f_type)(const char *path, const char *arg, ...);
typedef int (*orig_execlp_f_type)(const char *file, const char *arg, ...);
typedef int (*orig_execle_f_type)(const char *path, const char *arg, ...);
typedef int (*orig_execv_f_type)(const char *path, char *const argv[]);
typedef int (*orig_system_f_type)(const char *command);
typedef pid_t (*orig_fork_f_type)(void);
typedef int (*orig_chdir_f_type)(const char *path);

// Debug logging function
static void debug_log(const char *format, ...) {
    if (getenv("CONSTELLATION_DEBUG")) {
        // Write to stderr for immediate visibility
        va_list args1;
        va_start(args1, format);
        fprintf(stderr, "[LD_PRELOAD] ");
        vfprintf(stderr, format, args1);
        fprintf(stderr, "\n");
        va_end(args1);
        
        // Also write to log file with human readable timestamp
        FILE *log_file = fopen("/tmp/constellation-fs-debug.log", "a");
        if (log_file) {
            va_list args2;
            va_start(args2, format);
            
            // Get current time and format as human readable
            time_t now;
            struct tm *tm_info;
            char time_string[64];
            
            time(&now);
            tm_info = localtime(&now);
            strftime(time_string, sizeof(time_string), "%Y-%m-%d %H:%M:%S", tm_info);
            
            // Get milliseconds for precision
            struct timespec ts;
            clock_gettime(CLOCK_REALTIME, &ts);
            int milliseconds = ts.tv_nsec / 1000000;
            
            fprintf(log_file, "[%s.%03d] [LD_PRELOAD] ", time_string, milliseconds);
            vfprintf(log_file, format, args2);
            fprintf(log_file, "\n");
            va_end(args2);
            fclose(log_file);
        }
    }
}

// Helper function to check if a filename is a shell
static int is_shell(const char *filename) {
    if (!filename) return 0;
    return (strstr(filename, "/sh") || strstr(filename, "/bash") || 
            strstr(filename, "/zsh") || strstr(filename, "/dash"));
}

// Helper function to check if we should intercept (combines SSH detection + gets CWD)
// Returns 1 if we should intercept, 0 if not. If returning 1, cwd_buffer is filled with current directory
static int should_intercept_and_get_cwd(char *cwd_buffer, size_t cwd_buffer_size, const char *command_or_filename, char *const argv[]);

// Helper function to execute command via SSH with specific working directory
static int execute_via_ssh(const char *command_str, const char *working_directory);

// Helper function to build command string from argv
static char* build_command_from_argv(char *const argv[]) {
    size_t total_len = 0;
    for (int i = 0; argv[i]; i++) {
        total_len += strlen(argv[i]) + 1;
    }
    
    char *cmd = malloc(total_len + 1);
    if (!cmd) {
        return NULL;
    }
    
    cmd[0] = '\0';
    for (int i = 0; argv[i]; i++) {
        // Simple quoting - escape single quotes and wrap in single quotes
        char *escaped_arg = malloc(strlen(argv[i]) * 4 + 3);
        if (!escaped_arg) {
            free(cmd);
            return NULL;
        }
        
        strcpy(escaped_arg, "'");
        char *src = argv[i];
        char *dst = escaped_arg + 1;
        while (*src) {
            if (*src == '\'') {
                strcpy(dst, "'\"'\"'");
                dst += 5;
            } else {
                *dst++ = *src;
            }
            src++;
        }
        *dst++ = '\'';
        *dst = '\0';
        
        strcat(cmd, escaped_arg);
        if (argv[i+1]) {
            strcat(cmd, " ");
        }
        
        free(escaped_arg);
    }
    
    return cmd;
}

// Helper function to check if a command involves SSH
// Returns 1 if command contains SSH, 0 if not
static int is_ssh_command(const char *command_or_filename, char *const argv[]) {
    // First check if CONSTELLATIONFS_APP_ID is set (basic requirement)
    const char *app_id = getenv("CONSTELLATIONFS_APP_ID");
    if (!app_id) {
        debug_log("CONSTELLATIONFS_APP_ID not set, not intercepting");
        return 0; // Don't intercept without app ID (return 0 means "not SSH", so no interception)
    }
    
    // Check the filename/command directly
    if (command_or_filename) {
        // Direct ssh binary calls
        if (strstr(command_or_filename, "/ssh") || strcmp(command_or_filename, "ssh") == 0) {
            debug_log("Direct SSH command detected: %s", command_or_filename);
            return 1; // This IS SSH, so don't intercept
        }
        
        // Shell calls that might contain ssh
        if (is_shell(command_or_filename) && argv && argv[0]) {
            // For shell calls, check the command arguments
            for (int i = 0; argv[i]; i++) {
                if (strstr(argv[i], "ssh ") || strstr(argv[i], "ssh\t") || 
                    strstr(argv[i], "ssh\n") || strcmp(argv[i], "ssh") == 0) {
                    debug_log("SSH command in shell arguments detected: %s", argv[i]);
                    return 1; // This IS SSH, so don't intercept
                }
            }
        }
    }
    
    debug_log("No SSH command detected, will intercept");
    return 0; // No SSH detected, so we should intercept
}

// Helper function to check if we should intercept (combines SSH detection + gets CWD)
// Returns 1 if we should intercept, 0 if not. If returning 1, cwd_buffer is filled with current directory
static int should_intercept_and_get_cwd(char *cwd_buffer, size_t cwd_buffer_size, const char *command_or_filename, char *const argv[]) {
    // First check if CONSTELLATIONFS_APP_ID is set (basic requirement)
    const char *app_id = getenv("CONSTELLATIONFS_APP_ID");
    if (!app_id) {
        debug_log("CONSTELLATIONFS_APP_ID not set, not intercepting");
        return 0;
    }
    
    // Check if this is an SSH command - if so, don't intercept
    if (is_ssh_command(command_or_filename, argv)) {
        debug_log("SSH command detected, not intercepting");
        return 0;
    }
    
    // Get current working directory
    if (getcwd(cwd_buffer, cwd_buffer_size) == NULL) {
        debug_log("Could not get current working directory, skipping interception");
        return 0; // Don't intercept if we can't determine CWD
    }
    
    debug_log("Current working directory: %s", cwd_buffer);
    
    debug_log("Non-SSH command detected, will intercept");
    return 1; // Intercept all non-SSH commands
}

// Helper function to execute command via SSH
static int execute_via_ssh(const char *command_str, const char *working_directory) {
    // Note: working_directory parameter kept for compatibility but not used
    debug_log("[STEP 1] execute_via_ssh called with command: %s", command_str);
    
    // Get the original execve function to completely bypass our interception
    static orig_execve_f_type orig_execve = NULL;
    if (!orig_execve) {
        debug_log("[STEP 2] Getting orig_execve via dlsym");
        orig_execve = (orig_execve_f_type)dlsym(RTLD_NEXT, "execve");
        debug_log("[STEP 3] orig_execve = %p", (void*)orig_execve);
    }
    
    debug_log("[STEP 4] Getting environment variables");
    const char *remote_host = getenv("REMOTE_VM_HOST");
    debug_log("[STEP 5] remote_host=%s", remote_host ? remote_host : "NULL");
    
    // Build the full command to execute on remote
    char *full_command;
    
    if (working_directory) {
        // Always try to cd to the working directory
        debug_log("[STEP 6] Building command with working directory: %s", working_directory);
        size_t cmd_size = strlen(working_directory) + strlen(command_str) + 20;
        full_command = malloc(cmd_size);
        if (!full_command) {
            debug_log("[ERROR] malloc failed for full_command");
            errno = ENOMEM;
            return -1;
        }
        snprintf(full_command, cmd_size, "cd '%s' && %s", working_directory, command_str);
        debug_log("[STEP 6a] full_command: %s", full_command);
    } else {
        // No working directory provided
        debug_log("[STEP 6] No working directory, using command as-is: %s", command_str);
        full_command = strdup(command_str);
        if (!full_command) {
            debug_log("[ERROR] strdup failed for full_command");
            errno = ENOMEM;
            return -1;
        }
    }
    
    // Parse hostname and port from REMOTE_VM_HOST (format: user@hostname:port)
    char *host_copy = strdup(remote_host);
    if (!host_copy) {
        debug_log("[ERROR] strdup failed for host_copy");
        free(full_command);
        errno = ENOMEM;
        return -1;
    }
    
    char *user_host = host_copy;
    char *port_str = NULL;
    
    // Find the port separator ':'
    char *colon = strrchr(host_copy, ':');
    if (colon) {
        *colon = '\0';  // Terminate user@hostname part
        port_str = colon + 1;  // Point to port number
    }
    
    // Use REMOTE_VM_PORT if set, otherwise use parsed port
    const char *remote_port = getenv("REMOTE_VM_PORT");
    if (!remote_port) {
        remote_port = port_str;
    }
    
    // Port is required
    if (!remote_port) {
        debug_log("[ERROR] No port specified in REMOTE_VM_HOST or REMOTE_VM_PORT");
        free(full_command);
        free(host_copy);
        errno = EINVAL;
        return -1;
    }
    
    // Build SSH arguments array
    // Check if we should use password authentication
    const char *ssh_password = getenv("REMOTE_VM_PASSWORD");
    
    // Allocate args - use char* (not const char*) and make static strings
    char *ssh_args[12];
    int arg_idx = 0;
    
    if (ssh_password) {
        // Use sshpass for password authentication
        debug_log("[STEP 7] Building SSH arguments with password authentication");
        ssh_args[arg_idx++] = strdup("sshpass");
        ssh_args[arg_idx++] = strdup("-p");
        ssh_args[arg_idx++] = strdup(ssh_password);
    } else {
        debug_log("[STEP 7] Building SSH arguments with key authentication");
    }
    
    ssh_args[arg_idx++] = strdup("ssh");
    ssh_args[arg_idx++] = strdup("-o");
    ssh_args[arg_idx++] = strdup("StrictHostKeyChecking=no");
    ssh_args[arg_idx++] = strdup("-p");
    ssh_args[arg_idx++] = strdup(remote_port);
    ssh_args[arg_idx++] = strdup(user_host);
    ssh_args[arg_idx++] = strdup(full_command);
    ssh_args[arg_idx] = NULL;
    
    debug_log("[STEP 7a] SSH command: %s", ssh_password ? "sshpass -p <password> ssh ..." : "ssh ...");
    debug_log("[STEP 8] SSH args built successfully");

    debug_log("[STEP 9] About to fork() - Executing SSH via fork/exec: ssh %s '%s'", user_host, full_command);
    
    // Fork and exec SSH directly using original execve to bypass all interception
    debug_log("[STEP 10] About to call fork()");
    pid_t pid = fork();
    debug_log("[STEP 11] fork() returned: %d", pid);
    
    if (pid == 0) {
        // Child process: exec SSH directly
        debug_log("[CHILD STEP 1] In child process, about to call orig_execve");
        
        // Determine which binary to execute
        const char *exec_binary = ssh_password ? "/usr/bin/sshpass" : "/usr/bin/ssh";
        debug_log("[CHILD STEP 2] Calling orig_execve('%s', ssh_args, environ)", exec_binary);
        
        orig_execve(exec_binary, ssh_args, environ);
        // If execve fails, exit with error
        debug_log("[CHILD ERROR] orig_execve failed with errno: %d, exiting", errno);
        _exit(127);
    } else if (pid > 0) {
        // Parent process: wait for child
        debug_log("[PARENT STEP 1] In parent process, waiting for child %d", pid);
        int status;
        if (waitpid(pid, &status, 0) == -1) {
            debug_log("[PARENT ERROR] waitpid failed with errno: %d", errno);
            free(full_command);
            free(host_copy);
            return -1;
        }
        debug_log("[PARENT STEP 2] Child exited with status: %d", WEXITSTATUS(status));
        
        // Free all allocated strings in ssh_args
        for (int i = 0; ssh_args[i] != NULL; i++) {
            free(ssh_args[i]);
        }
        
        free(full_command);
        free(host_copy);
        return WEXITSTATUS(status);
    } else {
        // Fork failed
        debug_log("[ERROR] fork() failed with errno: %d", errno);
        
        // Free all allocated strings in ssh_args
        for (int i = 0; ssh_args[i] != NULL; i++) {
            free(ssh_args[i]);
        }
        
        free(full_command);
        free(host_copy);
        return -1;
    }
}

int execve(const char *filename, char *const argv[], char *const envp[]) {
    debug_log("execve called: filename=%s", filename);
    
    // Check if we should intercept and get current working directory
    char cwd[PATH_MAX];
    if (!should_intercept_and_get_cwd(cwd, sizeof(cwd), filename, argv)) {
        // Execute normally without interception
        static orig_execve_f_type orig_execve = NULL;
        if (!orig_execve) {
            orig_execve = (orig_execve_f_type)dlsym(RTLD_NEXT, "execve");
        }
        return orig_execve(filename, argv, envp);
    }
    
    char *cmd = build_command_from_argv(argv);
    if (!cmd) {
        errno = ENOMEM;
        return -1;
    }

    debug_log("Intercepting command: %s", cmd);
    int result = execute_via_ssh(cmd, cwd);
    free(cmd);
    
    // execve should never return on success - it replaces the process
    // If SSH succeeded (result == 0), we should exit with that status
    // Only return if there was an error
    if (result == 0) {
        _exit(0);  // Success - exit the process
    }
    return result;  // Error - return to caller
}

int execvp(const char *file, char *const argv[]) {
    debug_log("execvp called: file=%s", file);

    // Check if we should intercept and get current working directory
    char cwd[PATH_MAX];
    if (!should_intercept_and_get_cwd(cwd, sizeof(cwd), file, argv)) {
        // Execute normally without interception
        static orig_execvp_f_type orig_execvp = NULL;
        if (!orig_execvp) {
            orig_execvp = (orig_execvp_f_type)dlsym(RTLD_NEXT, "execvp");
        }
        return orig_execvp(file, argv);
    }

    char *cmd = build_command_from_argv(argv);
    if (!cmd) {
        errno = ENOMEM;
        return -1;
    }

    debug_log("Intercepting command: %s", cmd);
    int result = execute_via_ssh(cmd, cwd);
    free(cmd);
    
    // execve should never return on success - it replaces the process
    // If SSH succeeded (result == 0), we should exit with that status
    // Only return if there was an error
    if (result == 0) {
        _exit(0);  // Success - exit the process
    }
    return result;  // Error - return to caller
}

int execv(const char *path, char *const argv[]) {
    debug_log("execv called: path=%s", path);
    
    // Check if we should intercept and get current working directory
    char cwd[PATH_MAX];
    if (!should_intercept_and_get_cwd(cwd, sizeof(cwd), path, argv)) {
        // Execute normally without interception
        static orig_execv_f_type orig_execv = NULL;
        if (!orig_execv) {
            orig_execv = (orig_execv_f_type)dlsym(RTLD_NEXT, "execv");
        }
        return orig_execv(path, argv);
    }
    
    char *cmd = build_command_from_argv(argv);
    if (!cmd) {
        errno = ENOMEM;
        return -1;
    }

    debug_log("Intercepting command: %s", cmd);
    int result = execute_via_ssh(cmd, cwd);
    free(cmd);
    
    // execve should never return on success - it replaces the process
    // If SSH succeeded (result == 0), we should exit with that status
    // Only return if there was an error
    if (result == 0) {
        _exit(0);  // Success - exit the process
    }
    return result;  // Error - return to caller
}

int system(const char *command) {
    debug_log("system called: command=%s", command ? command : "NULL");

    if (!command) {
        return 0; // Standard behavior for system(NULL)
    }

    // Check if we should intercept and get current working directory
    char cwd[PATH_MAX];
    if (!should_intercept_and_get_cwd(cwd, sizeof(cwd), command, NULL)) {
        // Execute normally without interception
        static orig_system_f_type orig_system = NULL;
        if (!orig_system) {
            orig_system = (orig_system_f_type)dlsym(RTLD_NEXT, "system");
        }
        return orig_system(command);
    }

    debug_log("Intercepting system command: %s", command);
    int result = execute_via_ssh(command, cwd);
    return result;
}

// Intercept execl - convert variable args to argv and call execve
int execl(const char *path, const char *arg, ...) {
    debug_log("execl called: path=%s", path);

    // Check if we should intercept and get current working directory
    char cwd[PATH_MAX];
    if (!should_intercept_and_get_cwd(cwd, sizeof(cwd), path, NULL)) {
        // Execute normally without interception
        static orig_execl_f_type orig_execl = NULL;
        if (!orig_execl) {
            orig_execl = (orig_execl_f_type)dlsym(RTLD_NEXT, "execl");
        }
        
        // For execl, we need to build argv from variable arguments and call original execl
        va_list args;
        va_start(args, arg);
        
        // Count arguments
        int argc = 1;
        va_list count_args;
        va_copy(count_args, args);
        while (va_arg(count_args, char *) != NULL) {
            argc++;
        }
        va_end(count_args);
        
        // Call original execl with all arguments
        // Note: This is complex to implement generically, so we'll use execve instead
        char **argv = malloc((argc + 1) * sizeof(char *));
        if (!argv) {
            va_end(args);
            errno = ENOMEM;
            return -1;
        }
        
        argv[0] = (char *)arg;
        for (int i = 1; i < argc; i++) {
            argv[i] = va_arg(args, char *);
        }
        argv[argc] = NULL;
        va_end(args);
        
        static orig_execve_f_type orig_execve = NULL;
        if (!orig_execve) {
            orig_execve = (orig_execve_f_type)dlsym(RTLD_NEXT, "execve");
        }
        int result = orig_execve(path, argv, environ);
        free(argv);
        return result;
    }

    // For execl, we need to build argv from variable arguments
    va_list args;
    va_start(args, arg);
    int argc = 1; // Start with 1 for arg
    va_list count_args;
    va_copy(count_args, args);
    while (va_arg(count_args, char *) != NULL) {
        argc++;
    }
    va_end(count_args);
    
    char **argv = malloc((argc + 1) * sizeof(char *));
    if (!argv) {
        va_end(args);
        errno = ENOMEM;
        return -1;
    }
    
    argv[0] = (char *)arg;
    for (int i = 1; i < argc; i++) {
        argv[i] = va_arg(args, char *);
    }
    argv[argc] = NULL;
    va_end(args);

    char *cmd = build_command_from_argv(argv);
    free(argv);
    
    if (!cmd) {
        errno = ENOMEM;
        return -1;
    }

    debug_log("Intercepting command: %s", cmd);
    int result = execute_via_ssh(cmd, cwd);
    free(cmd);
    
    // execve should never return on success - it replaces the process
    // If SSH succeeded (result == 0), we should exit with that status
    // Only return if there was an error
    if (result == 0) {
        _exit(0);  // Success - exit the process
    }
    return result;  // Error - return to caller
}

int execlp(const char *file, const char *arg, ...) {
    debug_log("execlp called: file=%s", file);

    // Check if we should intercept and get current working directory
    char cwd[PATH_MAX];
    if (!should_intercept_and_get_cwd(cwd, sizeof(cwd), file, NULL)) {
        // Execute normally without interception
        static orig_execlp_f_type orig_execlp = NULL;
        if (!orig_execlp) {
            orig_execlp = (orig_execlp_f_type)dlsym(RTLD_NEXT, "execlp");
        }
        
        // For execlp, we need to build argv from variable arguments and call original execvp
        va_list args;
        va_start(args, arg);
        
        // Count arguments
        int argc = 1;
        va_list count_args;
        va_copy(count_args, args);
        while (va_arg(count_args, char *) != NULL) {
            argc++;
        }
        va_end(count_args);
        
        // Build argv and call execvp (which handles PATH searching)
        char **argv = malloc((argc + 1) * sizeof(char *));
        if (!argv) {
            va_end(args);
            errno = ENOMEM;
            return -1;
        }
        
        argv[0] = (char *)arg;
        for (int i = 1; i < argc; i++) {
            argv[i] = va_arg(args, char *);
        }
        argv[argc] = NULL;
        va_end(args);
        
        static orig_execvp_f_type orig_execvp = NULL;
        if (!orig_execvp) {
            orig_execvp = (orig_execvp_f_type)dlsym(RTLD_NEXT, "execvp");
        }
        int result = orig_execvp(file, argv);
        free(argv);
        return result;
    }

    // For execlp, we need to build argv from variable arguments  
    va_list args;
    va_start(args, arg);
    int argc = 1; // Start with 1 for arg
    va_list count_args;
    va_copy(count_args, args);
    while (va_arg(count_args, char *) != NULL) {
        argc++;
    }
    va_end(count_args);
    
    char **argv = malloc((argc + 1) * sizeof(char *));
    if (!argv) {
        va_end(args);
        errno = ENOMEM;
        return -1;
    }
    
    argv[0] = (char *)arg;
    for (int i = 1; i < argc; i++) {
        argv[i] = va_arg(args, char *);
    }
    argv[argc] = NULL;
    va_end(args);

    char *cmd = build_command_from_argv(argv);
    free(argv);
    
    if (!cmd) {
        errno = ENOMEM;
        return -1;
    }

    debug_log("Intercepting command: %s", cmd);
    int result = execute_via_ssh(cmd, cwd);
    free(cmd);
    
    // execve should never return on success - it replaces the process
    // If SSH succeeded (result == 0), we should exit with that status
    // Only return if there was an error
    if (result == 0) {
        _exit(0);  // Success - exit the process
    }
    return result;  // Error - return to caller
}

// Helper function to create directory recursively
static int mkdir_recursive(const char *path) {
    char tmp[PATH_MAX];
    char *p = NULL;
    size_t len;
    
    snprintf(tmp, sizeof(tmp), "%s", path);
    len = strlen(tmp);
    if (tmp[len - 1] == '/') {
        tmp[len - 1] = 0;
    }
    
    for (p = tmp + 1; *p; p++) {
        if (*p == '/') {
            *p = 0;
            if (mkdir(tmp, 0755) != 0 && errno != EEXIST) {
                return -1;
            }
            *p = '/';
        }
    }
    
    if (mkdir(tmp, 0755) != 0 && errno != EEXIST) {
        return -1;
    }
    
    return 0;
}

// Intercept chdir - create directory if needed, then call real chdir
int chdir(const char *path) {
    debug_log("chdir called: path=%s", path ? path : "NULL");
    
    if (!path) {
        errno = EFAULT;
        return -1;
    }
    
    // Get original chdir function
    static orig_chdir_f_type orig_chdir = NULL;
    if (!orig_chdir) {
        orig_chdir = (orig_chdir_f_type)dlsym(RTLD_NEXT, "chdir");
    }
    
    // Try original chdir first
    int result = orig_chdir(path);
    
    if (result == 0) {
        debug_log("chdir succeeded: %s", path);
        return 0;
    }
    
    // chdir failed - try creating the directory
    debug_log("chdir failed, attempting to create directory: %s", path);
    
    if (mkdir_recursive(path) == 0) {
        debug_log("Directory created successfully, retrying chdir");
        result = orig_chdir(path);
        if (result == 0) {
            debug_log("chdir succeeded after creating directory");
        } else {
            debug_log("chdir still failed after creating directory: errno=%d", errno);
        }
    } else {
        debug_log("Failed to create directory: errno=%d", errno);
    }
    
    return result;
}
