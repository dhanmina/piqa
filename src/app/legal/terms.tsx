/**
 * /legal/terms — Terms of Service, rendered in-app so it works offline and needs
 * no web dependency. Prose lives here as data; LegalDoc owns all the styling.
 *
 * NOTE: starter text tailored to what piqa does today. Before public launch, have
 * counsel review it and fill the [BRACKETED] placeholders (legal entity, governing
 * law). Bump EFFECTIVE_DATE whenever the terms materially change.
 */
import { LegalDoc, type LegalBlock } from '@/components/molecules/LegalDoc';

const EFFECTIVE_DATE = '19 July 2026';

const BLOCKS: LegalBlock[] = [
  {
    p: 'Welcome to piqa. These Terms of Service ("Terms") are an agreement between you and Dhanrev Mina ("piqa", "we", "us") and govern your use of the piqa mobile app and related services (the "Service"). By creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the Service.',
  },

  { h: 'Who can use piqa' },
  {
    p: 'You must be at least 13 years old (or the minimum age of digital consent in your country, if higher) to use piqa. By using the Service you confirm that you meet this requirement and that the information you give us is accurate.',
  },

  { h: 'Your account' },
  {
    p: 'You are responsible for your account, for keeping access to your email secure, and for everything that happens under your account. Tell us promptly if you believe someone has used your account without permission. You may sign out or delete your account at any time from Settings.',
  },

  { h: 'Your content' },
  {
    p: 'piqa is built around photos you shoot in the app. You keep ownership of the photos and other content you create ("Your Content"). By posting Your Content, you grant piqa a worldwide, non-exclusive, royalty-free license to host, store, display, and distribute it solely to operate and improve the Service — for example, showing your shots in the gallery, in the daily competition, and on your profile. This license ends when you delete the content or your account, except for copies already shared with others or retained as required by law.',
  },
  {
    p: 'You are responsible for Your Content and confirm that you have the right to post it and that it does not infringe anyone else’s rights.',
  },

  { h: 'Rules of the community' },
  { p: 'To keep piqa a place worth showing up to, you agree not to:' },
  {
    li: [
      'Post content that is unlawful, hateful, harassing, sexually explicit, or that depicts or exploits minors.',
      'Post photos you did not shoot in the app, or otherwise misrepresent your work in the competition.',
      'Harass, threaten, impersonate, or invade the privacy of others.',
      'Use bots, scrapers, or automated means to inflate votes, followers, or rankings.',
      'Attempt to break, overload, reverse-engineer, or gain unauthorized access to the Service.',
    ],
  },

  { h: 'Moderation' },
  {
    p: 'We may review, remove, or restrict content and may suspend or terminate accounts that violate these Terms or that harm other people or the Service. Where reasonable we will tell you why, but we may act immediately when needed to protect users or comply with the law.',
  },

  { h: 'The competition and rewards' },
  {
    p: 'piqa includes daily competition, voting, experience points, levels, frames, and similar features. These have no cash value, are for entertainment only, and may change or end at any time. We may reset or adjust standings to correct errors or abuse.',
  },

  { h: 'The Service is provided "as is"' },
  {
    p: 'We work hard to keep piqa running, but the Service is provided "as is" without warranties of any kind. We do not promise it will be uninterrupted, error-free, or that content will always be preserved. To the maximum extent permitted by law, piqa is not liable for indirect, incidental, or consequential damages arising from your use of the Service.',
  },

  { h: 'Changes to these Terms' },
  {
    p: 'We may update these Terms as the Service evolves. When we make material changes we will update the effective date above and, where appropriate, notify you in the app. Continuing to use piqa after changes take effect means you accept the updated Terms.',
  },

  { h: 'Governing law' },
  {
    p: 'These Terms are governed by the laws of [JURISDICTION], without regard to its conflict-of-laws rules.',
  },

  { h: 'Contact' },
  {
    p: 'Questions about these Terms? Email us at hello@joinpiqa.com.',
  },
];

export default function TermsScreen() {
  return <LegalDoc title="Terms of Service" effectiveDate={EFFECTIVE_DATE} blocks={BLOCKS} />;
}
