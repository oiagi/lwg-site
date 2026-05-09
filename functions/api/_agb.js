// functions/api/_agb.js
// Server-side wrapper around the shared public AGB source.

export {
  AGB_CONSENT_HTML,
  AGB_LINK_LABEL,
  AGB_PATH,
  AGB_SECTIONS,
  AGB_UPDATED,
  CANCELLATION_POLICY_BY_LANGUAGE,
  GROUP_CANCELLATION_POLICY_BY_LANGUAGE,
  getCancellationPolicy,
  getGroupCancellationPolicy,
  renderAgbEmailHtml,
  renderAgbLegalHtml,
} from '../../public/agb-content.js';

export { CANCELLATION_POLICY_BY_LANGUAGE as CANCELLATION_POLICIES } from '../../public/agb-content.js';

import { CANCELLATION_POLICY_BY_LANGUAGE, renderAgbEmailHtml } from '../../public/agb-content.js';

export const CANCELLATION_POLICY = CANCELLATION_POLICY_BY_LANGUAGE.de;
export const AGB_HTML = renderAgbEmailHtml('de');
export const AGB_HTML_BY_LANGUAGE = {
  de: renderAgbEmailHtml('de'),
  en: renderAgbEmailHtml('en'),
};
