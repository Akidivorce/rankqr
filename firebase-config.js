// ============================================================
// firebase-config.js
// CONFIGURACIÓN DE FIREBASE
//
// INSTRUCCIONES (solo toma 5 minutos):
// 1. Ve a https://console.firebase.google.com
// 2. Crea un nuevo proyecto (gratis, sin tarjeta de crédito)
// 3. En "Authentication" → habilita "Email/Password"
// 4. En "Firestore Database" → crea una base de datos en modo prueba
// 5. En Configuración del proyecto → Agrega una app web
// 6. Copia la configuración y reemplaza los valores de abajo
//
// REGLAS DE FIRESTORE (pega esto en Firestore → Reglas):
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null;
    }
    match /scans/{scanId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
    }
  }
}
*/
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto-id",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdefghijklmnopqrstuv"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Idioma en español para mensajes de error
auth.languageCode = 'es';

// Habilitar persistencia offline (opcional)
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('Persistencia solo disponible en una pestaña a la vez');
  } else if (err.code === 'unimplemented') {
    console.warn('El navegador no soporta persistencia offline');
  }
});
