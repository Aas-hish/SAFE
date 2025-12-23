import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration provided by the user
const firebaseConfig = {
  apiKey: 'AIzaSyCIy2znPgxWyMxAyi0ckxhUiiNvQudXwrA',
  authDomain: 'ezwinds-78f4d.firebaseapp.com',
  projectId: 'ezwinds-78f4d',
  storageBucket: 'ezwinds-78f4d.firebasestorage.app',
  messagingSenderId: '194693920400',
  appId: '1:194693920400:web:20875c23a3ebea7f1aca15',
  measurementId: 'G-F5BE99DLCB',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Analytics is optional; guard so it only runs in supported environments.
let analytics;
if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
      return null;
    })
    .catch(() => {
      // Ignore analytics failures; auth should still work.
    });
}

export { app, auth, db, analytics };

