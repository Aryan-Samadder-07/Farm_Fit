import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import settings

class EmailService:
    def __init__(self):
        self.host = settings.SMTP_HOST
        self.port = settings.SMTP_PORT
        self.username = settings.SMTP_USERNAME
        self.password = settings.SMTP_PASSWORD

    def send_otp_email(self, recipient_email: str, code: str) -> bool:
        """
        Sends an OTP verification email to the user.
        If SMTP credentials are not configured, it logs the email content to stdout as a fallback.
        """
        subject = "Kisan Alert AI - Secure Verification OTP"
        
        # HTML body matching professional design layout
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

        # Check if credentials are set
        if not self.username or not self.password:
            print("\n" + "="*60)
            print(f"[SMTP MOCK LOG] Verification Email to: {recipient_email}")
            print(f"[SMTP MOCK LOG] Subject: {subject}")
            print(f"[SMTP MOCK LOG] OTP Code: {code}")
            print("="*60 + "\n")
            return True

        try:
            # Build MIME message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = self.username
            msg["To"] = recipient_email
            
            msg.attach(MIMEText(html_content, "html"))

            # Connect using SSL (port 465) or standard SMTP with STARTTLS (port 587)
            if self.port == 465:
                server = smtplib.SMTP_SSL(self.host, self.port)
            else:
                server = smtplib.SMTP(self.host, self.port)
                server.starttls()

            server.login(self.username, self.password)
            server.sendmail(self.username, recipient_email, msg.as_string())
            server.quit()
            
            print(f"[EmailService] Real OTP email sent successfully to {recipient_email}.")
            return True
            
        except Exception as e:
            print(f"[EmailService ERROR] Failed to send real OTP email to {recipient_email}: {e}")
            return False
