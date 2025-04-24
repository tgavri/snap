// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// Updated Auth imports
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDkZoCjZGJ8ix8XjxJJ8y-gRzAEfXx4MRw",
  authDomain: "torsdag-ee1cf.firebaseapp.com",
  databaseURL: "https://torsdag-ee1cf-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "torsdag-ee1cf",
  storageBucket: "torsdag-ee1cf.appspot.com",
  messagingSenderId: "366920203555",
  appId: "1:366920203555:web:09ba2a3568317ded5ae096"
};

// Initialize Firebase App (if not already initialized)
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp(); // Use the existing app instance
}

// Initialize services using the single app instance
export const db = getFirestore(app);

// Initialize Storage with default settings
// On iOS, this will work better than trying to specify bucket
export const storage = getStorage(app);

// Initialize Auth with persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});