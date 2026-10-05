/** Where the browser store (lib/demo.ts) keeps a signed-out visitor's plan, deals and quotes. */
export const DEMO_KEY = 'ioi-demo-v3';

/**
 * The server can't see the browser store, so it renders every signed-out page
 * as a visitor without a plan of their own sees it: the pitch on the deal
 * page, the put-your-plan-in pages elsewhere. That's what a first visit and
 * a crawler should get. A visitor who has put their plan in would see it
 * flash before their own pages replace it, so this runs in <head>, before
 * first paint, and marks <html> with `data-own`; CSS keeps the default
 * hidden until the store loads (`.demo-view.is-pending` in globals.css).
 */
export const OWN_PLAN_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(DEMO_KEY)})||'null');if(s&&s.seeded===false)document.documentElement.setAttribute('data-own','')}catch(e){}})()`;
