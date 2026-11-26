// wrangler bundles .html files as text (the Text rule in wrangler.jsonc).
declare module "*.html" {
  const text: string;
  export default text;
}
