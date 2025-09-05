#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <stdarg.h>
#include <string.h>
#include <errno.h>
#include <sys/wait.h>

// Declare environ variable
extern char **environ;

typedef int (*orig_execve_f_type)(const char *filename, char *const argv[], char *const envp[]);

int execve(const char *filename, char *const argv[], char *const envp[]) {
    static orig_execve_f_type orig_execve = NULL;
    if (!orig_execve) {
        orig_execve = (orig_execve_f_type)dlsym(RTLD_NEXT, "execve");
    }

    // Get the remote host from environment variable
    const char *remote_host = getenv("REMOTE_VM_HOST");
    if (!remote_host) {
        // If no remote host configured, fall back to original execve
        return orig_execve(filename, argv, envp);
    }

    // Build command string from argv
    size_t total_len = 0;
    for (int i = 0; argv[i]; i++) {
        // Add length of arg + space (or null terminator for last arg)
        total_len += strlen(argv[i]) + 1;
    }
    
    char *cmd = malloc(total_len + 1);
    if (!cmd) {
        errno = ENOMEM;
        return -1;
    }
    
    cmd[0] = '\0';
    for (int i = 0; argv[i]; i++) {
        // Simple quoting - escape single quotes and wrap in single quotes
        char *escaped_arg = malloc(strlen(argv[i]) * 4 + 3); // Worst case: all quotes
        if (!escaped_arg) {
            free(cmd);
            errno = ENOMEM;
            return -1;
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

    // Get working directory from environment if set
    const char *remote_cwd = getenv("CONSTELLATION_CWD");
    
    // Build SSH command
    char *ssh_cmd = malloc(strlen(remote_host) + strlen(cmd) + 100 + (remote_cwd ? strlen(remote_cwd) + 20 : 0));
    if (!ssh_cmd) {
        free(cmd);
        errno = ENOMEM;
        return -1;
    }
    
    if (remote_cwd) {
        snprintf(ssh_cmd, strlen(remote_host) + strlen(cmd) + strlen(remote_cwd) + 120,
                 "ssh -o BatchMode=yes -o StrictHostKeyChecking=no %s 'cd %s && %s'",
                 remote_host, remote_cwd, cmd);
    } else {
        snprintf(ssh_cmd, strlen(remote_host) + strlen(cmd) + 100,
                 "ssh -o BatchMode=yes -o StrictHostKeyChecking=no %s %s",
                 remote_host, cmd);
    }

    // Execute SSH command
    int ret = system(ssh_cmd);

    free(cmd);
    free(ssh_cmd);

    // Handle system() return value
    if (ret == -1) {
        errno = ECHILD;
        return -1;
    }

    // Simulate process exit with the exit code from SSH
    _exit(WEXITSTATUS(ret));
}

// Also intercept execvp for completeness
int execvp(const char *file, char *const argv[]) {
    // Find the full path and call execve
    char *full_path = NULL;
    
    // Simple path resolution - check if file contains '/'
    if (strchr(file, '/')) {
        full_path = strdup(file);
    } else {
        // Try to find in PATH
        const char *path_env = getenv("PATH");
        if (path_env) {
            char *path_copy = strdup(path_env);
            char *dir = strtok(path_copy, ":");
            while (dir) {
                char *candidate = malloc(strlen(dir) + strlen(file) + 2);
                sprintf(candidate, "%s/%s", dir, file);
                if (access(candidate, X_OK) == 0) {
                    full_path = candidate;
                    break;
                }
                free(candidate);
                dir = strtok(NULL, ":");
            }
            free(path_copy);
        }
    }
    
    if (!full_path) {
        full_path = strdup(file); // Fallback
    }
    
    // Call our intercepted execve
    int result = execve(full_path, argv, environ);
    free(full_path);
    return result;
}