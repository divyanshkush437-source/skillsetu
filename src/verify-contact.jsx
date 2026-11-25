import React, { useState, useEffect, useRef } from "react";
import { alternateAuth } from "./auth";
import { api } from "./data";
export function canonical(value) {
  const digits = value.replace(/\D/g, "");
  return "+" + (/^[6-9]\d{9}$/.test(digits) ? "91" : "") + digits;
}
export default function VerifyContact({ number, onVerified }) {
  const [challenge, C] = useState(null),
    [code, K] = useState(""),
    [error, E] = useState(""),
    [busy, B] = useState(false);
  const captcha = useRef(null);
  useEffect(() => () => captcha.current?.clear(), []);
  async function run() {
    B(true);
    E("");
    try {
      const { auth, sdk } = await alternateAuth();
      if (challenge) {
        const { user } = await challenge.confirm(code);
        const token = await user.getIdToken();
        await sdk.signOut(auth);
        onVerified({ number: user.phoneNumber, token });
      } else {
        await api("/otp-attempt", { method: "POST", body: { phone: number } });
        captcha.current?.clear();
        captcha.current = new sdk.RecaptchaVerifier(auth, "verify-work-phone", {
          size: "normal",
        });
        C(await sdk.signInWithPhoneNumber(auth, number, captcha.current));
      }
    } catch (e) {
      E(e.message);
    } finally {
      B(false);
    }
  }
  return (
    <section>
      <p>Confirm that you control this work number before publishing it.</p>
      <div id="verify-work-phone" />
      {challenge && (
        <label>
          Work number OTP
          <input
            inputMode="numeric"
            value={code}
            maxLength={6}
            onChange={(e) => K(e.target.value)}
          />
        </label>
      )}
      <button type="button" className="btn light" disabled={busy} onClick={run}>
        {challenge ? "Confirm work number" : "Send work number OTP"}
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
