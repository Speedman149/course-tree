# BranchQuest privacy notice

Updated 25 November 2026. The public notice is rendered in Hebrew on `/about#privacy`, and linked from the feedback form. BranchQuest is an independent student project, not an official Technion service.

- **Local course progress:** added courses, expansions, filters, markings, repeat quantities and view state stay in this browser's localStorage. Feedback does not automatically transmit that state or browsing history.
- **Hosting/analytics:** Vercel serves the site/function and provides general usage analytics. Application analytics strip URL queries and fragments. Hosting/security services may process operational request information under their own policies.
- **Voluntary feedback:** category, description, optional course number and optional email are sent with sanitized page/source URLs and route, associated course identifiers when available, browser user-agent, app/build version and client-reported submission time. The server validates and sanitizes these fields again.
- **Email processing:** Vercel processes the request and Resend delivers plain-text feedback to the operator's configured private mailbox. A supplied email becomes Reply-To for answering the report. No visitor autoresponder, subscription or account is created.
- **Abuse prevention:** the function processes the platform-provided client IP, normalizes IPv6 to /64 and derives a keyed, one-way HMAC identity. Upstash Redis stores only hashed identities/fingerprints, counters, leases and submission status, with TTLs of at most 24 hours. It receives no raw IP, feedback content or visitor email from this application. Redis does not replace provider/hosting logs.
- **Retention and requests:** the operator's mailbox retains messages for handling reports; the application does not automatically delete mailbox copies or provider logs. Users can request review/deletion through the feedback form. Do not submit passwords, credentials or unrelated sensitive information. No fixed mailbox retention period or legal-compliance certification is claimed.

Provider information: [Vercel privacy policy](https://vercel.com/legal/privacy-policy), [Resend privacy policy](https://resend.com/legal/privacy-policy), [Upstash privacy policy](https://upstash.com/trust/privacy.pdf). The operator should review their own mailbox retention and provider-account settings before publication.
