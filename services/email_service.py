import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import settings

# Severity → accent colour map used in HTML templates
_SEVERITY_COLORS = {
    "CRITICAL": "#ef4444",   # rose-500
    "HIGH":     "#f97316",   # orange-500
    "INFO":     "#3b82f6",   # blue-500
}

# Alert type → emoji header
_TYPE_EMOJI = {
    "OUTBREAK_WARNING":           "🚨",
    "EXPERT_OUTBREAK_REGISTERED": "⚠️",
    "WEATHER_ALERT":              "🌩️",
    "DRY_SPELL":                  "☀️",
    "SYSTEM":                     "ℹ️",
}


class EmailService:
    def __init__(self):
        self.host     = settings.SMTP_HOST
        self.port     = settings.SMTP_PORT
        self.username = settings.SMTP_USERNAME
        self.password = settings.SMTP_PASSWORD

    # ─────────────────────────────────────────────────────────────────────────
    # Internal helper: send any pre-built MIME message
    # ─────────────────────────────────────────────────────────────────────────

    def _send(self, msg: MIMEMultipart, recipient_email: str) -> bool:
        """Sends a pre-built MIME message via SMTP.  Returns True on success."""
        try:
            if self.port == 465:
                server = smtplib.SMTP_SSL(self.host, self.port)
            else:
                server = smtplib.SMTP(self.host, self.port)
                server.starttls()

            server.login(self.username, self.password)
            server.sendmail(self.username, recipient_email, msg.as_string())
            server.quit()
            print(f"[EmailService] Email sent to {recipient_email} — Subject: {msg['Subject']}")
            return True
        except Exception as e:
            print(f"[EmailService ERROR] Failed to send email to {recipient_email}: {e}")
            return False

    # ─────────────────────────────────────────────────────────────────────────
    # OTP / Verification email (existing — unchanged)
    # ─────────────────────────────────────────────────────────────────────────

    def send_otp_email(self, recipient_email: str, code: str) -> bool:
        """
        Sends an OTP verification email to the user.
        If SMTP credentials are not configured, it logs the email content to stdout as a fallback.
        """
        subject = "Kisan Alert AI - Secure Verification OTP"

        html_content = f"""
        <html>
            <body style="font-family: 'Inter', sans-serif; background-color: #020617; color: #f1f5f9; padding: 30px; margin: 0;">
                <div style="max-width: 500px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; padding: 40px; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <span style="font-size: 40px;">🌱</span>
                        <h2 style="color: #10b981; margin: 10px 0 0; font-size: 24px; font-weight: 800;">Kisan Alert AI</h2>
                        <p style="color: #64748b; font-size: 12px; margin: 5px 0 0;">National Agricultural Intelligence Portal</p>
                    </div>
                    <div style="border-top: 1px solid #1e293b; border-bottom: 1px solid #1e293b; padding: 25px 0; margin-bottom: 30px; text-align: center;">
                        <p style="color: #94a3b8; font-size: 14px; margin: 0 0 15px;">Your secure verification code is:</p>
                        <div style="background-color: #020617; border: 1px solid #334155; padding: 15px; border-radius: 12px; font-size: 28px; font-family: monospace; font-weight: 900; color: #34d399; letter-spacing: 6px; display: inline-block;">
                            {code}
                        </div>
                        <p style="color: #64748b; font-size: 11px; margin: 15px 0 0;">This code is valid for 5 minutes. Do not share this OTP with anyone.</p>
                    </div>
                    <p style="color: #475569; font-size: 10px; text-align: center; margin: 0;">
                        This is an automated security message. Please do not reply to this email.
                    </p>
                </div>
            </body>
        </html>
        """

        if not self.username or not self.password:
            print("\n" + "="*60)
            print(f"[SMTP MOCK LOG] Verification Email to: {recipient_email}")
            print(f"[SMTP MOCK LOG] Subject: {subject}")
            print(f"[SMTP MOCK LOG] OTP Code: {code}")
            print("="*60 + "\n")
            return True

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = self.username
        msg["To"]      = recipient_email
        msg.attach(MIMEText(html_content, "html"))
        return self._send(msg, recipient_email)

    # ─────────────────────────────────────────────────────────────────────────
    # System alert emails — outbreak / weather / expert warnings
    # ─────────────────────────────────────────────────────────────────────────

    def send_alert_notification(
        self,
        *,
        alert_type: str,
        title: str,
        message: str,
        severity: str = "HIGH",
        location: str = "",
        recipient_email: str = "",
        extra_html: str = "",
    ) -> bool:
        """
        Sends a rich HTML system-alert email via Gmail SMTP.

        Args:
            alert_type:       One of OUTBREAK_WARNING, WEATHER_ALERT, DRY_SPELL,
                              EXPERT_OUTBREAK_REGISTERED, SYSTEM, etc.
            title:            Short alert headline.
            message:          Full alert body text.
            severity:         CRITICAL | HIGH | INFO — drives accent colour.
            location:         Optional location string shown in the card.
            recipient_email:  Override to; falls back to settings.ALERT_EMAIL_RECIPIENT.
            extra_html:       Optional additional HTML content block injected below the message.
        """
        to_addr = recipient_email or settings.ALERT_EMAIL_RECIPIENT
        if not to_addr:
            print("[EmailService] ALERT_EMAIL_RECIPIENT not configured — skipping alert email.")
            return False

        color   = _SEVERITY_COLORS.get(severity, "#3b82f6")
        emoji   = _TYPE_EMOJI.get(alert_type, "📣")
        subject = f"{emoji} Farm Fit Alert: {title}"

        location_row = ""
        if location:
            location_row = f"""
            <tr>
              <td style="padding: 8px 0; color: #94a3b8; font-size: 12px; border-bottom: 1px solid #1e293b;">📍 Location</td>
              <td style="padding: 8px 0; color: #e2e8f0; font-size: 12px; border-bottom: 1px solid #1e293b;">{location}</td>
            </tr>"""

        html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#020617;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#020617;padding:30px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border:1px solid #1e293b;border-radius:16px;overflow:hidden;max-width:560px;">

          <!-- Header stripe -->
          <tr>
            <td style="background-color:{color};padding:6px 0;"></td>
          </tr>

          <!-- Logo row -->
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:1px solid #1e293b;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:28px;">{emoji}</span>
                    <span style="display:inline-block;vertical-align:middle;margin-left:10px;">
                      <strong style="font-size:18px;color:#f1f5f9;font-weight:800;">Kisan Alert AI</strong><br>
                      <span style="font-size:11px;color:#64748b;">RSK Intelligence &amp; Alert Platform</span>
                    </span>
                  </td>
                  <td align="right">
                    <span style="background-color:{color}22;border:1px solid {color}55;color:{color};
                                 font-size:10px;font-weight:700;padding:4px 10px;border-radius:20px;
                                 letter-spacing:0.5px;text-transform:uppercase;">{severity}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding:24px 32px 12px;">
              <h1 style="margin:0;font-size:20px;font-weight:800;color:#f1f5f9;line-height:1.3;">{title}</h1>
              <span style="display:inline-block;margin-top:8px;font-size:10px;color:#64748b;
                           text-transform:uppercase;letter-spacing:0.8px;">{alert_type.replace("_"," ")}</span>
            </td>
          </tr>

          <!-- Message body -->
          <tr>
            <td style="padding:0 32px 20px;">
              <p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.7;">{message}</p>
            </td>
          </tr>

          <!-- Details table -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background-color:#0a1628;border:1px solid #1e293b;border-radius:10px;padding:12px 16px;">
                <tbody>
                  {location_row}
                  <tr>
                    <td style="padding:8px 0;color:#94a3b8;font-size:12px;border-bottom:1px solid #1e293b;">🕐 Alert Time</td>
                    <td style="padding:8px 0;color:#e2e8f0;font-size:12px;border-bottom:1px solid #1e293b;"
                        id="alert-time">Auto-generated</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#94a3b8;font-size:12px;">📊 Platform</td>
                    <td style="padding:8px 0;color:#e2e8f0;font-size:12px;">Farm Fit — RSK Dashboard</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {f'<!-- Extra content --><tr><td style="padding:0 32px 24px;">{extra_html}</td></tr>' if extra_html else ""}

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 28px;">
              <a href="http://localhost:3000/notifications"
                 style="display:inline-block;background-color:{color};color:#fff;font-weight:700;
                        font-size:13px;padding:12px 24px;border-radius:10px;text-decoration:none;">
                View Alert Dashboard →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #1e293b;background-color:#080f1e;">
              <p style="margin:0;font-size:10px;color:#334155;text-align:center;">
                This is an automated system alert from Farm Fit. Do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

        if not self.username or not self.password:
            print("\n" + "="*60)
            print(f"[SMTP MOCK LOG] Alert Email to: {to_addr}")
            print(f"[SMTP MOCK LOG] Subject: {subject}")
            print(f"[SMTP MOCK LOG] Type: {alert_type} | Severity: {severity}")
            print(f"[SMTP MOCK LOG] Message: {message[:120]}")
            print("="*60 + "\n")
            return True

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"Farm Fit Alerts <{self.username}>"
        msg["To"]      = to_addr
        msg.attach(MIMEText(html_content, "html"))
        return self._send(msg, to_addr)
