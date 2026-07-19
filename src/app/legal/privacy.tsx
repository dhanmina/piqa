/**
 * /legal/privacy — Privacy Policy, rendered in-app. Prose lives here as data;
 * LegalDoc owns all the styling.
 *
 * NOTE: starter text describing the data Piqa handles today (Supabase auth, photo
 * storage, push tokens, profile). Before public launch, have counsel review it,
 * fill the [BRACKETED] placeholders, and confirm it matches your actual data
 * processors. Bump EFFECTIVE_DATE on material changes.
 */
import { LegalDoc, type LegalBlock } from '@/components/molecules/LegalDoc';

const EFFECTIVE_DATE = '19 July 2026';

const BLOCKS: LegalBlock[] = [
  {
    p: 'This Privacy Policy explains what information Piqa ("we", "us"), operated by [LEGAL ENTITY], collects when you use the Piqa app, how we use it, and the choices you have. By using Piqa you agree to this policy.',
  },

  { h: 'Information you give us' },
  {
    li: [
      'Account details: your email address, username, and password (stored securely by our authentication provider).',
      'Profile: your display name, avatar, and any profile details you add.',
      'Your content: the photos you shoot and post, and actions like votes, follows, and comments.',
    ],
  },

  { h: 'Information collected automatically' },
  {
    li: [
      'Device and app data needed to run the Service, such as your device type and app version.',
      'A push notification token, if you enable notifications, so we can deliver them.',
      'Basic diagnostic and usage information to keep the app stable and improve it.',
    ],
  },

  { h: 'Camera and photos' },
  {
    p: 'Piqa uses your camera only when you choose to shoot, and photo-library access only if you pick an image for your profile. Photos are captured in the app and uploaded to our storage so they can appear in the gallery, the daily competition, and on your profile. We do not access your camera or library in the background.',
  },

  { h: 'How we use your information' },
  {
    li: [
      'To provide and operate the Service — accounts, posting, the competition, following, and profiles.',
      'To send notifications you have enabled.',
      'To keep Piqa safe: preventing abuse, enforcing our Terms, and moderating content.',
      'To fix problems and improve features.',
      'To comply with legal obligations.',
    ],
  },

  { h: 'How your information is shared' },
  {
    p: 'Your profile, username, avatar, and the photos you post are visible to other people using Piqa — that is the point of the app. Beyond that, we do not sell your personal information. We share data only with service providers who help us run Piqa (for example, cloud hosting, database, storage, authentication, and push delivery), and only as needed to provide the Service, or when required by law.',
  },

  { h: 'Data storage and security' },
  {
    p: 'Your data is stored with our infrastructure providers and protected with reasonable technical and organizational measures. No method of transmission or storage is completely secure, but we work to safeguard your information and to limit access to it.',
  },

  { h: 'Your choices and rights' },
  {
    li: [
      'You can edit your profile and manage notifications at any time in Settings.',
      'You can delete your account from Settings; this permanently removes your account, your photos, and your stats, subject to any retention the law requires.',
      'Depending on where you live, you may have rights to access, correct, export, or delete your personal data. To make a request, email hello@joinpiqa.com.',
    ],
  },

  { h: 'Children' },
  {
    p: 'Piqa is not intended for children under 13 (or the minimum age of digital consent in your country). We do not knowingly collect personal information from children below that age. If you believe a child has given us personal information, contact us and we will delete it.',
  },

  { h: 'Changes to this policy' },
  {
    p: 'We may update this policy as Piqa evolves. When we make material changes we will update the effective date above and, where appropriate, notify you in the app.',
  },

  { h: 'Contact' },
  {
    p: 'Questions about your privacy or this policy? Email us at hello@joinpiqa.com.',
  },
];

export default function PrivacyScreen() {
  return <LegalDoc title="Privacy Policy" effectiveDate={EFFECTIVE_DATE} blocks={BLOCKS} />;
}
