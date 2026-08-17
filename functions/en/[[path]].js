import { render } from '../_render.js';

// onRequest, not onRequestGet: HEAD must route here too, or crawlers and uptime
// checks that probe with HEAD get a 404 for a page that serves fine on GET.
export const onRequest = (context) => render(context, 'en');
