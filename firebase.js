// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDkZoCjZGJ8ix8XjxJJ8y-gRzAEfXx4MRw",
  authDomain: "torsdag-ee1cf.firebaseapp.com",
  databaseURL: "https://torsdag-ee1cf-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "torsdag-ee1cf",
  storageBucket: "torsdag-ee1cf.firebasestorage.app",
  messagingSenderId: "366920203555",
  appId: "1:366920203555:web:09ba2a3568317ded5ae096"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);