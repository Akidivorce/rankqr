# RankQR – Sistema de Ranking Escolar con QR

## 📋 Descripción
Aplicación web para colegio que permite a **profesores** escanear los códigos QR de las pulseras de los **alumnos** para registrar la asistencia y participación en diferentes cursos. Ambos roles tienen dashboards propios con ranking en tiempo real.

---

## 🚀 Configuración en 3 pasos (5 minutos)

### Paso 1: Crear proyecto Firebase (gratis)
1. Ve a [console.firebase.google.com](https://console.firebase.google.com)
2. Clic en **"Agregar proyecto"** → nombre cualquiera → continuar
3. Desactiva Google Analytics (opcional) → Crear proyecto

### Paso 2: Habilitar Authentication y Firestore
1. En el menú izquierdo → **Authentication** → "Comenzar"
   - Habilita **"Correo electrónico/Contraseña"**
2. En el menú izquierdo → **Firestore Database** → "Crear base de datos"
   - Elige **"Modo de prueba"** → Siguiente → Listo
3. En Firestore → **Reglas** → pega esto y publica:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null;
    }
    match /scans/{scanId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
    }
  }
}
```

### Paso 3: Copiar configuración al proyecto
1. En Firebase → **Configuración del proyecto** (ícono ⚙️) → Sección "Tus apps"
2. Clic en **"Agregar app"** → Web (ícono `</>`)
3. Registra la app → copia el objeto `firebaseConfig`
4. Abre el archivo **`firebase-config.js`** y reemplaza los valores del objeto `firebaseConfig` con los tuyos

---

## 💻 Ejecutar localmente

> ⚠️ **IMPORTANTE**: La cámara del navegador **no funciona** con `file://`. Debes usar un servidor local.

### Opción A: Python (recomendado, viene instalado en Mac)
```bash
# En la carpeta del proyecto:
cd "/Users/jonaa1z_/Documents/proyecto anneliz"
python3 -m http.server 8080
# Abre: http://localhost:8080
```

### Opción B: Node.js
```bash
npx serve .
# Abre la URL que aparezca
```

### Opción C: VS Code
- Instala la extensión **"Live Server"**
- Clic derecho en `index.html` → **"Open with Live Server"**

---

## 👥 Pruebas simultáneas (dos usuarios a la vez)

| Ventana | Usuario | Cómo abrir |
|---------|---------|-----------|
| Ventana normal | Profesor | Chrome normal |
| Ventana incógnita | Alumno | Ctrl+Shift+N (⌘+Shift+N en Mac) |

**Flujo de prueba:**
1. **Alumno** inicia sesión → ve su QR en pantalla
2. **Profesor** inicia sesión → va a "Escáner QR" → inicia cámara
3. **Profesor** apunta la cámara al QR del alumno en la otra ventana
4. El punto se asigna y el **ranking se actualiza en tiempo real en ambas ventanas** ✅

---

## 📱 Cuentas de Demo

Crea estas cuentas usando el formulario de **Registro** (en ese orden):

| Rol | Email | Contraseña | Curso |
|-----|-------|-----------|---------|
| Profesor | prof1@rankqr.com | 123456 | 📐 Matemática |
| Profesor | prof2@rankqr.com | 123456 | 🧪 Ciencia |
| Alumno | alumno1@rankqr.com | 123456 | — |
| Alumno | alumno2@rankqr.com | 123456 | — |
| Alumno | alumno3@rankqr.com | 123456 | — |

---

## 🗺️ Cursos disponibles

| Curso | Ícono | Color |
|-----------|-------|-------|
| Matemática | 📐 | Celeste/Azul |
| Comunicación | ✍️ | Rojo/Rosado |
| DPSC | ⚖️ | Púrpura |
| Inglés | 💬 | Teal |
| Ciencia | 🧪 | Verde |
| Arte | 🎨 | Rosado |
| Ed. Física | ⚽ | Ámbar |

Máximo: **7 cursos por alumno** (uno de cada curso)

---

## 📁 Estructura de archivos

```
proyecto anneliz/
├── index.html          → HTML principal (todas las vistas)
├── style.css           → Estilos premium con glassmorphism
├── firebase-config.js  → ⚙️ EDITA ESTE con tu config de Firebase
├── app.js              → Lógica principal, auth, routing
├── teacher.js          → Dashboard del Profesor (escáner QR)
└── student.js          → Dashboard del Alumno (QR, puntos, ranking)
```

---

## 🗄️ Estructura de la base de datos (Firestore)

### Colección: `users`
```json
{
  "name": "Juan García",
  "email": "juan@ejemplo.com",
  "role": "student",
  "points": 6,
  "visitedLocations": ["matematica", "ciencia", "ed_fisica"],
  "studentCode": "STU-A1B2C3D4"
}
```

### Colección: `scans`
```json
{
  "studentId": "uid_del_alumno",
  "studentName": "Juan García",
  "teacherId": "uid_del_profesor",
  "teacherName": "Prof. María López",
  "locationId": "matematica",
  "locationName": "Matemática",
  "pointsAwarded": 2,
  "timestamp": "2026-06-29T15:30:00Z"
}
```

---

## ❓ Preguntas frecuentes

**¿La cámara no funciona?**
→ Asegúrate de usar `http://localhost:XXXX` y no `file://`

**¿Error "Permission denied" en Firestore?**
→ Verifica las reglas de Firestore (Paso 2)

**¿El QR no se escanea?**
→ Asegúrate de que el QR esté bien iluminado y a unos 20-30cm de la cámara

**¿Cómo agregar más cursos?**
→ Edita el objeto `LOCS` en `app.js` y agrega las opciones en el `<select>` de `index.html`
