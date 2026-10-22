/** Shared by the contact form and the route that sends it. */
export const CONTACT_LIMITS = { name: 60, email: 254, message: 150 } as const;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
