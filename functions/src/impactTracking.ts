import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {getApps, initializeApp} from 'firebase-admin/app';

// Ensure the Admin SDK is initialized
if (!getApps().length) {
  initializeApp();
}

/**
 * Impact Radius account credentials (Basic-auth account secret, not a rate-limited
 * publishable key). Previously read client-side via `VITE_IMPACT_ACCOUNT_SID` /
 * `VITE_IMPACT_AUTH_TOKEN` in services/groceryCheckoutService.ts, which shipped the
 * token inside the public JS bundle / Android APK — see .claude/audits/FIXES.md F04.
 *
 * Held here as a plain functions env var (not Secret Manager - avoids per-secret
 * billing) instead of the old client-bundled VITE_* var. One-time setup (after
 * rotating the leaked value in the Impact Radius dashboard): add to
 * functions/.env (gitignored, never committed):
 *   IMPACT_ACCOUNT_SID=...
 *   IMPACT_AUTH_TOKEN=...
 */

type Merchant = 'walmart' | 'target' | 'kroger' | 'instacart' | 'albertsons' | 'thrive';

// Impact redirect subdomain per merchant. Kept server-side (rather than trusting a
// client-supplied trackingDomain) so a compromised/old client build can't be used to
// build a redirect through an arbitrary host.
const TRACKING_DOMAINS: Record<Merchant, string> = {
  walmart: 'goto.walmart.com',
  target: 'target.sjv.io',
  kroger: 'kroger.sjv.io',
  instacart: 'instacart.sjv.io',
  albertsons: 'albertsons.sjv.io',
  thrive: 'thrivemarket.pxf.io',
};

const DEFAULT_PUBLISHER_ID = '3624855';

// Campaign/ad IDs and publisher ID are per-merchant Impact catalog identifiers, not
// secrets - they're safe to accept from the caller (same values it previously read
// directly from its own VITE_* env vars), but validated to a conservative charset
// since they get concatenated into the returned URL.
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Wrap a destination merchant URL with the Impact Radius affiliate redirect tracking
 * parameters. Mirrors the logic previously in
 * services/groceryCheckoutService.ts#wrapWithImpactTracker, minus the client-side
 * secret read: the account SID / auth token are never included in the built URL
 * (Impact's public redirect links don't take Basic Auth), they're used purely as the
 * "is affiliate tracking configured for this deployment" gate - but that gate has to
 * live server-side now since the credentials are no longer in the client bundle.
 */
export const wrapImpactTrackingUrl = onCall(
  {
    region: "us-central1",
    enforceAppCheck: true,
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const { destinationUrl, merchant, campaignId, adId, publisherId } = request.data ?? {};

    if (typeof destinationUrl !== 'string' || !/^https:\/\//i.test(destinationUrl)) {
      throw new HttpsError("invalid-argument", "destinationUrl must be an https URL.");
    }

    if (typeof merchant !== 'string' || !(merchant in TRACKING_DOMAINS)) {
      throw new HttpsError("invalid-argument", "Unsupported merchant.");
    }

    try {
      const accountSid = process.env.IMPACT_ACCOUNT_SID;
      const authToken = process.env.IMPACT_AUTH_TOKEN;

      // Fallback: if Impact isn't configured for this deployment, return the
      // destination URL directly (matches prior client-side behavior).
      if (!accountSid || !authToken) {
        return { url: destinationUrl };
      }

      if (
        typeof campaignId !== 'string' || !SAFE_ID_PATTERN.test(campaignId) ||
        typeof adId !== 'string' || !SAFE_ID_PATTERN.test(adId)
      ) {
        // No campaign/ad configured for this merchant - direct link to avoid 403,
        // expired, or malformed link errors on placeholder IDs.
        return { url: destinationUrl };
      }

      const safePublisherId =
        typeof publisherId === 'string' && SAFE_ID_PATTERN.test(publisherId)
          ? publisherId
          : DEFAULT_PUBLISHER_ID;

      const trackingDomain = TRACKING_DOMAINS[merchant as Merchant];
      const encodedUrl = encodeURIComponent(destinationUrl);

      return {
        url: `https://${trackingDomain}/m/${safePublisherId}/${adId}/${campaignId}?veh=aff&sourceid=app&u=${encodedUrl}`,
      };
    } catch (err: any) {
      logger.error('Error in wrapImpactTrackingUrl function', err);
      // Never block a checkout link on tracking-wrapper failure.
      return { url: destinationUrl };
    }
  }
);
