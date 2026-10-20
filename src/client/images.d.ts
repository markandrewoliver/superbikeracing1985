/** Vite turns an image import into the URL it is served at. */
declare module "*.png" {
  const url: string;
  export default url;
}
