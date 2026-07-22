export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "img-src 'self' data: blob: https: http:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "script-src 'self'",
  "connect-src 'self' https:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'"
].join('; ');

export const SECURITY_HEADER_VALUES = Object.freeze({
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=15552000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN'
});

export const buildVercelSecurityHeaders = () => (
  Object.entries(SECURITY_HEADER_VALUES).map(([key, value]) => ({ key, value }))
);

export const setSecurityHeaders = (response, isProduction) => {
  for (const [key, value] of Object.entries(SECURITY_HEADER_VALUES)) {
    if (key === 'Strict-Transport-Security' && !isProduction) continue;
    response.setHeader(key, value);
  }
};
