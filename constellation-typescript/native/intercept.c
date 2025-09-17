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

// Debug logging function
static void debug_log(const char *format, ...) {
    if (getenv("CONSTELLATION_DEBUG")) {
        // Write to stderr (original)
        va_list args1;
        va_start(args1, format);
        fprintf(stderr, "[LD_PRELOAD] ");
        vfprintf(stderr, format, args1);
        fprintf(stderr, "\n");
        va_end(args1);
        
        // Also write to log file
        FILE *log_file = fopen("/tmp/constellation-fs-debug.log", "a");
        if (log_file) {
            va_list args2;
            va_start(args2, format);
            struct timespec ts;
            clock_gettime(CLOCK_REALTIME, &ts);
            fprintf(log_file, "[%ld.%03ld] [LD_PRELOAD] ", ts.tv_sec, ts.tv_nsec / 1000000);
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

// Helper function to check if we should intercept and get CWD
// Returns 1 if we should intercept, 0 if not. If returning 1, cwd_buffer is filled with current directory
static int should_intercept_and_get_cwd(char *cwd_buffer, size_t cwd_buffer_size);

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

// Helper function to check if we should intercept based on current working directory
static int should_intercept_and_get_cwd(char *cwd_buffer, size_t cwd_buffer_size) {
    if (getcwd(cwd_buffer, cwd_buffer_size) == NULL) {
        debug_log("Could not get current working directory, skipping interception");
        return 0; // Don't intercept if we can't determine CWD
    }
    
    debug_log("Current working directory: %s", cwd_buffer);
    
    // Only intercept if we're in a ConstellationFS app workspace
    const char *app_id = getenv("CONSTELLATIONFS_APP_ID");
    if (!app_id) {
        debug_log("CONSTELLATIONFS_APP_ID not set, not intercepting");
        return 0;
    }
    
    // Check if CWD contains the app ID path pattern
    // Pattern: {workspaceRoot}/{CONSTELLATIONFS_APP_ID}/users/{userId}
    // We check for the app_id in the path to match any workspace under this app
    char app_pattern[PATH_MAX];
    snprintf(app_pattern, sizeof(app_pattern), "/%s/", app_id);
    
    if (strstr(cwd_buffer, app_pattern) != NULL) {
        debug_log("CWD matches ConstellationFS app pattern containing '%s', intercepting", app_pattern);
        return 1;
    }
    
    debug_log("CWD does not match ConstellationFS app pattern containing '%s', not intercepting", app_pattern);
    return 0;
}

// Helper function to execute command via SSH with specific working directory
static int execute_via_ssh(const char *command_str, const char *working_directory) {
    debug_log("[STEP 1] execute_via_ssh called with command: %s, working_directory: %s", command_str, working_directory ? working_directory : "NULL");
    
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
    debug_log("[STEP 6] Building full command");
    char *full_command;
    if (working_directory) {
        debug_log("[STEP 7] Building command with working_directory");
        size_t cmd_size = strlen(working_directory) + strlen(command_str) + 10;
        full_command = malloc(cmd_size);
        if (!full_command) {
            debug_log("[ERROR] malloc failed for full_command");
            errno = ENOMEM;
            return -1;
        }
        snprintf(full_command, cmd_size, "cd \"%s\" && %s", working_directory, command_str);
        debug_log("[STEP 8] full_command = %s", full_command);
    } else {
        debug_log("[STEP 7] Building command without remote_cwd");
        full_command = strdup(command_str);
        if (!full_command) {
            debug_log("[ERROR] strdup failed for full_command");
            errno = ENOMEM;
            return -1;
        }
        debug_log("[STEP 8] full_command = %s", full_command);
    }
    
    // Parse hostname and port from REMOTE_VM_HOST
    const char *remote_port = getenv("REMOTE_VM_PORT");
    if (!remote_port) {
        remote_port = "22";  // Default SSH port
    }
    
    // Build SSH arguments array
    debug_log("[STEP 9] Building SSH arguments array with host=%s port=%s", remote_host, remote_port);
    char *ssh_args[] = {
        "ssh",
        "-o", "BatchMode=yes",
        "-o", "StrictHostKeyChecking=no",
        "-p", (char *)remote_port,
        (char *)remote_host,
        full_command,
        NULL
    };
    debug_log("[STEP 10] SSH args built successfully");

    debug_log("[STEP 11] About to fork() - Executing SSH via fork/exec: ssh %s '%s'", remote_host, full_command);
    
    // Fork and exec SSH directly using original execve to bypass all interception
    debug_log("[STEP 12] About to call fork()");
    pid_t pid = fork();
    debug_log("[STEP 13] fork() returned: %d", pid);
    
    if (pid == 0) {
        // Child process: exec SSH directly
        debug_log("[CHILD STEP 1] In child process, about to call orig_execve");
        debug_log("[CHILD STEP 2] Calling orig_execve('/usr/bin/ssh', ssh_args, environ)");
        orig_execve("/usr/bin/ssh", ssh_args, environ);
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
            return -1;
        }
        debug_log("[PARENT STEP 2] Child exited with status: %d", WEXITSTATUS(status));
        free(full_command);
        return WEXITSTATUS(status);
    } else {
        // Fork failed
        debug_log("[ERROR] fork() failed with errno: %d", errno);
        free(full_command);
        return -1;
    }
}

int execve(const char *filename, char *const argv[], char *const envp[]) {
    debug_log("execve called: filename=%s", filename);
    
    // Check if we should intercept and get current working directory
    char cwd[PATH_MAX];
    if (!should_intercept_and_get_cwd(cwd, sizeof(cwd))) {
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
    return result;
}

int execvp(const char *file, char *const argv[]) {
    debug_log("execvp called: file=%s", file);

    // Check if we should intercept and get current working directory
    char cwd[PATH_MAX];
    if (!should_intercept_and_get_cwd(cwd, sizeof(cwd))) {
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
    return result;
}

int execv(const char *path, char *const argv[]) {
    debug_log("execv called: path=%s", path);
    
    // Check if we should intercept and get current working directory
    char cwd[PATH_MAX];
    if (!should_intercept_and_get_cwd(cwd, sizeof(cwd))) {
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
    return result;
}

int system(const char *command) {
    debug_log("system called: command=%s", command ? command : "NULL");

    if (!command) {
        return 0; // Standard behavior for system(NULL)
    }

    // Check if we should intercept and get current working directory
    char cwd[PATH_MAX];
    if (!should_intercept_and_get_cwd(cwd, sizeof(cwd))) {
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
    if (!should_intercept_and_get_cwd(cwd, sizeof(cwd))) {
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
    return result;
}

int execlp(const char *file, const char *arg, ...) {
    debug_log("execlp called: file=%s", file);

    // Check if we should intercept and get current working directory
    char cwd[PATH_MAX];
    if (!should_intercept_and_get_cwd(cwd, sizeof(cwd))) {
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
    return result;
}