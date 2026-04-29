// Shared EzTrips email layout — ensures consistent branding across all emails

const BRAND = {
  navy: '#1e3a5f',
  navyDark: '#152d4a',
  accent: '#d4920a',
  green: '#166534',
  white: '#ffffff',
  gray: '#f8fafc',
  border: '#e5e7eb',
  textDark: '#333333',
  textMuted: '#888888',
};

/**
 * Wraps email body content in the standard EzTrips branded layout.
 *
 * @param headerTitle  - Text shown in the navy header bar
 * @param body         - Inner HTML content
 * @param options.headerBg - Override header background color (default: navy)
 * @param options.footerOrg - Organisation name for footer (default: "EzTrips")
 * @param options.footerExtra - Extra line in footer (phone, email, etc.)
 */
export function emailLayout(
  headerTitle: string,
  body: string,
  options?: {
    headerBg?: string;
    footerOrg?: string;
    footerExtra?: string;
  },
): string {
  const bg = options?.headerBg || BRAND.navy;
  const org = options?.footerOrg || 'EzTrips';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;color:${BRAND.textDark};max-width:600px;margin:0 auto;padding:0;background:${BRAND.gray};">
  <div style="background:${bg};padding:20px 28px;border-radius:8px 8px 0 0;text-align:left;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <h2 style="color:${BRAND.white};margin:0;font-size:1.3rem;">${headerTitle}</h2>
      </td>
      <td style="text-align:right;">
        <span style="color:rgba(255,255,255,0.7);font-size:0.75rem;font-weight:600;letter-spacing:0.5px;">EZTRIPS</span>
      </td>
    </tr></table>
  </div>
  <div style="background:${BRAND.white};border:1px solid ${BRAND.border};border-top:0;border-radius:0 0 8px 8px;padding:28px 24px;">
    ${body}
    <hr style="border:none;border-top:1px solid ${BRAND.border};margin:24px 0 16px;"/>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:0.8rem;color:${BRAND.textMuted};">
        ${org} — Travel Management
        ${options?.footerExtra ? `<br/>${options.footerExtra}` : ''}
      </td>
      <td style="text-align:right;font-size:0.7rem;color:#bbb;">
        Powered by EzTrips
      </td>
    </tr></table>
  </div>
</body>
</html>`;
}

export function emailButton(href: string, label: string, color?: string): string {
  const bg = color || BRAND.navy;
  return `<div style="text-align:center;margin:28px 0;">
  <a href="${href}"
     style="background:${bg};color:${BRAND.white};padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-size:1rem;display:inline-block;">
    ${label}
  </a>
</div>`;
}

export function emailInfoRow(label: string, value: string): string {
  return `<tr style="border-bottom:1px solid ${BRAND.border};">
  <td style="padding:8px 4px;color:#666;width:140px;">${label}</td>
  <td style="padding:8px 4px;font-weight:600;">${value}</td>
</tr>`;
}

export { BRAND };
