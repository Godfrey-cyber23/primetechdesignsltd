// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCQNKfoNDPfj-mSZxAQCIEzQ4H3tS-KmiM",
  authDomain: "primetech-os.firebaseapp.com",
  projectId: "primetech-os",
  storageBucket: "primetech-os.firebasestorage.app",
  messagingSenderId: "853393963895",
  appId: "1:853393963895:web:e2c881c3eab3e52b88ff72",
  measurementId: "G-7R82XLTYT4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);