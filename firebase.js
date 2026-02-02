import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDm6jmNhQC-IqkxXAaf4yfUmyKsNw26ArY",
  authDomain: "dance-calendar-d733f.firebaseapp.com",
  projectId: "dance-calendar-d733f",
  storageBucket: "dance-calendar-d733f.firebasestorage.app",
  messagingSenderId: "194455422203",
  appId: "1:194455422203:web:6ce657dae7da6622e45c5e"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
