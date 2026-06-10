// functions/api/_agb.js
// Server-side wrapper around the shared public AGB source.
// Frontend pages import the other AGB exports straight from public/agb-content.js;
// only these three helpers are consumed server-side (course confirmation +
// session schedule emails).

export {
  getCancellationPolicy,
  getGroupCancellationPolicy,
  renderAgbEmailHtml,
} from '../../public/agb-content.js';
