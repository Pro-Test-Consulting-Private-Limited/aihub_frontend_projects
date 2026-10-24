// Generated from AppAtlas_Security_Performance_Load_Checklist.xlsx (sheets: Automation Split, Categories, Automated vs Guided Checks, Checks).
// Automated / guided totals per category come from the AppAtlas brief (section 5). Only the 8 categories the brief itemises
// (5.1-5.8) say which check is automated or guided; for the other 7 the brief gives totals only, so `mode` is null per check.
export type CheckMode = "automated" | "guided";
export type SecurityCheck = { name: string; does: string; mode: CheckMode | null };
export type SecurityCategory = { id: string; name: string; covers: string; automated: number; guided: number; itemised: boolean; brief: string; note: string | null; checks: SecurityCheck[] };

export const SECURITY_CATEGORIES: SecurityCategory[] = [
  {
    "id": "authentication-security",
    "name": "Authentication Security",
    "covers": "Verifies users are who they claim to be: password rules, MFA, login protection and secure token handling at sign-in.",
    "automated": 8,
    "guided": 8,
    "itemised": true,
    "brief": "5.1 · ASVS Ch.2",
    "note": null,
    "checks": [
      {
        "name": "Session token format & entropy",
        "does": "Detects predictable or short session tokens.",
        "mode": "automated"
      },
      {
        "name": "Session invalidation on logout",
        "does": "Verifies the token is rejected by the server after logout.",
        "mode": "automated"
      },
      {
        "name": "Brute force detection",
        "does": "Confirms lockout/CAPTCHA appears after N failed attempts (configurable).",
        "mode": "automated"
      },
      {
        "name": "CAPTCHA verification",
        "does": "Detects CAPTCHA presence and bypass resistance on login/registration.",
        "mode": "automated"
      },
      {
        "name": "Auth bypass via direct URL access",
        "does": "Confirms unauthenticated users are redirected from protected routes.",
        "mode": "automated"
      },
      {
        "name": "Credential stuffing rate limiting",
        "does": "Detects absence of request throttling on the auth endpoint.",
        "mode": "automated"
      },
      {
        "name": "Remember-me token scope",
        "does": "Checks token is domain-scoped and not readable by JavaScript.",
        "mode": "automated"
      },
      {
        "name": "OAuth state parameter validation",
        "does": "Checks for CSRF protection in OAuth flows.",
        "mode": "automated"
      },
      {
        "name": "Password hashing algorithm verification",
        "does": "Confirm bcrypt / Argon2 / scrypt is used.",
        "mode": "guided"
      },
      {
        "name": "MFA enforcement validation",
        "does": "Verify a second factor is required and not bypassable.",
        "mode": "guided"
      },
      {
        "name": "Credential stuffing protection effectiveness",
        "does": "Needs test-account setup to prove protection works.",
        "mode": "guided"
      },
      {
        "name": "Secure password reset flow",
        "does": "Token expiry, single-use, no account enumeration.",
        "mode": "guided"
      },
      {
        "name": "Account lockout notification",
        "does": "Email/SMS alert is sent when an account locks.",
        "mode": "guided"
      },
      {
        "name": "JWT signature validation & algorithm confusion",
        "does": "Test forged/altered JWTs and algorithm switching.",
        "mode": "guided"
      },
      {
        "name": "Refresh token rotation policy",
        "does": "Verify refresh tokens rotate and old ones are revoked.",
        "mode": "guided"
      },
      {
        "name": "Username enumeration prevention",
        "does": "Compare responses for valid vs invalid usernames.",
        "mode": "guided"
      }
    ]
  },
  {
    "id": "session-and-cookie-security",
    "name": "Session & Cookie Security",
    "covers": "Checks how login sessions and cookies are created, protected and expired so they can't be stolen or reused.",
    "automated": 6,
    "guided": 2,
    "itemised": true,
    "brief": "5.2 · ASVS Ch.3",
    "note": null,
    "checks": [
      {
        "name": "HttpOnly flag",
        "does": "Verified on all session-bearing cookies.",
        "mode": "automated"
      },
      {
        "name": "Secure flag",
        "does": "Verified on session cookies; flagged if absent in HTTP contexts.",
        "mode": "automated"
      },
      {
        "name": "SameSite attribute",
        "does": "Checks for Strict/Lax; flags missing or None without Secure.",
        "mode": "automated"
      },
      {
        "name": "Cookie domain scope",
        "does": "Flags cookies scoped to the parent domain where a child domain would do.",
        "mode": "automated"
      },
      {
        "name": "Session ID length & entropy",
        "does": "Validates at least 128-bit entropy in session IDs.",
        "mode": "automated"
      },
      {
        "name": "Sensitive data in cookies",
        "does": "Scans cookie values for PII patterns (email, name, address).",
        "mode": "automated"
      },
      {
        "name": "Session fixation prevention",
        "does": "Requires a two-browser test procedure.",
        "mode": "guided"
      },
      {
        "name": "Absolute vs idle session timeout",
        "does": "Verify both timeouts are enforced.",
        "mode": "guided"
      }
    ]
  },
  {
    "id": "authorization-and-access-control",
    "name": "Authorization & Access Control",
    "covers": "Ensures each user can only reach the data and functions their role allows; blocks privilege escalation and IDOR.",
    "automated": 4,
    "guided": 7,
    "itemised": true,
    "brief": "5.3 · ASVS Ch.4",
    "note": null,
    "checks": [
      {
        "name": "Forced browsing prevention",
        "does": "Tries direct URLs to admin/API/protected pages with a non-privileged token.",
        "mode": "automated"
      },
      {
        "name": "IDOR probes",
        "does": "Swaps object IDs in URLs/API params and checks for unauthorised data.",
        "mode": "automated"
      },
      {
        "name": "Horizontal privilege escalation",
        "does": "Tries to access another user's resources with the current session.",
        "mode": "automated"
      },
      {
        "name": "Admin endpoint exposure",
        "does": "Checks common admin paths (/admin, /api/admin, /console).",
        "mode": "automated"
      },
      {
        "name": "RBAC matrix verification",
        "does": "Check each role against the permission matrix.",
        "mode": "guided"
      },
      {
        "name": "Vertical privilege escalation",
        "does": "Low-privilege user attempts high-privilege functions.",
        "mode": "guided"
      },
      {
        "name": "Function-level authorization on all API endpoints",
        "does": "Check every endpoint enforces role checks.",
        "mode": "guided"
      },
      {
        "name": "Multi-tenant data isolation",
        "does": "Verify tenants cannot see each other's data.",
        "mode": "guided"
      },
      {
        "name": "Object-level authorization on data endpoints",
        "does": "Check every data-returning endpoint validates ownership.",
        "mode": "guided"
      },
      {
        "name": "Workflow step validation",
        "does": "E.g. can a user skip step 2 of a multi-step checkout?",
        "mode": "guided"
      },
      {
        "name": "Authorization token replay after expiry",
        "does": "Replay expired tokens and confirm rejection.",
        "mode": "guided"
      }
    ]
  },
  {
    "id": "input-validation-and-injection-protection",
    "name": "Input Validation & Injection Protection",
    "covers": "Tests that user input is validated and sanitised so attackers can't inject SQL, commands or templates.",
    "automated": 7,
    "guided": 4,
    "itemised": true,
    "brief": "5.4 · ASVS Ch.5",
    "note": null,
    "checks": [
      {
        "name": "Reflected XSS probes",
        "does": "Injects XSS payloads into inputs/URL params; checks for script execution.",
        "mode": "automated"
      },
      {
        "name": "Stored XSS probes",
        "does": "Submits payloads via forms; verifies they're escaped on later renders.",
        "mode": "automated"
      },
      {
        "name": "DOM XSS detection",
        "does": "Looks for unsafe innerHTML, document.write and eval in captured JS.",
        "mode": "automated"
      },
      {
        "name": "SQL injection basic probes",
        "does": "Single-quote/comment sequences; checks for SQL errors or odd behaviour.",
        "mode": "automated"
      },
      {
        "name": "HTML injection",
        "does": "Injects HTML tags; verifies they're neutralised in rendered output.",
        "mode": "automated"
      },
      {
        "name": "Path traversal",
        "does": "Tests file path parameters with ../ sequences.",
        "mode": "automated"
      },
      {
        "name": "Open redirect",
        "does": "Tests redirect parameters for external URL injection.",
        "mode": "automated"
      },
      {
        "name": "NoSQL injection",
        "does": "MongoDB operator injection, JSON injection.",
        "mode": "guided"
      },
      {
        "name": "Command injection",
        "does": "Requires a controlled test environment.",
        "mode": "guided"
      },
      {
        "name": "LDAP injection",
        "does": "Manual LDAP filter injection tests.",
        "mode": "guided"
      },
      {
        "name": "Server-Side Template Injection (SSTI)",
        "does": "Manual template-expression injection tests.",
        "mode": "guided"
      }
    ]
  },
  {
    "id": "xss-csrf-and-browser-security",
    "name": "XSS, CSRF & Browser Security",
    "covers": "Protects against script injection, forged requests and browser-level attacks via headers, CSP and CORS settings.",
    "automated": 8,
    "guided": 3,
    "itemised": true,
    "brief": "5.5 · ASVS Ch.5 & 14",
    "note": null,
    "checks": [
      {
        "name": "Content Security Policy (CSP)",
        "does": "Header present and complete (default-src, script-src, object-src, base-uri, frame-ancestors).",
        "mode": "automated"
      },
      {
        "name": "X-Frame-Options / frame-ancestors",
        "does": "Clickjacking prevention verified.",
        "mode": "automated"
      },
      {
        "name": "Strict-Transport-Security (HSTS)",
        "does": "Present, max-age of at least 1 year, includeSubDomains.",
        "mode": "automated"
      },
      {
        "name": "X-Content-Type-Options",
        "does": "Verifies 'nosniff' is set.",
        "mode": "automated"
      },
      {
        "name": "Referrer-Policy",
        "does": "Checks for a restrictive policy.",
        "mode": "automated"
      },
      {
        "name": "Permissions-Policy",
        "does": "Checks presence and appropriate scope.",
        "mode": "automated"
      },
      {
        "name": "CORS configuration",
        "does": "Flags Access-Control-Allow-Origin wildcard (*) with credentials.",
        "mode": "automated"
      },
      {
        "name": "CSRF token presence",
        "does": "Anti-CSRF tokens present in all state-changing form submissions.",
        "mode": "automated"
      },
      {
        "name": "CSRF token validation effectiveness",
        "does": "Requires request replay.",
        "mode": "guided"
      },
      {
        "name": "Subdomain takeover risk assessment",
        "does": "Review dangling DNS/subdomains.",
        "mode": "guided"
      },
      {
        "name": "Mixed content verification",
        "does": "HTTPS page loading HTTP resources.",
        "mode": "guided"
      }
    ]
  },
  {
    "id": "file-handling-security",
    "name": "File Handling Security",
    "covers": "Secures uploads and file access: type/size checks, malware scanning, and blocking of path traversal and web shells.",
    "automated": 4,
    "guided": 7,
    "itemised": false,
    "brief": "5.9",
    "note": null,
    "checks": [
      {
        "name": "File type validation",
        "does": "Only permitted file types are accepted.",
        "mode": null
      },
      {
        "name": "MIME type validation",
        "does": "Declared content type matches the file's real content.",
        "mode": null
      },
      {
        "name": "File extension validation",
        "does": "Extensions are checked against an allowlist; double extensions blocked.",
        "mode": null
      },
      {
        "name": "Executable upload prevention",
        "does": "Scripts/executables can't be uploaded or run.",
        "mode": null
      },
      {
        "name": "Web shell upload prevention",
        "does": "Uploads can't be used to plant server-side backdoors.",
        "mode": null
      },
      {
        "name": "Malware scanning",
        "does": "Uploaded files are scanned for viruses/malware.",
        "mode": null
      },
      {
        "name": "File size restriction",
        "does": "Upload size limits are enforced to prevent abuse.",
        "mode": null
      },
      {
        "name": "Secure upload storage",
        "does": "Files stored outside web root with safe names and permissions.",
        "mode": null
      },
      {
        "name": "Path traversal prevention",
        "does": "'../' sequences can't reach files outside the intended folder.",
        "mode": null
      },
      {
        "name": "LFI/RFI prevention",
        "does": "App can't be made to include local or remote files.",
        "mode": null
      },
      {
        "name": "XXE prevention",
        "does": "XML parsers reject malicious external entities.",
        "mode": null
      }
    ]
  },
  {
    "id": "api-security",
    "name": "API Security",
    "covers": "Verifies APIs enforce authentication/authorization, rate limits and schema validation, and don't over-expose data.",
    "automated": 7,
    "guided": 5,
    "itemised": true,
    "brief": "5.6 · ASVS Ch.11 & 12",
    "note": null,
    "checks": [
      {
        "name": "Unauthenticated API access",
        "does": "Replays captured requests without a token; expects 401/403.",
        "mode": "automated"
      },
      {
        "name": "Mass assignment detection",
        "does": "Checks POST/PUT bodies for client-controllable role/is_admin/verified.",
        "mode": "automated"
      },
      {
        "name": "Excessive data exposure",
        "does": "Flags API fields returned but never shown in the UI.",
        "mode": "automated"
      },
      {
        "name": "API rate limiting",
        "does": "Rapid repeated requests; checks for 429 or equivalent.",
        "mode": "automated"
      },
      {
        "name": "API versioning",
        "does": "Checks for version identifiers in paths/headers.",
        "mode": "automated"
      },
      {
        "name": "HTTP method restriction",
        "does": "Tests GET endpoints with POST/PUT/DELETE; expects rejection.",
        "mode": "automated"
      },
      {
        "name": "API error message information leakage",
        "does": "Checks for stack traces, DB names or internal paths in errors.",
        "mode": "automated"
      },
      {
        "name": "GraphQL introspection disable verification",
        "does": "Confirm introspection is off in production.",
        "mode": "guided"
      },
      {
        "name": "Webhook signature validation",
        "does": "Verify webhook signatures are checked.",
        "mode": "guided"
      },
      {
        "name": "BOLA systematic testing",
        "does": "Broken Object Level Authorisation tests across endpoints.",
        "mode": "guided"
      },
      {
        "name": "API schema validation vs OpenAPI/Swagger",
        "does": "Compare actual traffic to the spec.",
        "mode": "guided"
      },
      {
        "name": "Batch API request abuse testing",
        "does": "Test abuse of batched/bulk requests.",
        "mode": "guided"
      }
    ]
  },
  {
    "id": "sensitive-data-protection",
    "name": "Sensitive Data Protection",
    "covers": "Confirms data is protected in transit, at rest and in logs/errors: HTTPS/TLS, encryption, masking and secret handling.",
    "automated": 7,
    "guided": 4,
    "itemised": true,
    "brief": "5.7 · ASVS Ch.6 & 8",
    "note": null,
    "checks": [
      {
        "name": "HTTPS enforcement",
        "does": "Checks HTTP versions of crawled pages; flags missing/weak redirects.",
        "mode": "automated"
      },
      {
        "name": "TLS version detection",
        "does": "Verifies TLS 1.2+; flags TLS 1.0/1.1 support.",
        "mode": "automated"
      },
      {
        "name": "Sensitive data in URL parameters",
        "does": "Scans query strings for passwords, tokens, PII.",
        "mode": "automated"
      },
      {
        "name": "PII in network requests",
        "does": "Scans request/response bodies for email, phone, national ID, card patterns.",
        "mode": "automated"
      },
      {
        "name": "Tokens in localStorage",
        "does": "Scans localStorage for session-token/credential patterns.",
        "mode": "automated"
      },
      {
        "name": "Credit card number pattern detection",
        "does": "Checks form submissions and API responses for PAN patterns.",
        "mode": "automated"
      },
      {
        "name": "Stack trace in error responses",
        "does": "Checks for framework versions or internal paths in errors.",
        "mode": "automated"
      },
      {
        "name": "Encryption-at-rest verification",
        "does": "Requires database/infrastructure access.",
        "mode": "guided"
      },
      {
        "name": "Key management review",
        "does": "Review how keys are stored, rotated and accessed.",
        "mode": "guided"
      },
      {
        "name": "Secrets in source code (git history scan)",
        "does": "Scan repo history for committed secrets.",
        "mode": "guided"
      },
      {
        "name": "PII masking in logs",
        "does": "Check logs for unmasked personal data.",
        "mode": "guided"
      }
    ]
  },
  {
    "id": "security-misconfiguration-prevention",
    "name": "Security Misconfiguration Prevention",
    "covers": "Finds unsafe defaults and exposed items: debug mode, default credentials, open directories, public Swagger or .git.",
    "automated": 6,
    "guided": 4,
    "itemised": true,
    "brief": "5.8 · ASVS Ch.14",
    "note": null,
    "checks": [
      {
        "name": "Debug mode indicators",
        "does": "Checks for debug headers, verbose errors, framework debug endpoints.",
        "mode": "automated"
      },
      {
        "name": "Directory listing",
        "does": "Tries common directories without index files.",
        "mode": "automated"
      },
      {
        "name": "Swagger/OpenAPI exposure in production",
        "does": "Checks /swagger-ui, /api-docs, /openapi.json.",
        "mode": "automated"
      },
      {
        "name": "Source map exposure",
        "does": "Checks for accessible .map files in the production build.",
        "mode": "automated"
      },
      {
        "name": ".git directory exposure",
        "does": "Checks /.git/HEAD accessibility.",
        "mode": "automated"
      },
      {
        "name": "Default error pages",
        "does": "Identifies default Apache/Nginx/IIS error pages.",
        "mode": "automated"
      },
      {
        "name": "Default credential audit",
        "does": "Manual check for factory/default logins.",
        "mode": "guided"
      },
      {
        "name": "Unnecessary HTTP methods (TRACE, CONNECT)",
        "does": "Confirm risky methods are disabled.",
        "mode": "guided"
      },
      {
        "name": "Backup file exposure (.bak, .old, .backup)",
        "does": "Search for exposed backup files.",
        "mode": "guided"
      },
      {
        "name": "Environment variable leakage",
        "does": "Check responses/config for leaked env vars.",
        "mode": "guided"
      }
    ]
  },
  {
    "id": "ssrf-and-server-abuse-protection",
    "name": "SSRF & Server Abuse Protection",
    "covers": "Prevents the server from being tricked into calling internal systems, cloud metadata or attacker-chosen URLs.",
    "automated": 4,
    "guided": 2,
    "itemised": false,
    "brief": "5.9",
    "note": null,
    "checks": [
      {
        "name": "SSRF prevention",
        "does": "Server can't be tricked into requesting attacker-chosen URLs.",
        "mode": null
      },
      {
        "name": "Internal network isolation",
        "does": "App servers can't reach internal-only systems unnecessarily.",
        "mode": null
      },
      {
        "name": "Metadata endpoint protection",
        "does": "Cloud metadata services (e.g. 169.254.169.254) are blocked.",
        "mode": null
      },
      {
        "name": "DNS rebinding prevention",
        "does": "Re-resolving a hostname can't bypass URL checks.",
        "mode": null
      },
      {
        "name": "URL allowlisting",
        "does": "Outbound requests are limited to approved destinations.",
        "mode": null
      },
      {
        "name": "Internal port scanning prevention",
        "does": "App can't be used to probe internal hosts/ports.",
        "mode": null
      }
    ]
  },
  {
    "id": "business-logic-security",
    "name": "Business Logic Security",
    "covers": "Tests abuse of application workflows: price/coupon/quantity tampering, payment bypass and race conditions.",
    "automated": 3,
    "guided": 6,
    "itemised": false,
    "brief": "5.9",
    "note": null,
    "checks": [
      {
        "name": "Coupon abuse prevention",
        "does": "Codes can't be reused, stacked or brute-forced.",
        "mode": null
      },
      {
        "name": "Price manipulation prevention",
        "does": "Prices are computed server-side; tampering is rejected.",
        "mode": null
      },
      {
        "name": "Quantity manipulation prevention",
        "does": "Negative or oversized quantities are rejected.",
        "mode": null
      },
      {
        "name": "Payment bypass prevention",
        "does": "Orders can't complete without a valid payment.",
        "mode": null
      },
      {
        "name": "Workflow validation",
        "does": "Multi-step flows can't be skipped or reordered.",
        "mode": null
      },
      {
        "name": "OTP replay prevention",
        "does": "One-time codes are single-use and short-lived.",
        "mode": null
      },
      {
        "name": "Race condition prevention",
        "does": "Parallel requests can't exploit timing (double-spend, double-redeem).",
        "mode": null
      },
      {
        "name": "Duplicate transaction prevention",
        "does": "Retries/double-clicks don't create duplicate transactions.",
        "mode": null
      },
      {
        "name": "Inventory manipulation prevention",
        "does": "Stock can't be falsely reserved, drained or oversold.",
        "mode": null
      }
    ]
  },
  {
    "id": "client-side-security",
    "name": "Client-Side Security",
    "covers": "Checks what is exposed in the browser: local/session storage, source maps and secrets in front-end code.",
    "automated": 5,
    "guided": 1,
    "itemised": false,
    "brief": "5.9",
    "note": null,
    "checks": [
      {
        "name": "Local storage protection",
        "does": "No sensitive data or tokens kept in localStorage.",
        "mode": null
      },
      {
        "name": "Session storage protection",
        "does": "No sensitive data kept in sessionStorage.",
        "mode": null
      },
      {
        "name": "Source map removal",
        "does": "Source maps are not published in production.",
        "mode": null
      },
      {
        "name": "Frontend secret removal",
        "does": "No API keys/secrets in front-end bundles.",
        "mode": null
      },
      {
        "name": "Secure browser caching",
        "does": "Sensitive pages aren't cached (correct cache-control headers).",
        "mode": null
      },
      {
        "name": "Client-side trust prevention",
        "does": "Security decisions never rely solely on browser-side checks.",
        "mode": null
      }
    ]
  },
  {
    "id": "mobile-app-security",
    "name": "Mobile App Security",
    "covers": "Covers mobile-specific protections: reverse-engineering resistance, SSL pinning, root detection and deep links.",
    "automated": 2,
    "guided": 5,
    "itemised": false,
    "brief": "5.9",
    "note": "Needs device access",
    "checks": [
      {
        "name": "Reverse engineering resistance",
        "does": "App code is obfuscated/hardened against decompilation.",
        "mode": null
      },
      {
        "name": "Hardcoded secret prevention",
        "does": "No keys or credentials embedded in the app binary.",
        "mode": null
      },
      {
        "name": "Secure local storage",
        "does": "On-device data kept in keychain/keystore and encrypted.",
        "mode": null
      },
      {
        "name": "SSL pinning",
        "does": "App only trusts the expected server certificates.",
        "mode": null
      },
      {
        "name": "Root/jailbreak detection",
        "does": "App detects and responds to compromised devices.",
        "mode": null
      },
      {
        "name": "Deep link validation",
        "does": "Deep links are validated and can't trigger unsafe actions.",
        "mode": null
      },
      {
        "name": "Biometric auth validation",
        "does": "Biometric login is implemented correctly and can't be bypassed.",
        "mode": null
      }
    ]
  },
  {
    "id": "recon-and-exposure-prevention",
    "name": "Recon & Exposure Prevention",
    "covers": "Reduces the attack surface visible from outside: subdomains, staging sites, public storage and open admin panels.",
    "automated": 3,
    "guided": 3,
    "itemised": false,
    "brief": "5.9",
    "note": null,
    "checks": [
      {
        "name": "Subdomain exposure review",
        "does": "Subdomains are inventoried; no forgotten or takeover-prone ones.",
        "mode": null
      },
      {
        "name": "Staging environment protection",
        "does": "Staging/test sites are not public or are access-controlled.",
        "mode": null
      },
      {
        "name": "Public storage exposure prevention",
        "does": "Cloud buckets/blobs are not publicly readable/writable.",
        "mode": null
      },
      {
        "name": "Open admin panel prevention",
        "does": "Admin consoles are not reachable from the internet.",
        "mode": null
      },
      {
        "name": "Public service exposure prevention",
        "does": "Databases, SSH and similar services are not exposed publicly.",
        "mode": null
      },
      {
        "name": "Environment leakage prevention",
        "does": "Server versions and internal hostnames are not disclosed.",
        "mode": null
      }
    ]
  },
  {
    "id": "logging-and-monitoring",
    "name": "Logging & Monitoring",
    "covers": "Confirms security events are logged, monitored and alerted on, with tamper-proof logs and incident-response readiness.",
    "automated": 2,
    "guided": 7,
    "itemised": false,
    "brief": "5.9",
    "note": "Needs infrastructure access",
    "checks": [
      {
        "name": "Audit logging",
        "does": "Key user/admin actions are recorded (who, what, when).",
        "mode": null
      },
      {
        "name": "Authentication event logging",
        "does": "Logins, failures, lockouts and resets are logged.",
        "mode": null
      },
      {
        "name": "Authorization failure logging",
        "does": "Denied access attempts are logged.",
        "mode": null
      },
      {
        "name": "Security event monitoring",
        "does": "Logs are actively reviewed for suspicious patterns.",
        "mode": null
      },
      {
        "name": "Intrusion detection",
        "does": "Tools detect and flag attack activity.",
        "mode": null
      },
      {
        "name": "Alerting configuration",
        "does": "Alerts reach the right people for security events.",
        "mode": null
      },
      {
        "name": "Centralized logging",
        "does": "Logs are aggregated in one protected place.",
        "mode": null
      },
      {
        "name": "Incident response readiness",
        "does": "A documented, tested plan exists for handling incidents.",
        "mode": null
      },
      {
        "name": "Log tampering prevention",
        "does": "Logs are write-protected / immutable.",
        "mode": null
      }
    ]
  }
];
