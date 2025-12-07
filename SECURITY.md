# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in this Review System, please report it by:

1. **Email**: Send details to [security email]
2. **GitHub**: Create a private security advisory
3. **Response Time**: We aim to respond within 48 hours

## Security Measures

### Authentication & Authorization
- Firebase Authentication for admin access
- Role-based access control in Firestore rules
- Client-side auth state management with Zustand

### Data Protection
- Input validation and sanitization
- XSS protection via React's built-in escaping
- CORS restrictions on Firebase Storage
- Rate limiting on comment submissions

### Infrastructure Security
- HTTPS enforcement (Strict-Transport-Security)
- Content Security Policy (CSP) headers
- X-Frame-Options to prevent clickjacking
- X-Content-Type-Options to prevent MIME sniffing

### Known Security Features
- Anti-spam honeypot fields in comment forms
- Time-delay validation for human verification
- Firestore security rules for data isolation
- Environment variable protection

## Disclosure Policy

We follow responsible disclosure practices. Please do not publicly disclose security vulnerabilities until we have had a chance to address them.