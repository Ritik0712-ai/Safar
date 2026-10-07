import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['firebase-admin'],
  async headers() { return [{ source: '/(.*)', headers: [
    {key:'X-Content-Type-Options', value:'nosniff'},
    {key:'X-Frame-Options', value:'DENY'},
    {key:'Referrer-Policy', value:'strict-origin-when-cross-origin'},
    {key:'Permissions-Policy', value:'camera=(), microphone=(), geolocation=(self)'},
    {key:'Content-Security-Policy', value:"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.geoapify.com https://*.tile.openstreetmap.org; font-src 'self'; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebasedatabase.app wss://*.firebasedatabase.app https://*.geoapify.com https://*.razorpay.com http://127.0.0.1:9099 http://127.0.0.1:9000 ws://127.0.0.1:9000; frame-src https://*.firebaseapp.com https://*.razorpay.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"}
  ]}]; }
};
export default config;
