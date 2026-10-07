'use client';
import {getApps,initializeApp} from 'firebase/app';
import {getAuth,connectAuthEmulator} from 'firebase/auth';
import {getDatabase,connectDatabaseEmulator} from 'firebase/database';
let connected=false;
export function firebase() {
 if(!process.env.NEXT_PUBLIC_FIREBASE_API_KEY||!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return null;
 const app=getApps()[0]??initializeApp({apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY,authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,databaseURL:process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,appId:process.env.NEXT_PUBLIC_FIREBASE_APP_ID});
 const auth=getAuth(app),rtdb=getDatabase(app);
 if(process.env.NEXT_PUBLIC_USE_EMULATORS==='true'&&!connected&&['localhost','127.0.0.1'].includes(window.location.hostname)) {connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectDatabaseEmulator(rtdb,'127.0.0.1',9000);connected=true;}
 return {auth,rtdb};
}
