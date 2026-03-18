# FERPA Compliance — ChampionTrackPro
**Last reviewed: March 2026**
**Status: Compliant by design**

## Legal Basis
ChampionTrackPro operates under FERPA (20 U.S.C. § 1232g) as a
School Official with a legitimate educational interest.
Per 34 CFR § 99.31(a)(1), authorized vendors with direct control
over educational records under the institution's supervision are
permitted to access student data without individual consent.

## Data Collected
- Daily wellness self-reports (1-100 slider scales)
- Session type and timing
- Anonymous readiness scores
- Friction and psychological load indicators

## What We Do NOT Collect
- Academic grades or GPA
- Medical diagnoses or prescriptions
- Social Security numbers
- Financial information
- Personally identifiable information beyond name and email

## Data Minimization (FERPA § 99.34)
- Athletes only see their own data
- Coaches only see their own team's data
- Aggregated team data never identifies individual athletes to outsiders
- Admins access is logged and role-restricted

## Data Retention
- Active responses: retained for duration of team membership
- On account deletion: personal data anonymized within 24h via
  `anonymizePlayerDataForAI` Cloud Function (GDPR-style FERPA compliance)
- Anonymized aggregated data may be retained for research

## Security Measures (FERPA Safeguard requirement)
- All data encrypted in transit (HTTPS/TLS 1.3 enforced by Vercel)
- All data encrypted at rest (Firebase default AES-256)
- Role-based access control enforced at database level (Firestore Rules)
- No data shared with third parties without institutional consent
- Audit trail available via Firebase console logs
- App Check protects against unauthorized API access

## Student Rights Under FERPA
Athletes have the right to:
1. Access their own wellness data (available via athlete profile)
2. Request correction of inaccurate data (contact team admin)
3. Request deletion of their data (account deletion triggers anonymization)

## Institutional Agreement Requirements
Before onboarding any NCAA institution, ChampionTrackPro requires:
- A signed Data Processing Agreement (DPA)
- Designation as School Official in the institution's FERPA policy
- Written confirmation that athletes have been informed of data collection

## Contact for FERPA Requests
ferpa@championtrackpro.com (to be configured)

## Changelog
- March 2026: Initial FERPA compliance framework established
- GDPR anonymization CF verified as FERPA-compatible
- Firestore security rules audited and FERPA-compliant access controls confirmed
