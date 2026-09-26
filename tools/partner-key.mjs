// Issue a partner access key. Give the key to the organisation (once, privately); put only the
// printed PARTNER_KEYS entry into the deployment's environment. usage: node tools/partner-key.mjs <org-slug>
import { createHash, randomBytes } from "node:crypto";
const org = process.argv[2];
if (!org || !/^[a-z0-9-]{3,40}$/.test(org)) { console.error("usage: node tools/partner-key.mjs <org-slug, e.g. mpcb>"); process.exit(1); }
const key = `vl_${org}_${randomBytes(24).toString("base64url")}`;
console.log(`access key for ${org} (share privately, not stored anywhere):\n  ${key}\n`);
console.log(`add to PARTNER_KEYS (comma-separate several):\n  ${org}:${createHash("sha256").update(key).digest("hex")}`);
