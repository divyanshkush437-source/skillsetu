import Guide, { Language } from "./access/Guide";
import { packs } from "./access/catalog.mjs";
import { Hand } from "lucide-react";
import { areasOf, visible, available } from "../backend/listing.mjs";
import { demoWorkers } from "./data";
import { localityCounts } from "../backend/coverage.mjs";
import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  Search as SearchIcon,
  ArrowRight,
  ArrowUpRight,
  ArrowLeft,
  Play,
  MapPin,
  BriefcaseBusiness,
  ChevronDown,
  Filter,
  Bookmark,
  Globe2,
  Network,
  X,
  Check,
  Layers3,
  BadgeCheck,
  Clock3,
  Wallet,
  Menu,
  Users,
  Radio,
} from "lucide-react";
import {
  config,
  samples,
  api,
  live,
  read,
  save,
  navigate,
  route,
  portable,
  activity,
} from "./data";
import {
  Link,
  WorkerCard,
  Avatar,
  Contact,
  Share,
  Report,
  Availability,
  tradeIcons,
  Skeleton,
  BookmarkButton,
} from "./ui";
import "./style.css";
const Account = lazy(() => import("./account"));
function Mark() {
  return (
    <Link to="/" className="brand">
      <img alt="" src="/mark.svg" />
      Skill<span>Setu</span>
    </Link>
  );
}
function Dialog({ children, close, label }) {
  const ref = useRef();
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      aria-label={label}
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="dialoghead">
        <b>{label}</b>
        <button className="icon" aria-label="Close" onClick={close}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Captcha({ accept }) {
  const el = useRef();
  const [error, E] = useState("");
  useEffect(() => {
    let active = true,
      id;
    const render = () => {
      if (active && el.current && window.turnstile)
        id = window.turnstile.render(el.current, {
          sitekey: window.SKILLSETU.turnstileSiteKey,
          callback: accept,
        });
    };
    const script = document.createElement("script");
    if (window.turnstile) render();
    else {
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.onload = render;
      script.onerror = () =>
        E("Verification is unavailable. Check your connection.");
      document.head.appendChild(script);
    }
    return () => {
      active = false;
      if (id != null) window.turnstile.remove(id);
      script.remove();
    };
  }, []);
  return (
    <div>
      <div ref={el} />
      {error}
    </div>
  );
}
function Directory({ home, hi }) {
  const p = new URLSearchParams(route().search),
    demo = p.has("demo"),
    dataLocal = demo || !live,
    preset =
      demo && !p.has("skill") && !p.has("locality") && !p.has("allAreas");
  const [skill, S] = useState(p.get("skill") || (preset ? "Plumber" : "")),
    [area, A] = useState(p.get("locality") || (preset ? "Andheri West" : "")),
    [avail, V] = useState(p.has("available")),
    [saved, F] = useState(p.has("saved")),
    [sheet, H] = useState(false),
    [workers, W] = useState([]),
    [error, E] = useState(""),
    [busy, B] = useState(true),
    [tick, T] = useState(0),
    [, refreshSaved] = useState(0);
  useEffect(() => {
    const f = () => refreshSaved((x) => x + 1);
    window.addEventListener("saved", f);
    return () => window.removeEventListener("saved", f);
  }, []);
  const captchaToken = useRef(null);
  const activeSkill = p.get("skill") || "",
    activeArea = p.get("locality") || "";
  useEffect(() => {
    const c = new AbortController();
    B(true);
    E("");
    if (dataLocal) {
      W(
        demoWorkers()
          .filter((w) => visible(w) && (!demo || w.id.startsWith("demo-")))
          .map((w) =>
            w.id.startsWith("demo-") ? w : { ...w, availability: available(w) },
          ),
      );
      B(false);
    } else {
      let q = new URLSearchParams();
      if (activeSkill) q.set("skill", activeSkill);
      if (activeArea) q.set("locality", activeArea);
      api("/workers?" + q, { signal: c.signal, captcha: captchaToken.current })
        .then(W)
        .catch((e) => {
          if (!c.signal.aborted) E(e.message);
        })
        .finally(() => {
          if (!c.signal.aborted) B(false);
        });
    }
    return () => c.abort();
  }, [dataLocal, demo, activeSkill, activeArea, tick]);
  function search(s = skill, a = area) {
    let q = new URLSearchParams();
    if (demo) q.set("demo", "1");
    if (s) q.set("skill", s);
    if (a) q.set("locality", a);
    else if (demo) q.set("allAreas", "1");
    if (avail) q.set("available", "1");
    if (saved) q.set("saved", "1");
    navigate("/search?" + q);
  }
  let result = workers.filter(
    (w) =>
      (!activeSkill || w.skill === activeSkill) &&
      (!activeArea || areasOf(w).includes(activeArea)) &&
      (!avail || w.availability) &&
      (!saved || read("favorites", []).includes(w.id)),
  );
  const [showAreas, setShowAreas] = useState(false);
  const [alternatives, setAlternatives] = useState(null);
  const [areaError, setAreaError] = useState("");
  useEffect(() => {
    if (!showAreas || saved) return;
    const controller = new AbortController();
    setAreaError("");
    setAlternatives(null);
    if (dataLocal)
      setAlternatives(
        localityCounts(workers, {
          skill: activeSkill,
          exclude: activeArea,
          available: avail,
        }),
      );
    else {
      const query = new URLSearchParams({
        view: "localities",
        skill: activeSkill,
        exclude: activeArea,
        available: avail ? "1" : "0",
      });
      api("/workers?" + query, {
        signal: controller.signal,
        captcha: captchaToken.current,
      })
        .then((rows) => {
          if (!controller.signal.aborted) setAlternatives(rows);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setAreaError(e.message);
        });
    }
    return () => controller.abort();
  }, [showAreas, saved, dataLocal, workers, activeSkill, activeArea, avail]);
  const fields = (
    <>
      <label>
        <span>
          <BriefcaseBusiness size={15} /> {hi ? "काम" : "Skill or service"}
        </span>
        <select value={skill} onChange={(e) => S(e.target.value)}>
          <option value="">{hi ? "सभी काम" : "All skills"}</option>
          {config.skills.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <label>
        <span>
          <MapPin size={15} />
          {hi ? "इलाका" : "Locality"}
        </span>
        <select value={area} onChange={(e) => A(e.target.value)}>
          <option value="">{hi ? "सभी इलाके" : "All localities"}</option>
          {config.areas.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <button className="btn primary" onClick={() => search()}>
        <SearchIcon size={18} />
        {hi ? "कारीगर खोजें" : "Find workers"}
      </button>
    </>
  );
  return (
    <>
      <section className="hero">
        <div className="herocopy">
          <div className="kicker">
            <span className="beacon" />{" "}
            {hi
              ? "मुंबई · स्थानीय कार्य निर्देशिका"
              : "MUMBAI  /  LOCAL WORK DIRECTORY"}
          </div>
          <h1>
            {hi ? (
              "अपने पास कुशल कारीगर खोजें।"
            ) : (
              <>
                Find skilled workers
                <br />
                <em>near you.</em>
              </>
            )}
          </h1>
          <p>
            {hi
              ? "कोई कमीशन नहीं। कोई बिचौलिया नहीं।"
              : "No commission. No middleman."}
          </p>
          {home ? (
            <div className="actions">
              <Link className="btn primary" to="/search">
                {hi ? "मुझे कारीगर चाहिए" : "I need a worker"}
                <ArrowRight size={17} />
              </Link>
              <Link className="btn dark" to="/register">
                {hi ? "मैं कारीगर हूँ" : "I am a worker"}
                <ArrowUpRight size={16} />
              </Link>
            </div>
          ) : (
            <button
              className="btn dark"
              onClick={() => navigate("/search?demo=1")}
            >
              <Play size={15} />
              Demo Mode
            </button>
          )}
        </div>
        <img
          className="toolbox"
          src="/toolbox.svg"
          alt="Illustration of a plumber’s wrench, paintbrush and screwdriver in a coral toolbox"
        />
      </section>
      <div className="searchpanel">{fields}</div>
      <button className="mobilefilter btn light" onClick={() => H(true)}>
        <Filter size={17} /> {skill || "All skills"} ·{" "}
        {area || "All localities"} <ChevronDown size={16} />
      </button>
      {sheet && (
        <Dialog label="Find local workers" close={() => H(false)}>
          <div className="sheetfields">{fields}</div>
        </Dialog>
      )}
      <section className="directory">
        <div className="sectiontop">
          <div>
            <div className="eyebrow">
              <span /> {hi ? "कारीगर निर्देशिका" : "WORKER DIRECTORY"}
            </div>
            <h2>{hi ? "स्थानीय कारीगर" : "Workers near you"}</h2>
          </div>
          <span className="city">
            <MapPin size={16} />
            {config.city}, Maharashtra
          </span>
        </div>
        <div className="filters">
          <button
            className={!avail && !saved ? "chip active" : "chip"}
            onClick={() => {
              V(false);
              F(false);
            }}
          >
            <Users size={15} />
            {hi ? "सभी कारीगर" : "All workers"}
          </button>
          <button
            aria-pressed={avail}
            className={"chip " + (avail ? "active" : "")}
            onClick={() => V(!avail)}
          >
            <i className="dot" />
            {hi ? "अभी उपलब्ध" : "Available now"}
          </button>
          <button
            aria-pressed={saved}
            className={"chip " + (saved ? "active" : "")}
            onClick={() => F(!saved)}
          >
            <Bookmark size={14} />
            {hi ? "सहेजे गए" : "Saved"}
          </button>
          <span>
            {busy
              ? "Loading…"
              : result.length +
                " " +
                (dataLocal ? "demo " : "") +
                "profile" +
                (result.length === 1 ? "" : "s")}
          </span>
        </div>
        {(activeSkill || activeArea) && (
          <p>
            Showing {activeSkill || "all skills"} in{" "}
            {activeArea || "all localities"} ·{" "}
            <Link to={demo ? "/search?demo=1" : "/search"}>Clear filters</Link>
          </p>
        )}
        {preset && (
          <p className="hint">
            Three sample profiles. Tap Find workers to apply Plumber + Andheri
            West.
          </p>
        )}
        {busy ? (
          <Skeleton />
        ) : error ? (
          <div className="notice">
            {error}{" "}
            {error === "Complete the search verification." &&
            window.SKILLSETU.turnstileSiteKey ? (
              <Captcha
                accept={(token) => {
                  captchaToken.current = token;
                  T((v) => v + 1);
                }}
              />
            ) : (
              <button onClick={() => T(tick + 1)}>Retry</button>
            )}
          </div>
        ) : result.length ? (
          <div className="grid">
            {result.map((w) => (
              <WorkerCard key={w.id} w={w} area={activeArea} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <SearchIcon />
            <h3>
              {saved
                ? hi
                  ? "सहेजे गए कारीगर नहीं मिले।"
                  : "No saved workers match these filters."
                : avail
                  ? hi
                    ? "अभी उपलब्ध कारीगर नहीं मिले।"
                    : "No workers match the available-now filter."
                  : hi
                    ? "इस खोज में कोई कारीगर नहीं मिला।"
                    : "No workers match this search."}
            </h3>
            <div className="actions recovery">
              {saved && (
                <button className="btn light" onClick={() => F(false)}>
                  {hi ? "सहेजे गए का फ़िल्टर हटाएँ" : "Include unsaved workers"}
                </button>
              )}
              {avail && (
                <button className="btn light" onClick={() => V(false)}>
                  {hi ? "सभी उपलब्धताएँ देखें" : "Include unavailable workers"}
                </button>
              )}
              {activeArea && !saved && (
                <button
                  className="btn light"
                  onClick={() => setShowAreas(!showAreas)}
                  aria-expanded={showAreas}
                >
                  {hi ? "दूसरे इलाके देखें" : "Check other localities"}
                </button>
              )}
              {!(demo && live) && (
                <Link
                  className="btn primary"
                  to={
                    "/post-job?" +
                    new URLSearchParams({
                      skill: activeSkill,
                      locality: activeArea,
                    })
                  }
                >
                  {hi ? "अपने इलाके में काम पोस्ट करें" : "Post a local job"}
                </Link>
              )}
            </div>
            {showAreas && !saved && (
              <div aria-live="polite">
                {areaError ? (
                  <p>
                    {areaError}{" "}
                    <button
                      className="btn light"
                      onClick={() => setShowAreas(false)}
                    >
                      Close
                    </button>
                  </p>
                ) : !alternatives ? (
                  <p>Checking listings…</p>
                ) : alternatives.length ? (
                  <>
                    <p>
                      {hi
                        ? "इन इलाकों में प्रोफ़ाइल हैं। आने की पुष्टि कारीगर से करें।"
                        : "These localities have matching profiles. Ask the worker whether they can travel to you."}
                    </p>
                    <div className="actions recovery">
                      {alternatives.map(({ locality, count }) => (
                        <button
                          key={locality}
                          className="chip"
                          onClick={() => search(activeSkill, locality)}
                        >
                          {locality} ({count})
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p>
                    {hi
                      ? "दूसरे इलाकों में भी कोई मेल नहीं मिला।"
                      : "No matching profiles in other localities yet."}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </section>
      {home && (
        <section className="impact">
          <div>
            <b>{config.areas.length} localities</b>In the Mumbai directory
          </div>
          <div>
            <b>0%</b>Commission
          </div>
          <div>
            <b>WhatsApp-first</b>Contact workers directly
          </div>
          <button
            className="btn light"
            onClick={() => navigate("/search?demo=1")}
          >
            <Play size={15} />
            Demo Mode
          </button>
        </section>
      )}
    </>
  );
}
function Profile({ id }) {
  const [w, W] = useState(null),
    [error, E] = useState(""),
    [retry, R] = useState(0);
  useEffect(() => {
    let c = new AbortController();
    E("");
    W(null);
    const sample = samples.find((x) => x.id === id);
    if (sample || !live) {
      const found = (live ? samples : demoWorkers()).find(
        (x) => x.id === id && visible(x),
      );
      if (found)
        W(
          found.id.startsWith("demo-")
            ? found
            : { ...found, availability: available(found) },
        );
      else E("This profile could not be found.");
    } else
      api("/worker/" + encodeURIComponent(id), { signal: c.signal })
        .then(W)
        .catch((e) => {
          if (!c.signal.aborted) E(e.message);
        });
    return () => c.abort();
  }, [id, retry]);
  return (
    <div className="narrow">
      <Link className="textbtn" to="/search">
        <ArrowLeft size={16} />
        Worker directory
      </Link>
      {error ? (
        <div className="notice">
          {error} <button onClick={() => R(retry + 1)}>Retry</button>
        </div>
      ) : !w ? (
        <Skeleton />
      ) : (
        <section className="profilebox">
          <div className="profilecap">
            <span className="kicker">SKILLSETU / WORKER PROFILE</span>
            <img src="/mark.svg" alt="" />
          </div>
          <div className="profilebody">
            <div className="row">
              <Avatar w={w} />
              <Availability value={w.availability} />
            </div>
            <h1>{w.name}</h1>
            <p className="place">
              <MapPin size={16} />
              {w.locality}, Mumbai
            </p>
            <div className="profilefacts">
              {[
                ["Skill", w.skill],
                ["Experience", w.experience],
                ["Price range", w.priceRange],
                ["Last seen", activity(w.lastSeen)],
                ["Service areas", areasOf(w).join(", ")],
                [
                  "Listed since",
                  w.createdAt
                    ? new Date(w.createdAt).toLocaleDateString("en-IN", {
                        month: "short",
                        year: "numeric",
                      })
                    : "Date unavailable",
                ],
                ["Reply time", "Unknown"],
              ].map(([k, v]) => (
                <div key={k}>
                  <small>{k}</small>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
            {w.verified && (
              <p>
                <BadgeCheck className="check" size={17} /> Phone OTP verified{" "}
                {id.startsWith("demo-") ? "· sample profile" : ""}
              </p>
            )}
            {w.contacts && <p>{w.contacts} enquiries · demo count</p>}
            <Contact
              w={w}
              detail
              area={new URLSearchParams(route().search).get("area")}
            />
            <small>
              Phone verification covers the sign-in number. Background checks,
              insurance and a re-service guarantee are unavailable. Confirm the
              final fee before work starts. WhatsApp opens a draft for you to
              send.
            </small>
            <div className="actions">
              <Share id={id} />
              <BookmarkButton id={id} />
            </div>
            <Report w={w} />
          </div>
        </section>
      )}
    </div>
  );
}
function App() {
  const [locale,setLocale]=useState(()=>read("language",read("hi",false)?"hi":"en"));
  const [easy,setEasy]=useState(()=>read("easy",false)||new URLSearchParams(route().search).get("easy")==="1");
  const pack=packs[locale]||packs.en;
  function choose(code){setLocale(code);save("language",code);setEasy(true);save("easy",true);}
  function exitGuide(){setEasy(false);save("easy",false);setLocale("en");save("language","en");L(false);save("hi",false);}
  const [url, U] = useState(route().pathname + route().search),
    [hi, L] = useState(read("hi", false)),
    [modal, M] = useState(""),
    [menu, N] = useState(false),
    [online, O] = useState(navigator.onLine);
  useEffect(() => {
    const f = () => {
        U(route().pathname + route().search);
        N(false);
        M("");
      },
      o = () => O(navigator.onLine);
    window.addEventListener("popstate", f);
    window.addEventListener("hashchange", f);
    window.addEventListener("online", o);
    window.addEventListener("offline", o);
    return () => {
      window.removeEventListener("popstate", f);
      window.removeEventListener("hashchange", f);
      window.removeEventListener("online", o);
      window.removeEventListener("offline", o);
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = easy && !url.startsWith("/admin") ? pack.code : hi ? "hi" : "en";
    document.documentElement.dir = easy && pack.rtl && !url.startsWith("/admin") ? "rtl" : "ltr";
  }, [hi,easy,pack,url]);
  const path = url.split("?")[0],
    links = (
      <>
        <Link
          className={["/", "/search"].includes(path) ? "current" : ""}
          to="/search"
        >
          {hi ? "कारीगर खोजें" : "Find workers"}
        </Link>
        <Link to="/post-job">{hi ? "काम पोस्ट करें" : "Post a job"}</Link>
        <Link to="/dashboard">{hi ? "डैशबोर्ड" : "Dashboard"}</Link>
      </>
    );
  if(easy && path!=="/admin") return <Guide key={url} path={path} pack={pack} change={choose} exit={exitGuide}/>;
  return (
    <>
      <header>
        <div className="headinner">
          <Mark />
          <nav>{links}</nav>
          <div className="rightnav">
            <Language code={locale} change={choose}/>
            <button className="easyStart" onClick={()=>choose(locale)}><Hand size={20}/>Easy mode</button>
            <Link className="btn navy" to="/register">
              {hi ? "कारीगर बनें" : "Join as a worker"}
              <ArrowUpRight size={16} />
            </Link>
            <button
              className="icon menubtn"
              onClick={() => N(!menu)}
              aria-label="Navigation"
              aria-expanded={menu}
            >
              <Menu />
            </button>
          </div>
        </div>
        {menu && (
          <div className="mobilenav">
            {links}
            <Link to="/register">Join as a worker</Link>
          </div>
        )}
      </header>
      {!online && (
        <div className="offline">
          You’re offline. Some features may not work.
        </div>
      )}
      <main key={url}>
        {path === "/" || path === "/search" ? (
          <Directory home={path === "/"} hi={hi} />
        ) : path.startsWith("/worker/") ? (
          <Profile id={path.slice(8)} />
        ) : ["/register", "/post-job", "/dashboard", "/admin"].includes(
            path,
          ) ? (
          <Suspense fallback={<Skeleton />}>
            <Account path={path} hi={hi} />
          </Suspense>
        ) : (
          <div className="empty">
            <h2>Page not found</h2>
            <Link to="/search">Browse workers</Link>
          </div>
        )}
      </main>
      <footer>
        <div>
          <Mark />
          <span>SkillSetu commission on an ₹800 job: ₹0</span>
        </div>
        <div>
          <button onClick={() => M("Architecture")}>
            <Network size={16} />
            Architecture
          </button>
          <Link to="/admin">{live ? "Reviewer access" : "Demo reviewer"}</Link>
          <button onClick={() => M("Roadmap")}>
            Roadmap
            <ArrowUpRight size={14} />
          </button>
        </div>
      </footer>
      {modal && (
        <Dialog
          label={modal === "Architecture" ? "AWS architecture" : "Roadmap"}
          close={() => M("")}
        >
          {modal === "Architecture" ? (
            <>
              <p>
                {live
                  ? "Configured cloud flow"
                  : "Demo runs in your browser. Deployment architecture"}
              </p>
              <div className="arch">
                <div>AWS Amplify · React</div>
                <span>↓ &nbsp; Firebase phone OTP for writes</span>
                <div>API Gateway → Node.js Lambda</div>
                <span>↓ &nbsp; Read and write</span>
                <div>DynamoDB · workers and jobs</div>
                <span>↓ &nbsp; New job stream → alert Lambda</span>
                <section>
                  <b>
                    SNS
                    <br />
                    <small>Worker SMS</small>
                  </b>
                  <b>
                    SES
                    <br />
                    <small>Job summaries</small>
                  </b>
                </section>
              </div>
            </>
          ) : (
            <>
              <p>
                Phone OTP verifies control of a number. Background checks are
                planned.
              </p>
              <p>
                Future options include identity checks, booking deposits and
                travel-time matching. These need a separate pilot.
              </p>
              <p>
                Today, choose a locality and agree the job and price directly on
                WhatsApp. SkillSetu collects no deposit.
              </p>
            </>
          )}
        </Dialog>
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
if (!portable && "serviceWorker" in navigator)
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {}),
  );
