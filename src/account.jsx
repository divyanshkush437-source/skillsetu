import { asciiDigits } from "./access/digits.mjs";
import VerifyContact, { canonical } from "./verify-contact";
import Review from "./review";
import { areasOf, visible, available } from "../backend/listing.mjs";
import { demoWorkers } from "./data";
import React, { useEffect, useState, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Phone,
  Eye,
  UserRound,
  MapPin,
  BriefcaseBusiness,
  PhoneCall,
  Check,
} from "lucide-react";
import { config, api, live, read, save, navigate, wa, route } from "./data";
import {
  Avatar,
  Availability,
  Link,
  Share,
  tradeIcons,
  WorkerCard,
  Skeleton,
} from "./ui";
import { predict } from "../backend/skill-model.mjs";
import trainedSkills from "../backend/trained-skills.json";
import { firebaseAuth } from "./auth";
function Toggle({ value, change, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      className={"toggle " + (value ? "yes" : "no")}
      disabled={disabled}
      onClick={() => change(!value)}
    >
      <span>
        {value === null
          ? "Confirm availability"
          : value
            ? "Available now"
            : "Not available"}
      </span>
      <i />
    </button>
  );
}
export function Auth({ ready, pack }) {
  const t = pack?.t;
  const [phone, P] = useState(""),
    [code, C] = useState(""),
    [confirm, Q] = useState(null),
    [err, E] = useState(""),
    [busy, B] = useState(false);
  const cap = useRef(null);
  useEffect(
    () => () => {
      cap.current?.clear();
    },
    [],
  );
  async function submit(e) {
    e.preventDefault();
    B(true);
    E("");
    try {
      const { sdk, auth } = await firebaseAuth();
      if (confirm) {
        ready((await confirm.confirm(code)).user);
      } else {
        let num = "+91" + phone;
        await api("/otp-attempt", { method: "POST", body: { phone: num } });
        cap.current?.clear();
        cap.current = new sdk.RecaptchaVerifier(auth, "recaptcha", {
          size: "normal",
        });
        Q(await sdk.signInWithPhoneNumber(auth, num, cap.current));
      }
    } catch (e) {
      E(e.message);
    } finally {
      B(false);
    }
  }
  return (
    <section className="formbox">
      <span className="roundicon">
        <Phone />
      </span>
      <h2>{t ? (live ? t.phone : t.local) : live ? "Verify your phone" : "Try the worker flow"}</h2>
      {live ? (
        <form onSubmit={submit}>
          <p lang="en">
            Google uses your phone number for verification and abuse prevention.
            SMS charges may apply.
          </p>
          {confirm ? (
            <label>
              {t?.otp || "6-digit OTP"}
              <input
                required
                inputMode="numeric"
                pattern="[0-9]{6}"
                value={code}
                onChange={(e) => C(asciiDigits(e.target.value))}
              />
            </label>
          ) : (
            <label>
              {t?.phone || "Mobile number"} (+91)
              <input
                type="tel"
                required
                pattern="[6-9][0-9]{9}"
                maxLength="10"
                value={phone}
                onChange={(e) => P(asciiDigits(e.target.value))}
              />
            </label>
          )}
          <div id="recaptcha" />
          <button className="btn primary" disabled={busy}>
            {busy ? (t?.loading || "Please wait…") : confirm ? (t?.verify || "Verify code") : (t?.send || "Send OTP")}
          </button>
          {confirm && (
            <button
              type="button"
              className="textbtn"
              onClick={() => {
                Q(null);
                C("");
              }}
            >
              {t?.again || "Change number or resend"}
            </button>
          )}
        </form>
      ) : (
        <>
          <p lang="en">
            Explore with a demo account. Changes stay on this device. No OTP or
            job alerts are sent.
          </p>
          <button
            className="btn primary"
            onClick={() => {
              let u = { uid: "local-worker", phoneNumber: "+919000000001" };
              save("demoUser", u);
              ready(u);
            }}
          >
            {t?.demo || "Continue in demo mode"} <ArrowRight size={16} />
          </button>
        </>
      )}
      {err && (
        <p className="error" role="alert">
          {err}
        </p>
      )}
    </section>
  );
}
function ProfileForm({ user, own, hi }) {
  const draft = "draft-" + user.uid;
  const [f, F] = useState(() =>
    read(draft, {
      name: own?.name || "",
      skill: own?.skill || "",
      locality: own?.locality || "",
      serviceAreas: (own?.serviceAreas || []).filter(
        (a) => a !== own?.locality,
      ),
      listed: own?.listed ?? false,
      priceRange: own?.priceRange || "Ask for estimate",
      experience: own?.experience || "Not specified",
      whatsapp:
        own?.whatsapp ||
        own?.whatsappLink?.match(/wa.me\/(\d+)/)?.[1] ||
        user.phoneNumber,
      alerts: own?.alerts ?? false,
      availability: own?.availability ?? false,
    }),
  );
  const [step, S] = useState(1),
    [err, E] = useState(""),
    [busy, B] = useState(false);
  const [proof, setProof] = useState(null);
  const number = canonical(f.whatsapp);
  const needsProof =
    live &&
    number !== user.phoneNumber &&
    !(own?.contactVerified && number === own.whatsapp) &&
    proof?.number !== number;
  function field(k, v) {
    const n = { ...f, [k]: v };
    if (k === "locality")
      n.serviceAreas = (n.serviceAreas || []).filter((a) => a !== v);
    F(n);
    save(draft, n);
  }
  const candidate = {
    ...f,
    listed: f.listed ?? false,
    createdAt: own?.createdAt || new Date().toISOString(),
    confirmedAt: new Date().toISOString(),
    id: user.uid,
    verified: live,
    lastSeen: "just now",
    whatsappLink: wa(f.whatsapp, f.skill),
  };
  async function next(e) {
    e.preventDefault();
    E("");
    if (!f.name.trim() || !f.skill || !config.areas.includes(f.locality))
      return E(
        "Enter your name, choose your skill and select a listed locality.",
      );
    if (step === 2 && needsProof)
      return E("Verify your work number or use your sign-in number.");
    if (step < 3) {
      S(
        step === 1 && e.nativeEvent.submitter?.value === "quick" && !needsProof
          ? 3
          : step + 1,
      );
      return;
    }
    B(true);
    try {
      let id = user.uid;
      if (live) {
        id = (
          await api("/worker", {
            method: "POST",
            body: {
              ...f,
              listed: f.listed ?? false,
              contactProof: proof?.number === number ? proof.token : undefined,
            },
            user,
          })
        ).id;
      } else {
        save("profiles", [
          ...read("profiles", []).filter((x) => x.id !== id),
          { ...candidate, lastSeen: new Date().toISOString() },
        ]);
      }
      localStorage.removeItem("ss-" + draft);
      navigate("/dashboard?published=1");
    } catch (e) {
      E(e.message);
    } finally {
      B(false);
    }
  }
  return (
    <form className="formbox" onSubmit={next}>
      <div className="eyebrow">
        <span />
        {step === 3 ? "PROFILE PREVIEW" : "STEP " + step + " OF 2"}
      </div>
      <p>
        {hi
          ? "इस प्रोटोटाइप में प्रोफ़ाइल और काम की पूछताछ मुफ़्त हैं।"
          : "Free to list and receive enquiries. You agree the price directly with the household."}
      </p>
      <h2>
        {step === 1
          ? "Your work details"
          : step === 2
            ? "Rates and availability"
            : "Review your profile"}
      </h2>
      {step === 1 ? (
        <>
          <label>
            {hi ? "आपका नाम" : "Your name"}
            <input
              required
              maxLength="50"
              value={f.name}
              onChange={(e) => field("name", e.target.value)}
              autoComplete="name"
            />
          </label>
          <fieldset>
            <legend>
              {hi ? "आप क्या काम करते हैं?" : "Aap kya kaam karte ho?"}
            </legend>
            <div className="choices">
              {config.skills.map((s, i) => {
                const Icon = tradeIcons[i] || BriefcaseBusiness;
                return (
                  <button
                    type="button"
                    className={f.skill === s ? "picked" : ""}
                    aria-pressed={f.skill === s}
                    key={s}
                    onClick={() => field("skill", s)}
                  >
                    <Icon size={18} />
                    {hi
                      ? [
                          "प्लंबर",
                          "इलेक्ट्रीशियन",
                          "बढ़ई",
                          "सफाई",
                          "रसोइया",
                          "पेंटर",
                          "ड्राइवर",
                          "डिलीवरी",
                          "एसी मरम्मत",
                          "अन्य",
                        ][i] || s
                      : s}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label>
            {hi
              ? "आप किस इलाके में काम करते हैं?"
              : "Aap kis area mein kaam karte ho?"}
            <input
              list="localities"
              required
              value={f.locality}
              onChange={(e) => field("locality", e.target.value)}
              placeholder="Search your Mumbai locality"
            />
            <datalist id="localities">
              {config.areas.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </datalist>
          </label>
          <details className="messagebox">
            <summary>
              {hi
                ? "दूसरे सेवा क्षेत्र जोड़ें"
                : "Add other areas you serve (optional)"}
            </summary>
            <p>Choose up to two more areas you regularly travel to.</p>
            {(f.serviceAreas || []).map((a) => (
              <button
                key={a}
                type="button"
                className="chip"
                onClick={() =>
                  field(
                    "serviceAreas",
                    f.serviceAreas.filter((x) => x !== a),
                  )
                }
              >
                {a} ×
              </button>
            ))}
            {(f.serviceAreas || []).length < 2 && (
              <select
                aria-label="Add service area"
                value=""
                onChange={(e) =>
                  field("serviceAreas", [
                    ...(f.serviceAreas || []),
                    e.target.value,
                  ])
                }
              >
                <option value="">Choose an additional area</option>
                {config.areas
                  .filter(
                    (a) => a !== f.locality && !f.serviceAreas?.includes(a),
                  )
                  .map((a) => (
                    <option key={a}>{a}</option>
                  ))}
              </select>
            )}
          </details>
        </>
      ) : step === 2 ? (
        <>
          <label>
            {hi ? "काम का अनुभव" : "Experience"}
            <select
              value={f.experience}
              onChange={(e) => field("experience", e.target.value)}
            >
              {config.experience.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>
              {hi ? "आपकी फीस कितनी है?" : "Aapki fee kitni hai?"}
            </legend>
            <div className="choices">
              {config.prices.map((x) => (
                <button
                  type="button"
                  className={x === f.priceRange ? "picked" : ""}
                  onClick={() => field("priceRange", x)}
                  key={x}
                >
                  {x}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            {hi ? "काम के लिए WhatsApp नंबर" : "WhatsApp number"}
            <input
              type="tel"
              required
              pattern="(\+[1-9][0-9]{7,14}|91[6-9][0-9]{9}|[6-9][0-9]{9})"
              value={f.whatsapp}
              onChange={(e) => field("whatsapp", e.target.value)}
            />
            <small>
              Anyone requesting contact can see this WhatsApp number. You can
              use a work number.
            </small>
          </label>
          {needsProof && /^\+[1-9]\d{7,14}$/.test(number) && (
            <VerifyContact key={number} number={number} onVerified={setProof} />
          )}
          <fieldset>
            <legend>
              {hi ? "क्या आप अभी उपलब्ध हैं?" : "Kya aap abhi available ho?"}
            </legend>
            <Toggle
              value={f.availability}
              change={(v) => field("availability", v)}
            />
          </fieldset>
          <label className="optin">
            <input
              type="checkbox"
              checked={f.alerts}
              onChange={(e) => field("alerts", e.target.checked)}
            />
            Send matching job alerts by SMS
          </label>
        </>
      ) : (
        <div className="previewcard">
          <Avatar w={candidate} />
          <h3>{f.name}</h3>
          <p>
            {f.skill} · {f.locality}
          </p>
          <p>
            {f.experience} · {f.priceRange}
          </p>
          <Availability value={f.availability} />
          <p>WhatsApp: {f.whatsapp}</p>
          <p>Service areas: {areasOf(f).join(", ")}</p>
          <p>
            No fee to list, receive enquiries or complete work in this
            prototype.
          </p>
          <label className="optin">
            <input
              type="checkbox"
              checked={f.listed ?? false}
              onChange={(e) => field("listed", e.target.checked)}
            />
            Show my profile publicly and let households request my WhatsApp
            number
          </label>
          {f.listed === false && (
            <p>
              Your profile will be saved privately. You can show it from the
              dashboard later.
            </p>
          )}
        </div>
      )}
      {err && <p className="error">{err}</p>}
      <div className="actions">
        {step === 1 && (
          <button className="btn light" type="submit" value="quick">
            {hi ? "सीधे प्रोफ़ाइल देखें" : "Skip optional details"}
          </button>
        )}
        {step > 1 && (
          <button
            type="button"
            className="btn light"
            onClick={() => S(step - 1)}
          >
            Back
          </button>
        )}
        <button className="btn primary" disabled={busy}>
          {busy
            ? "Saving…"
            : step === 1
              ? "Continue"
              : step === 2
                ? "Preview profile"
                : f.listed === false
                  ? "Save private profile"
                  : "Publish profile"}
          <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
}
function JobForm({ user }) {
  const [done, D] = useState(false),
    [err, E] = useState(""),
    [busy, B] = useState(false);
  const key = useRef(crypto.randomUUID());
  const [description, setDescription] = useState("");
  const params = new URLSearchParams(route().search);
  const [selected, setSelected] = useState(() =>
    config.skills.includes(params.get("skill")) ? params.get("skill") : "",
  );
  const initialArea = config.areas.includes(params.get("locality"))
    ? params.get("locality")
    : "";
  const suggested = React.useMemo(
    () => predict(trainedSkills, description),
    [description],
  );
  async function post(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    B(true);
    E("");
    try {
      if (live)
        await api("/job", {
          method: "POST",
          user,
          body: { ...f, requestId: key.current },
        });
      else
        save("jobs", [
          { ...f, id: key.current, createdAt: new Date().toISOString() },
          ...read("jobs", []),
        ]);
      D(true);
    } catch (e) {
      E(e.message);
    } finally {
      B(false);
    }
  }
  return done ? (
    <section className="formbox">
      <Check />
      <h2>Job posted</h2>
      <p>
        {live
          ? "Workers with a matching skill and locality can view your enquiry."
          : "Saved on this device. A matching demo worker can see it in their dashboard."}
      </p>
      <Link className="btn navy" to="/search">
        Browse workers
      </Link>
    </section>
  ) : (
    <form className="formbox" onSubmit={post}>
      <label>
        What do you need help with?
        <textarea
          required
          name="description"
          minLength="5"
          maxLength="500"
          rows="4"
          placeholder="e.g. Repair a leaking kitchen tap"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label>
        Skill needed
        <select
          required
          name="skill"
          value={selected || suggested || ""}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option disabled value="">
            Choose skill
          </option>
          {config.skills.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {suggested && !selected && (
          <small role="status">
            Suggested from your description. You can change it.
          </small>
        )}
      </label>
      <label>
        Locality
        <select required name="locality" defaultValue={initialArea}>
          <option disabled value="">
            Choose locality
          </option>
          {config.areas.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </label>
      <label>
        Callback number
        <input
          required
          type="tel"
          name="posterPhone"
          defaultValue={user.phoneNumber}
          pattern="(\+[1-9][0-9]{7,14}|[6-9][0-9]{9})"
        />
      </label>
      {err && <p className="error">{err}</p>}
      <button disabled={busy} className="btn primary">
        {busy ? "Posting…" : "Post job"}
        <ArrowRight size={16} />
      </button>
    </form>
  );
}
function Dashboard({ user, own }) {
  const [w, W] = useState(() =>
      !live && own ? { ...own, availability: available(own) } : own,
    ),
    [jobs, J] = useState(null),
    [err, E] = useState(""),
    [busy, B] = useState(false);
  useEffect(() => {
    if (!visible(w)) {
      J([]);
      return;
    }
    let active = true;
    if (live)
      api("/jobs", { user })
        .then((j) => active && J(j))
        .catch((e) => active && E(e.message));
    else
      J(
        read("jobs", []).filter(
          (j) =>
            j.skill === w.skill &&
            visible(w) &&
            areasOf(w).includes(j.locality) &&
            Date.parse(j.createdAt) > Date.now() - 604800000,
        ),
      );
    return () => {
      active = false;
    };
  }, [user, own, w?.listed]);
  if (!w)
    return (
      <section className="formbox">
        <h2>Create your worker profile</h2>
        <p>Add your skill and locality to appear in the directory.</p>
        <Link to="/register" className="btn primary">
          Set up profile
        </Link>
      </section>
    );
  async function toggle(value) {
    const old = w,
      n = { ...w, availability: value, confirmedAt: new Date().toISOString() };
    W(n);
    B(true);
    E("");
    try {
      if (live)
        await api("/worker/" + w.id + "/availability", {
          method: "PATCH",
          user,
          body: { availability: value },
        });
      else
        save(
          "profiles",
          read("profiles", []).map((x) => (x.id === w.id ? n : x)),
        );
    } catch (e) {
      W(old);
      E(e.message);
    } finally {
      B(false);
    }
  }
  return (
    <>
      <section className="formbox">
        <h2>Kya aap abhi available ho?</h2>
        <p>Confirm availability once a day to appear under Available now.</p>
        <Toggle value={w.availability} change={toggle} disabled={busy} />
        {!visible(w) && (
          <p role="status">
            {w.moderation === "hidden"
              ? "This listing is hidden by a reviewer."
              : "Your listing is private."}
          </p>
        )}
        <h3>{w.name}</h3>
        <p>
          {w.skill} · {w.locality} · {w.priceRange}
        </p>
        <div className="actions">
          <button
            className="btn light"
            disabled={busy}
            onClick={async () => {
              B(true);
              E("");
              try {
                const listed = w.listed === false;
                if (live)
                  await api(
                    "/worker/" + encodeURIComponent(w.id) + "/visibility",
                    { method: "PATCH", user, body: { listed } },
                  );
                else
                  save(
                    "profiles",
                    read("profiles", []).map((x) =>
                      x.id === w.id ? { ...x, listed } : x,
                    ),
                  );
                W({ ...w, listed });
                if (!listed) J([]);
              } catch (e) {
                E(e.message);
              } finally {
                B(false);
              }
            }}
          >
            {w.listed === false ? "Show my listing" : "Pause my listing"}
          </button>
          <Link className="btn navy" to={"/worker/" + w.id}>
            View profile
          </Link>
          <Share id={w.id} />
        </div>
      </section>
      <section className="formbox">
        <h2>Recent enquiries</h2>
        {err && <p className="error">{err}</p>}
        {jobs === null ? (
          <p>{err ? "Enquiries unavailable." : "Loading enquiries…"}</p>
        ) : jobs.length === 0 ? (
          <p>
            New {w.skill.toLowerCase()} jobs in {w.locality} will appear here.
          </p>
        ) : (
          jobs.map((j) => (
            <div className="jobitem" key={j.id}>
              <b>{j.description}</b>
              <p>
                {j.locality} · {new Date(j.createdAt).toLocaleDateString()}
              </p>
              <a className="btn light" href={"tel:" + j.posterPhone}>
                <PhoneCall size={16} />
                Call ···· {j.posterPhone.slice(-4)}
              </a>
            </div>
          ))
        )}
      </section>
      <Link className="btn light" to="/register">
        Edit profile
      </Link>
    </>
  );
}
export default function Account({ path, hi }) {
  const [user, U] = useState(live ? null : read("demoUser", null)),
    [own, W] = useState(null),
    [loading, B] = useState(live),
    [err, E] = useState("");
  useEffect(() => {
    let active = true;
    if (live)
      firebaseAuth()
        .then(({ auth }) => {
          if (active) U(auth.currentUser);
        })
        .catch((e) => active && E(e.message))
        .finally(() => active && B(false));
    return () => {
      active = false;
    };
  }, []);
  const [pending, P] = useState(true);
  useEffect(() => {
    let active = true;
    if (user && path !== "/post-job" && path !== "/admin") {
      P(true);
      (live
        ? api("/me", { user })
        : Promise.resolve(demoWorkers().find((x) => x.id === user.uid))
      )
        .then((w) => active && W(w))
        .catch((e) => active && E(e.message))
        .finally(() => active && P(false));
    } else P(false);
    return () => {
      active = false;
    };
  }, [user, path]);
  return (
    <div className="narrow">
      <Link className="textbtn" to="/search">
        <ArrowLeft size={16} />
        Worker directory
      </Link>
      <div className="eyebrow">
        <span />
        {live ? "SKILLSETU" : "DEVICE DEMO"} / {config.city.toUpperCase()}
      </div>
      <h1>
        {path === "/admin"
          ? "Review and pilot results"
          : path === "/register"
            ? hi
              ? "अपनी प्रोफ़ाइल बनाएं"
              : "Your worker profile"
            : path === "/post-job"
              ? hi
                ? "काम पोस्ट करें"
                : "Post a local job"
              : hi
                ? "आपका डैशबोर्ड"
                : "Worker dashboard"}
      </h1>
      {path === "/admin" && !live ? (
        <Review user={null} />
      ) : err ? (
        <div className="notice">
          {err} <button onClick={() => location.reload()}>Retry</button>
        </div>
      ) : loading || pending ? (
        <Skeleton />
      ) : !user ? (
        <Auth ready={U} />
      ) : path === "/admin" ? (
        <Review user={user} />
      ) : path === "/register" ? (
        <ProfileForm user={user} own={own} hi={hi} />
      ) : path === "/post-job" ? (
        <JobForm user={user} />
      ) : (
        <Dashboard user={user} own={own} />
      )}
      {user && (
        <button
          className="textbtn"
          onClick={async () => {
            try {
              if (live) {
                const { sdk, auth } = await firebaseAuth();
                await sdk.signOut(auth);
              } else save("demoUser", null);
              U(null);
              W(null);
            } catch (e) {
              E(e.message);
            }
          }}
        >
          Sign out
        </button>
      )}
    </div>
  );
}
