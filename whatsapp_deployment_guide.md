# ROVA Meta WhatsApp Bot — Complete Production Deployment Guide

This guide outlines the complete setup for running the **ROVA WhatsApp AI Bot** in live production mode following Meta App Approval.

---

## 1. Meta Developer Console Configuration

1. Log in to the [Meta for Developers Console](https://developers.facebook.com/).
2. Select your approved **ROVA App**.
3. Under **WhatsApp** → **Configuration**:
   - **Callback URL**: `https://qlwqktnziuqeosbnhnls.supabase.co/functions/v1/whatsapp-webhook`
   - **Verify Token**: `rova-whatsapp-webhook-2026`
   - Click **Verify and Save**.

4. Under **Webhook Fields**, subscribe to:
   - `messages` (Mandatory for receiving text, voice notes, and receipt images)
   - `message_template_status_update` (Optional)

---

## 2. WhatsApp Business Phone & Permanent Access Token

1. Go to **WhatsApp** → **API Setup**.
2. Note down your **Phone Number ID**: `1168220643050432` and **WhatsApp Business Account ID**: `1367279925558995`.
3. Direct Bot Link: `https://wa.me/2349132957881`
4. To generate a **Permanent System User Access Token** (never expires):
   - Go to **Business Settings** → **Users** → **System Users**.
   - Create or select a System User with `Admin` role.
   - Click **Generate Token**, select your ROVA App, and enable permissions:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
   - Copy the generated access token.

---

## 3. Supabase Edge Function Environment Variables

Set the following secrets in Supabase (via Supabase CLI or Dashboard → Project Settings → Edge Functions → Secrets):

```bash
supabase secrets set WHATSAPP_VERIFY_TOKEN="rova-whatsapp-webhook-2026"
supabase secrets set WHATSAPP_PHONE_NUMBER_ID="1168220643050432"
supabase secrets set WHATSAPP_BUSINESS_ACCOUNT_ID="1367279925558995"
supabase secrets set WHATSAPP_ACCESS_TOKEN="<PERMANENT_SYSTEM_USER_ACCESS_TOKEN>"
supabase secrets set OPENAI_API_KEY="<YOUR_OPENAI_KEY>" # For Whisper Voice STT & Vision OCR
supabase secrets set DEEPSEEK_API_KEY="<YOUR_DEEPSEEK_KEY>" # For Accounting Engine Intent Classification
```

---

## 4. User Onboarding & WhatsApp Phone Linking

1. Users sign up or log in at `https://www.rovabusiness.com`.
2. Go to **Settings** → **WhatsApp Bot** tab (or **Business Details**).
3. Enter their phone number (e.g. `+2348012345678` or `08012345678`).
4. Click **Launch ROVA Bot on WhatsApp** or send a message directly to the registered ROVA WhatsApp number.

---

## 5. Live Testing Checklist

| Test Type | Input Example | Expected Outcome |
| :--- | :--- | :--- |
| **Text Expense** | *"Spent ₦15,000 on fuel at Mobil"* | Bot responds with `✅ Transaction Recorded by ROVA AI` with category and journal entries. |
| **Voice Note** | Send 5s voice note *"Bought 10 bags of cement for 45,000 Naira"* | Bot transcribes via Whisper API and records inventory/expense. |
| **Receipt Photo** | Photo of purchase receipt | Bot transcribes receipt via OCR and inputs transaction details into ROVA. |
| **Unknown Number** | Message from unlinked phone | Bot responds with warning asking user to add number in ROVA Settings. |

---

## 6. Standalone Node Pipeline Alternative (BullMQ + Redis)

If using the standalone `whatsapp-transaction-pipeline` service on Render/Railway/DigitalOcean:
- Update `whatsapp-transaction-pipeline/.env` with your production tokens.
- Deploy using the provided `Dockerfile` or `render.yaml`.
- Set Meta Webhook URL to: `https://your-pipeline-domain.com/webhook/whatsapp`

---

*ROVA WhatsApp AI Assistant — Ready for Production Operations!*
