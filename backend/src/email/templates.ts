function shell(title: string, body: string, cta?: { label: string; href: string }): string {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f6fb;padding:24px">
<div style="max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden">
<div style="background:#0f172a;color:#fff;padding:20px 24px"><h1 style="margin:0;font-size:20px">🚘 FleetTrack</h1><p style="margin:4px 0 0;opacity:.8">${title}</p></div>
<div style="padding:24px">${body}
${cta ? `<p style="margin:24px 0"><a href="${cta.href}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">${cta.label}</a></p>` : ''}
<p style="color:#64748b;font-size:12px">Security notice: never share this email. If you did not request it, ignore it or contact support: support@fleettrack.example</p>
</div></div></body></html>`;
}
function textWrap(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

export const emailTemplates = {
  otp(name: string, code: string): { html: string; text: string; subject: string } {
    const html = shell('Your FleetTrack verification code', `<p>Hi ${name},</p><p>Use this code to verify your email and finish creating your driver account. It expires in <b>10 minutes</b>.</p><p style="font-size:32px;font-weight:800;letter-spacing:8px;text-align:center;background:#f1f5f9;border-radius:8px;padding:12px">${code}</p><p>Never share this code with anyone.</p>`);
    return { html, text: `Hi ${name}, your FleetTrack code is ${code} (expires in 10 minutes). Never share it.`, subject: 'Your FleetTrack verification code' };
  },  verification(name: string, link: string): { html: string; text: string; subject: string } {
    const html = shell('Verify your email', `<p>Hi ${name},</p><p>An administrator created / approved your FleetTrack account. Verify your email within <b>24 hours</b>.</p>`, { label: 'Verify Email', href: link });
    return { html, text: textWrap(`Hi ${name}, verify: ${link} (expires in 24h)`), subject: 'Verify your FleetTrack email' };
  },
  resend(name: string, link: string) {
    const html = shell('Your new verification link', `<p>Hi ${name},</p><p>Here is your new verification link (expires in 24 hours).</p>`, { label: 'Verify Email', href: link });
    return { html, text: `Hi ${name}, new link: ${link}`, subject: 'Your new FleetTrack verification link' };
  },
  approval(name: string) {
    const html = shell('Account approved', `<p>Hi ${name},</p><p>Your FleetTrack account has been <b>approved</b>. You can now log in.</p>`);
    return { html, text: `Hi ${name}, approved. You can log in.`, subject: 'FleetTrack account approved' };
  },
  rejection(name: string, reason = '') {
    const html = shell('Account update', `<p>Hi ${name},</p><p>Your FleetTrack account request was not approved. ${reason}</p>`);
    return { html, text: `Hi ${name}, not approved. ${reason}`, subject: 'FleetTrack account update' };
  },
  passwordReset(name: string, link: string) {
    const html = shell('Reset your password', `<p>Hi ${name},</p><p>Use the link below (expires in 1 hour).</p>`, { label: 'Reset Password', href: link });
    return { html, text: `Reset: ${link}`, subject: 'Reset your FleetTrack password' };
  },
  statusChange(name: string, active: boolean) {
    const html = shell(active ? 'Account activated' : 'Account deactivated', `<p>Hi ${name},</p><p>Your account is now <b>${active ? 'ACTIVE' : 'DISABLED'}</b>.</p>`);
    return { html, text: `Account ${active ? 'active' : 'disabled'}`, subject: 'FleetTrack account status changed' };
  },
};
