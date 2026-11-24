// Load the Firebase SDK only on account screens and only for a configured project.
let task;
export function firebaseAuth() {
  return (task ??= (async () => {
    const base = "https://www.gstatic.com/firebasejs/11.10.0/";
    const [{ initializeApp }, sdk] = await Promise.all([
      import(base + "firebase-app.js"),
      import(base + "firebase-auth.js"),
    ]);
    const auth = sdk.getAuth(initializeApp(window.SKILLSETU.firebase));
    await auth.authStateReady();
    return { auth, sdk };
  })().catch((e) => {
    task = null;
    throw e;
  }));
}
