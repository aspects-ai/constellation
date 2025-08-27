# Security Policy

## Supported Versions

Currently supported versions for security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability within ConstellationFS, please follow these steps:

### How to Report

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. Email security concerns to: security@constellationfs.dev (or specify your preferred contact)
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: We'll acknowledge receipt within 48 hours
- **Initial Assessment**: Within 5 business days, we'll provide an initial assessment
- **Updates**: We'll keep you informed about progress
- **Credit**: We'll credit you in the security advisory (unless you prefer anonymity)

### Security Best Practices

When using ConstellationFS:

1. **Workspace Isolation**: Always use proper workspace isolation
2. **Input Validation**: Validate all user inputs before passing to ConstellationFS
3. **Dangerous Operations**: Keep `preventDangerous` enabled in production
4. **Access Control**: Implement proper access controls at the application level
5. **Updates**: Keep ConstellationFS updated to the latest version

### Known Security Considerations

ConstellationFS implements several security measures:

- **Path Traversal Protection**: Prevents access outside workspace boundaries
- **Dangerous Command Blocking**: Blocks potentially harmful commands by default
- **Input Sanitization**: Validates and sanitizes paths and commands
- **No Direct Shell Access**: Commands are executed in controlled environments

### Responsible Disclosure

We believe in responsible disclosure:

1. We'll work with you to understand and resolve the issue
2. We'll publicly disclose the issue after a fix is available
3. We'll credit researchers who report valid vulnerabilities

Thank you for helping keep ConstellationFS secure!