import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import Piano from "./pages/piano.jsx";
import Login from "./pages/Login.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import ProfileMenu from "./components/ProfileMenu.jsx";

export default function App() {
  // undefined = still checking, null = signed out, object = signed in
  const [session, setSession] = useState(undefined);

  // true while the user is arriving from a "reset password" email link
  const [recovering, setRecovering] = useState(
    () => window.location.hash.includes("type=recovery")
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  function finishRecovery() {
    window.history.replaceState(null, "", window.location.pathname);
    setRecovering(false);
  }

  if (session === undefined) return null;

  if (recovering && session) return <ResetPassword onDone={finishRecovery} />;

  if (!session) return <Login />;

  return (
    <>
      <ProfileMenu user={session.user} />
      <Piano />
    </>
  );
}