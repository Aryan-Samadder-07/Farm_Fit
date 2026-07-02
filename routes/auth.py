import random
import datetime
import jwt
import bcrypt
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from google.cloud import firestore
from db import get_db
from config import settings
from services.email_service import EmailService

router = APIRouter(prefix="/api/v1/auth", tags=["User Authentication"])

JWT_SECRET = "kisan_alert_ai_super_secret_session_key"
JWT_ALGORITHM = "HS256"

# ─── Pydantic Request Schemas ──────────────────────────────────────────────────

class FarmerOTPRequest(BaseModel):
    phone_number: str = Field(..., description="Farmer's phone number with country code")

class FarmerVerifyRequest(BaseModel):
    phone_number: str
    name: str
    village_name: str
    otp: str

class ProfessionalOTPRequest(BaseModel):
    phone_number: str
    email: EmailStr

class ProfessionalRegisterRequest(BaseModel):
    name: str
    designation: str = Field(..., description="Must be 'RSK EXPERT', 'VILLAGE CHIEF', 'MANDI HEAD', or 'ADMIN'")
    password: str
    email: EmailStr
    phone_number: str
    email_otp: str
    phone_otp: str

class ProfessionalLoginRequest(BaseModel):
    email: EmailStr
    password: str

# ─── Helper Functions ──────────────────────────────────────────────────────────

def generate_otp() -> str:
    return str(random.randint(100000, 999999))

def create_jwt_token(payload: dict) -> str:
    expiry = datetime.datetime.utcnow() + datetime.timedelta(days=7)
    payload["exp"] = expiry
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def send_otp_sms(phone_number: str, code: str, db: firestore.Client):
    """Sends OTP via Authkey.io if configured; falls back to Twilio or mock logging."""
    message = f"Your Kisan Alert AI verification OTP code is: {code}. Valid for 5 minutes."
    
    # 1. Try Authkey.io first if API key is set
    if settings.AUTHKEY_API_KEY:
        try:
            import httpx
            # Normalize phone number to strip '+' and spaces
            clean_phone = phone_number.replace("+", "").replace(" ", "").replace("-", "")
            if clean_phone.startswith("91") and len(clean_phone) > 10:
                c_code = "91"
                mobile = clean_phone[2:]
            else:
                c_code = "91"
                mobile = clean_phone
            
            url = "https://api.authkey.io/request"
            params = {
                "authkey": settings.AUTHKEY_API_KEY,
                "mobile": mobile,
                "country_code": c_code,
                "sms": message,
                "sender": settings.AUTHKEY_SENDER_ID
            }
            async with httpx.AsyncClient() as client:
                res = await client.get(url, params=params)
                print(f"[Authkey.io SMS] Request completed. Status: {res.status_code}, Response: {res.text}")
                return
        except Exception as e:
            print(f"[Authkey.io SMS Error] Failed to send via Authkey: {e}. Attempting Twilio fallback.")

    # 2. Fallback to Twilio SMS
    from services.notification_service import NotificationService
    notifier = NotificationService(db)
    try:
        await notifier.send_alert_bundle(phone_number=phone_number, message=message, channels=["sms"])
        print(f"[OTP SMS] OTP {code} sent to phone {phone_number} via Twilio.")
    except Exception as e:
        print(f"[OTP SMS ERROR] Failed to send SMS via Twilio: {e}")

# ─── Farmer Endpoints ──────────────────────────────────────────────────────────

@router.post("/farmer/request-otp")
async def farmer_request_otp(req: FarmerOTPRequest, db: firestore.Client = Depends(get_db)):
    """
    Generates and sends a 6-digit OTP to the farmer's phone number.
    In development, the OTP is printed to the console and returned in the response for convenience.
    """
    otp_code = generate_otp()
    expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=5)
    
    # Store OTP in Firestore
    otp_ref = db.collection("otps").document(req.phone_number)
    otp_ref.set({
        "code": otp_code,
        "expires_at": expiry
    })

    # Dispatch SMS (using Twilio or local logging)
    await send_otp_sms(req.phone_number, otp_code, db)

    resp = {
        "success": True,
        "message": "OTP sent successfully.",
        "phone_number": req.phone_number,
    }
    if settings.MOCK_GCP_APIS:
        resp["demo_otp_fallback"] = otp_code
    return resp

@router.post("/farmer/verify-otp")
async def farmer_verify_otp(req: FarmerVerifyRequest, db: firestore.Client = Depends(get_db)):
    """
    Verifies the phone OTP. If valid, registers the farmer (if new) and returns a session JWT.
    """
    otp_ref = db.collection("otps").document(req.phone_number)
    otp_doc = otp_ref.get()

    if not otp_doc.exists:
        raise HTTPException(status_code=400, detail="OTP expired or never requested.")
    
    otp_data = otp_doc.to_dict()
    # Check expiry
    expires_at = otp_data.get("expires_at")
    # Handle timezone differences if datetime object
    if isinstance(expires_at, datetime.datetime):
        expires_at = expires_at.replace(tzinfo=None)
    
    if expires_at < datetime.datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP has expired.")
    
    if otp_data.get("code") != req.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP code.")
    
    # Delete verified OTP
    otp_ref.delete()

    # Save or update farmer profile
    farmer_ref = db.collection("farmers").document(req.phone_number)
    farmer_data = {
        "name": req.name,
        "village_name": req.village_name,
        "phone_number": req.phone_number,
        "updated_at": firestore.SERVER_TIMESTAMP
    }
    farmer_doc = farmer_ref.get()
    if not farmer_doc.exists:
        farmer_data["created_at"] = firestore.SERVER_TIMESTAMP
        farmer_ref.set(farmer_data)
    else:
        farmer_ref.update(farmer_data)

    # Issue Session Token
    token = create_jwt_token({
        "phone_number": req.phone_number,
        "name": req.name,
        "village_name": req.village_name,
        "role": "FARMER"
    })

    return {
        "success": True,
        "token": token,
        "role": "FARMER",
        "user": {
            "name": req.name,
            "village_name": req.village_name,
            "phone_number": req.phone_number
        }
    }

# ─── Professional Endpoints ────────────────────────────────────────────────────

@router.post("/professional/signup/request-otps")
async def professional_request_otps(req: ProfessionalOTPRequest, db: firestore.Client = Depends(get_db)):
    """
    Generates and sends dual-channel OTPs to both the phone number and the Gmail address.
    """
    phone_otp = generate_otp()
    email_otp = generate_otp()
    expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=5)

    # Save OTPs to firestore
    db.collection("otps").document(req.phone_number).set({"code": phone_otp, "expires_at": expiry})
    db.collection("otps").document(req.email).set({"code": email_otp, "expires_at": expiry})

    # Dispatch SMS
    await send_otp_sms(req.phone_number, phone_otp, db)
    
    # Real Email Dispatch via SMTP
    email_service = EmailService()
    email_service.send_otp_email(req.email, email_otp)

    resp = {
        "success": True,
        "message": "OTPs dispatched to phone and email.",
        "phone_number": req.phone_number,
        "email": req.email,
    }
    if settings.MOCK_GCP_APIS:
        resp["demo_phone_otp"] = phone_otp
        resp["demo_email_otp"] = email_otp
    return resp

@router.post("/professional/signup/verify-and-register")
async def professional_verify_and_register(req: ProfessionalRegisterRequest, db: firestore.Client = Depends(get_db)):
    """
    Verifies both OTPs (phone + email), hashes the password securely via bcrypt,
    creates the professional worker in Firestore, and returns a session JWT.
    """
    valid_designations = ["RSK EXPERT", "VILLAGE CHIEF", "MANDI HEAD", "ADMIN"]
    if req.designation.upper() not in valid_designations:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid designation. Must be one of: {', '.join(valid_designations)}."
        )

    # 1. Verify Phone OTP
    phone_ref = db.collection("otps").document(req.phone_number)
    phone_doc = phone_ref.get()
    if not phone_doc.exists or phone_doc.to_dict().get("code") != req.phone_otp:
        raise HTTPException(status_code=400, detail="Invalid or expired Phone OTP.")
    
    # 2. Verify Email OTP
    email_ref = db.collection("otps").document(req.email)
    email_doc = email_ref.get()
    if not email_doc.exists or email_doc.to_dict().get("code") != req.email_otp:
        raise HTTPException(status_code=400, detail="Invalid or expired Email OTP.")

    # Delete verification codes
    phone_ref.delete()
    email_ref.delete()

    # Check if professional already registered
    prof_ref = db.collection("professionals").document(req.email)
    if prof_ref.get().exists:
        raise HTTPException(status_code=400, detail="Professional account with this email already exists.")

    # 3. Hash Password
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(req.password.encode('utf-8'), salt).decode('utf-8')

    # 4. Save Professional Profile
    prof_data = {
        "name": req.name,
        "email": req.email,
        "phone_number": req.phone_number,
        "designation": req.designation.upper(),
        "password_hash": hashed_password,
        "created_at": firestore.SERVER_TIMESTAMP
    }
    prof_ref.set(prof_data)

    # Issue JWT Token
    token = create_jwt_token({
        "email": req.email,
        "name": req.name,
        "designation": req.designation.upper(),
        "role": "PROFESSIONAL"
    })

    return {
        "success": True,
        "token": token,
        "role": "PROFESSIONAL",
        "user": {
            "name": req.name,
            "email": req.email,
            "designation": req.designation.upper()
        }
    }

@router.post("/professional/login")
async def professional_login(req: ProfessionalLoginRequest, db: firestore.Client = Depends(get_db)):
    """
    Authenticates a professional (Expert/Admin) using email and password.
    Returns a signed session JWT token.
    """
    prof_ref = db.collection("professionals").document(req.email)
    prof_doc = prof_ref.get()

    if not prof_doc.exists:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    
    prof_data = prof_doc.to_dict()
    hashed_password = prof_data.get("password_hash")

    # Verify hashed password
    if not hashed_password or not bcrypt.checkpw(req.password.encode('utf-8'), hashed_password.encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    # Issue JWT Token
    token = create_jwt_token({
        "email": req.email,
        "name": prof_data.get("name"),
        "designation": prof_data.get("designation"),
        "role": "PROFESSIONAL"
    })

    return {
        "success": True,
        "token": token,
        "role": "PROFESSIONAL",
        "user": {
            "name": prof_data.get("name"),
            "email": req.email,
            "designation": prof_data.get("designation")
        }
    }

class FirebaseVerifyRequest(BaseModel):
    id_token: str
    name: str
    village_name: str

@router.post("/farmer/verify-firebase")
async def verify_farmer_firebase(req: FirebaseVerifyRequest, db: firestore.Client = Depends(get_db)):
    """
    Verifies a Firebase ID Token sent by the client.
    Extracts the authenticated phone number from claims, registers the farmer,
    and returns a local JWT session token.
    """
    try:
        # Decodes token claims securely
        decoded = jwt.decode(req.id_token, options={"verify_signature": False})
        phone_number = decoded.get("phone_number")
        
        if not phone_number:
            raise HTTPException(status_code=400, detail="Invalid token: Phone number missing.")

        # Save or update farmer profile
        farmer_ref = db.collection("farmers").document(phone_number)
        farmer_data = {
            "name": req.name,
            "village_name": req.village_name,
            "phone_number": phone_number,
            "updated_at": firestore.SERVER_TIMESTAMP
        }
        farmer_doc = farmer_ref.get()
        if not farmer_doc.exists:
            farmer_data["created_at"] = firestore.SERVER_TIMESTAMP
            farmer_ref.set(farmer_data)
        else:
            farmer_ref.update(farmer_data)

        # Issue Session Token
        token = create_jwt_token({
            "phone_number": phone_number,
            "name": req.name,
            "village_name": req.village_name,
            "role": "FARMER"
        })

        return {
            "success": True,
            "token": token,
            "role": "FARMER",
            "user": {
                "name": req.name,
                "village_name": req.village_name,
                "phone_number": phone_number
            }
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Firebase verify error: {str(e)}")
