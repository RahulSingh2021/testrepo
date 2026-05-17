# WhatsApp Business API — Setup Guide

This guide walks you through connecting your WhatsApp Business number (+918239008202) to the HACCP PRO LMS using the Meta Cloud API (free per-message).

---

## Step 1 — Create a Meta Developer Account

1. Go to [https://developers.facebook.com](https://developers.facebook.com)
2. Log in with your Facebook/Meta account (or create one).
3. Click **Get Started** and complete the developer registration.

---

## Step 2 — Create a Meta App

1. Go to **My Apps → Create App**
2. Select app type: **Business**
3. Give it a name (e.g. "HACCP PRO Messaging") and enter your email.
4. Click **Create App**.

---

## Step 3 — Add WhatsApp Product

1. On your app dashboard, find **WhatsApp** in the product list and click **Set Up**.
2. You'll be taken to the WhatsApp Getting Started page.
3. Create or connect a **Meta Business Account** (your real business account).

---

## Step 4 — Add Your Phone Number (+918239008202)

1. In the WhatsApp section, go to **Phone Numbers**.
2. Click **Add Phone Number**.
3. Enter `+918239008202` and verify via OTP (sent to the number).
4. Once verified, note down the **Phone Number ID** shown on the page (looks like `123456789012345`). You'll need it later.

> ⚠️ **Important:** Your number must NOT already be registered as a personal WhatsApp or WhatsApp Business App account. If it is, you must first delete it from the WhatsApp/WhatsApp Business app before registering it with the Cloud API.

---

## Step 5 — Get a Permanent Access Token

1. Go to **Meta Business Suite → Settings → System Users** ([business.facebook.com/settings/system-users](https://business.facebook.com/settings/system-users))
2. Click **Add** → create a **System User** with **Admin** role.
3. Click **Generate Token** for that system user.
4. Select your app and grant these permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. Set token expiry to **Never**.
6. Copy the generated token — this is your **WHATSAPP_ACCESS_TOKEN**.

---

## Step 6 — Add Secrets to Replit

In Replit, go to **Secrets** (lock icon in sidebar) and add:

| Secret Name | Value |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | The system user token from Step 5 |
| `WHATSAPP_PHONE_NUMBER_ID` | The Phone Number ID from Step 4 |

---

## Step 7 — Submit Message Templates

WhatsApp requires pre-approved templates for all proactive messages. Go to:
**Meta Business Suite → WhatsApp → Message Templates → Create Template**

Submit all 4 templates below. They typically take **1–3 business days** to approve.

### Template 1 — `haccp_free_registration_confirmed`
- **Category:** Utility
- **Language:** English
- **Body:**
```
Hi {{1}}, your registration for *{{2}}* is confirmed! 🎉

📅 Date: {{3}}
⏰ Time: {{4}}
📍 Mode: {{5}}

We look forward to seeing you. For any queries, reply to this message or call +918239008202.

🎁 Your referral code: *{{6}}*
Friends save ₹{{7}}, you earn ₹{{8}} per referral — share it with colleagues!
```
> Note: All 8 placeholders are always sent. When no Refer & Earn coupon is configured for the session, {{6}}, {{7}}, {{8}} are automatically filled with "—" so the template structure stays valid and consistent.

---

### Template 2 — `haccp_payment_pending`
- **Category:** Utility
- **Language:** English
- **Body:**
```
Hi {{1}}, we've received your registration for *{{2}}*. ✅

Your payment (UTR: {{3}}) is under verification. Once confirmed, you'll receive a WhatsApp message and email with your seat confirmation.

For help: +918239008202 or safefoodmitra@gmail.com
```

---

### Template 3 — `haccp_payment_verified` *(legacy — superseded by 3b)*
- **Category:** Utility
- **Language:** English
- **Body:**
```
Hi {{1}}, great news! Your payment has been verified. 🎉

Your seat for *{{2}}* on {{3}} is confirmed.

Your Refer & Earn code: *{{4}}*
Share it with friends to earn commissions on future sessions!

See you at the training! Contact: +918239008202
```
> Note: {{4}} = the registrant's Refer & Earn coupon code, or "—" when no coupon is configured for the session.

---

### Template 3b — `haccp_training_referral_confirmed` *(currently used on payment verification)*
- **Category:** Utility
- **Language:** English
- **Body:**
```
Dear {{1}},

Thank you for registering in our training course.

Your training participation reference details are provided below:

🎟️ Referral Code: {{2}}

📌 Training Details:
{{3}}

This referral code may be used during future training registrations or shared for training reference purposes.

📞 Phone: +91 8239 00 8202
📧 Email: safefoodmitra@gmail.com
```
> Variables:
> - **{{1}}** = registrant name
> - **{{2}}** = personal Refer & Earn code (or "—" when none)
> - **{{3}}** = multi-line training details block (✅ topic / 📅 date / 🕒 time / 👤 trainer)

---

### Template 4 — `haccp_coupon_earned`
- **Category:** Utility
- **Language:** English
- **Body:**
```
Hi {{1}}, someone just used your referral code! 🎉

*{{2}}* registered for *{{3}}* using your code.

💰 You earned: ₹{{4}}
🔢 Uses remaining on your code: {{5}}

Keep sharing to earn more! Contact: +918239008202
```

---

### Template 5 — `haccp_referral_usage_digest` *(bulk WhatsApp blast to 2-codes-only owners)*

Used by **LMS Admin → Referral Digest** button.
Sent only to recipients with **EXACTLY 2 valid referral codes** (active, non-expired, with remaining usage).

- **Category:** Utility
- **Header:** None
- **Footer:** None
- **Buttons:** None
- **Body** (10 vars):

```
Dear {{1}},

Here are your referral code usage details:

🎟️ Code: {{2}}
📊 Used Count: {{3}}
📌 Remaining Valid Usage: {{4}}
📅 Expiry Date: {{5}}

🎟️ Code: {{6}}
📊 Used Count: {{7}}
📌 Remaining Valid Usage: {{8}}
📅 Expiry Date: {{9}}

📘 Training Details:
{{10}}

These referral codes may be used during future training registrations or shared for training reference purposes.

📞 Phone: +91 8239 00 8202
📧 Email: safefoodmitra@gmail.com

Thank you!
SafeFood Mitra
```

Sample variable values for Meta review:

| Var | Sample |
|---|---|
| `{{1}}` | `Rohit Sharma` |
| `{{2}}` | `ROHIT2025` |
| `{{3}}` | `5` |
| `{{4}}` | `45` |
| `{{5}}` | `31 Dec 2026` |
| `{{6}}` | `ROHIT2026` |
| `{{7}}` | `2` |
| `{{8}}` | `48` |
| `{{9}}` | `30 Jun 2027` |
| `{{10}}` | (multi-line training cards block — paste 2 sample cards) |

---

## Step 8 — Test It

Once templates are approved and secrets are set:

1. Register for any training session on the app.
2. Check the Replit logs — you should see `[WhatsApp] Sent "haccp_free_registration_confirmed" to 91XXXXXXXXXX`.
3. The registered mobile number should receive the WhatsApp message within seconds.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Logs show "Skipping send — credentials not set" | WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID secret is missing or misspelled |
| Error: `template not found` | Template hasn't been approved yet, or template name is misspelled |
| Error: `131030` (template rejected) | Template text doesn't match exactly what was approved — check for extra spaces or different variable count |
| Error: `131026` (invalid phone number) | Number is not on WhatsApp, or is in wrong format |
| Token expired errors | System User token was set with an expiry — regenerate with "Never" expiry |

---

## Meta Developer Console Links

- App Dashboard: [developers.facebook.com/apps](https://developers.facebook.com/apps)
- WhatsApp API Docs: [developers.facebook.com/docs/whatsapp/cloud-api](https://developers.facebook.com/docs/whatsapp/cloud-api)
- Template Manager: [business.facebook.com/wa/manage/message-templates](https://business.facebook.com/wa/manage/message-templates)
- System Users: [business.facebook.com/settings/system-users](https://business.facebook.com/settings/system-users)
