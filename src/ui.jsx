import React, { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Clock3,
  BadgeCheck,
  Bookmark,
  Wrench,
  Zap,
  Paintbrush,
  Car,
  Truck,
  ChefHat,
  Snowflake,
  BriefcaseBusiness,
  Hammer,
  Sparkles,
  MessageCircle,
  Share2,
  Flag,
} from "lucide-react";
import { navigate, portable, read, save, activity, api, live } from "./data";
export const tradeIcons = [
  Wrench,
  Zap,
  Hammer,
  Sparkles,
  ChefHat,
  Paintbrush,
  Car,
  Truck,
  Snowflake,
  BriefcaseBusiness,
];
export function Link({ to, children, ...props }) {
  return (
    <a
      href={portable ? "#" + to : to}
      {...props}
      onClick={(e) => {
        if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
          e.preventDefault();
          navigate(to);
        }
      }}
    >
      {children}
    </a>
  );
}
import { Contact } from "./enquiry";
export { Contact };
import { reasons, areasOf } from "../backend/listing.mjs";
import { demoReview, demoWorkers } from "./data";
export function Availability({ value }) {
  return (
    <span className={"status " + (!value ? "busy" : "")}>
      <i />
      {value === null
        ? "Confirm availability"
        : value
          ? "Available now"
          : "Not available"}
    </span>
  );
}
export function Avatar({ w }) {
  return (
    <div
      className={
        "avatar tone" +
        (["Electrician", "Maid/Housekeeping"].indexOf(w.skill) + 1)
      }
    >
      {w.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0])
        .join("")
        .toUpperCase()}
    </div>
  );
}
export function BookmarkButton({ id }) {
  const [on, S] = useState(read("favorites", []).includes(id));
  return (
    <button
      className={"icon save " + (on ? "selected" : "")}
      aria-label={on ? "Remove saved worker" : "Save worker on this device"}
      aria-pressed={on}
      onClick={() => {
        let list = read("favorites", []).filter((x) => x !== id);
        save("favorites", on ? list : [...list, id]);
        S(!on);
        window.dispatchEvent(new Event("saved"));
      }}
    >
      <Bookmark size={18} fill={on ? "currentColor" : "none"} />
    </button>
  );
}
export function WorkerCard({ w, area }) {
  return (
    <article className="card">
      <Link
        to={
          "/worker/" + w.id + (area ? "?area=" + encodeURIComponent(area) : "")
        }
        className="stretch"
        aria-label={"View " + w.name + " profile"}
      />
      <div className="row">
        <Avatar w={w} />
        <Availability value={w.availability} />
      </div>
      <BookmarkButton id={w.id} />
      <h3>
        {w.name}{" "}
        {w.verified && (
          <BadgeCheck
            aria-label="Phone OTP verified"
            className="check"
            size={19}
          />
        )}
      </h3>
      <span className="skill">{w.skill}</span>
      {w.verified && (
        <small className="phonelabel">
          {w.id.startsWith("demo-") ? "Sample profile" : "Phone verified"}
        </small>
      )}
      <p className="place">
        <MapPin size={15} />
        {area && areasOf(w).includes(area) ? area : w.locality}, Mumbai
      </p>
      <div className="facts">
        <strong>{w.priceRange}</strong>
        <small>
          <Clock3 size={14} />
          {activity(w.lastSeen)}
        </small>
      </div>
      <Contact w={w} area={area} />
    </article>
  );
}
export function Share({ id }) {
  const [msg, M] = useState("");
  let url = portable
    ? location.href.split("#")[0] + "#/worker/" + id
    : location.origin + "/worker/" + id;
  return (
    <>
      <button
        className="btn light"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            M("Profile link copied");
          } catch {
            M(url);
          }
        }}
      >
        <Share2 size={16} />
        Share your profile link
      </button>
      {msg && <p role="status">{msg}</p>}
    </>
  );
}
export function Report({ w }) {
  const [msg, M] = useState(""),
    [open, O] = useState(false),
    [reason, R] = useState(reasons[0]),
    [busy, B] = useState(false);
  async function submit() {
    B(true);
    try {
      if (!live) {
        const row = demoWorkers().find((x) => x.id === w.id);
        demoReview(w.id, {
          reports: (row?.reports || 0) + 1,
          reportReason: reason,
        });
      } else if (w.id.startsWith("demo-")) {
        M("This is a sample profile.");
        O(false);
        return;
      } else
        await api("/worker/" + encodeURIComponent(w.id) + "/report", {
          method: "POST",
          body: { reason },
        });
      M("Report recorded for review.");
      O(false);
    } catch (e) {
      M(e.message);
    } finally {
      B(false);
    }
  }
  return (
    <>
      <button className="textbtn" onClick={() => O(!open)}>
        <Flag size={15} /> Report this profile
      </button>
      {open && (
        <label className="outcome">
          Reason
          <select value={reason} onChange={(e) => R(e.target.value)}>
            {reasons.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <button className="btn light" disabled={busy} onClick={submit}>
            Send report
          </button>
        </label>
      )}
      {msg && <p role="status">{msg}</p>}
    </>
  );
}
export function Skeleton() {
  return (
    <div className="grid" aria-label="Loading workers" aria-busy="true">
      {[1, 2, 3].map((i) => (
        <div className="card skeleton" key={i}>
          <i />
          <b />
          <span />
          <b />
          <span />
        </div>
      ))}
    </div>
  );
}
