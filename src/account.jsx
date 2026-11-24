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
import { config, api, live, read, save, navigate, wa } from "./data";
import {
  Avatar,
  Availability,
  Link,
  Share,
  tradeIcons,
  WorkerCard,
  Skeleton,
} from "./ui";
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
      <span>{value ? "Available now" : "Not available"}</span>
      <i />
    </button>
  );
}
function Auth({ ready }) {
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
      <h2>{live ? "Verify your phone" : "Try the worker flow"}</h2>
      {live ? (
        <form onSubmit={submit}>
          <p>
            Google uses your phone number for verification and abuse prevention.
            SMS charges may apply.
          </p>
          {confirm ? (
            <label>
              6-digit OTP
              <input
                required
                inputMode="numeric"
                pattern="[0-9]{6}"
                value={code}
                onChange={(e) => C(e.target.value)}
              />
            </label>
          ) : (
            <label>
              Mobile number (+91)
              <input
                type="tel"
                required
                pattern="[6-9][0-9]{9}"
                maxLength="10"
                value={phone}
                onChange={(e) => P(e.target.value)}
              />
            </label>
          )}
          <div id="recaptcha" />
          <button className="btn primary" disabled={busy}>
            {busy ? "Please wait…" : confirm ? "Verify code" : "Send OTP"}
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
              Change number or resend
            </button>
          )}
        </form>
      ) : (
        <>
          <p>
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
            Continue in demo mode <ArrowRight size={16} />
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
      priceRange: own?.priceRange || config.prices[0],
      experience: own?.experience || config.experience[0],
      whatsapp:
        own?.whatsapp ||
        own?.whatsappLink?.match(/wa.me\/(\d+)/)?.[1] ||
        user.phoneNumber,
      alerts: own?.alerts ?? false,
      availability: own?.availability ?? true,
    }),
  );
  const [step, S] = useState(1),
    [err, E] = useState(""),
    [busy, B] = useState(false);
  function field(k, v) {
    const n = { ...f, [k]: v };
    F(n);
    save(draft, n);
  }
  const candidate = {
    ...f,
    id: user.uid,
    verified: live,
    lastSeen: "just now",
    whatsappLink: wa(f.whatsapp, f.skill, f.locality),
  };
  async function next(e) {
    e.preventDefault();
    E("");
    if (!f.name.trim() || !f.skill || !config.areas.includes(f.locality))
      return E(
        "Enter your name, choose your skill and select a listed locality.",
      );
    if (step < 3) {
      S(step + 1);
      return;
    }
    B(true);
    try {
      let id = user.uid;
      if (live) {
        id = (await api("/worker", { method: "POST", body: f, user })).id;
      } else {
        save("profiles", [
          ...read("profiles", []).filter((x) => x.id !== id),
          {
            ...candidate,
            lastSeen: new Date().toISOString(),
            createdAt:
              read("profiles", []).find((x) => x.id === id)?.createdAt ||
              new Date().toISOString(),
          },
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
            <legend>Aap kya kaam karte ho?</legend>
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
                    {s}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label>
            Aap kahan rehte ho?
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
        </>
      ) : step === 2 ? (
        <>
          <label>
            Experience
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
            <legend>Aapki fee kitni hai?</legend>
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
            WhatsApp number
            <input
              type="tel"
              required
              pattern="(\+[1-9][0-9]{7,14}|91[6-9][0-9]{9}|[6-9][0-9]{9})"
              value={f.whatsapp}
              onChange={(e) => field("whatsapp", e.target.value)}
            />
            <small>Clients will contact you on this number.</small>
          </label>
          <fieldset>
            <legend>Kya aap abhi available ho?</legend>
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
        </div>
      )}
      {err && <p className="error">{err}</p>}
      <div className="actions">
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
      {[
        ["Skill needed", "skill", config.skills],
        ["Locality", "locality", config.areas],
      ].map(([label, k, items]) => (
        <label key={k}>
          {label}
          <select required name={k} defaultValue="">
            <option disabled value="">
              Choose {label.toLowerCase()}
            </option>
            {items.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      ))}
      <label>
        What do you need help with?
        <textarea
          required
          name="description"
          minLength="5"
          maxLength="500"
          rows="4"
          placeholder="e.g. Repair a leaking kitchen tap"
        />
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
  const [w, W] = useState(own),
    [jobs, J] = useState(null),
    [err, E] = useState(""),
    [busy, B] = useState(false);
  useEffect(() => {
    if (!w) return;
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
            j.locality === w.locality &&
            Date.parse(j.createdAt) > Date.now() - 604800000,
        ),
      );
    return () => {
      active = false;
    };
  }, [user, own]);
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
      n = { ...w, availability: value };
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
        <Toggle value={w.availability} change={toggle} disabled={busy} />
        <h3>{w.name}</h3>
        <p>
          {w.skill} · {w.locality} · {w.priceRange}
        </p>
        <div className="actions">
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
    if (user && path !== "/post-job") {
      P(true);
      (live
        ? api("/me", { user })
        : Promise.resolve(read("profiles", []).find((x) => x.id === user.uid))
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
        {path === "/register"
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
      {err ? (
        <div className="notice">
          {err} <button onClick={() => location.reload()}>Retry</button>
        </div>
      ) : loading || pending ? (
        <Skeleton />
      ) : !user ? (
        <Auth ready={U} />
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
