// Public, read-only diagnostic for the static Pages placeholder.
// The authenticated Vinext application is hosted separately; never impersonate it.
export async function onRequestGet({request}) {
  return new Response(JSON.stringify({
    service:'warlike-server',
    ready:false,
    deployment:'cloudflare-pages-static-placeholder',
    applicationRuntime:'not-deployed-here',
    authentication:'private-hosting-required',
    mailTransport:'internal-only',
    detail:'Cloudflare Pages serves a static status page. Deploy the Vinext application to a compatible Workers runtime with its required secrets and bindings.'
  }),{status:503,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
