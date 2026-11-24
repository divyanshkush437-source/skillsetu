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
import {
  navigate,
  portable,
  read,
  save,
  activity,
  api,
  live,
  route,
  waMessage,
} from "./data";
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
export function Contact({ w }) {
  // Name the household's searched locality (it may be a nearby one), not the worker's.
  const area = new URLSearchParams(route().search).get("locality");
  const href =
    area && w.whatsappLink
      ? w.whatsappLink.split("?")[0] +
        "?text=" +
        encodeURIComponent(waMessage(w.skill, area))
      : w.whatsappLink;
  return (
    <a className="contact" target="_blank" rel="noreferrer" href={href}>
      <MessageCircle size={19} />
      Contact on WhatsApp
      <ArrowUpRight size={16} />
    </a>
  );
}
export function Availability({ value }) {
  return (
    <span className={"status " + (!value ? "busy" : "")}>
      <i />
      {value ? "Available now" : "Not available"}
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
export function WorkerCard({ w }) {
  return (
    <article className="card">
      <Link
        to={"/worker/" + w.id}
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
      <p className="place">
        <MapPin size={15} />
        {w.locality}, Mumbai
      </p>
      <div className="facts">
        <strong>{w.priceRange}</strong>
        <small>
          <Clock3 size={14} />
          {activity(w.lastSeen)}
        </small>
      </div>
      <Contact w={w} />
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
  const [msg, M] = useState("");
  return (
    <>
      <button
        className="textbtn"
        onClick={async () => {
          if (!live || w.id.startsWith("demo-"))
            return M("This is a sample profile.");
          try {
            await api("/worker/" + w.id + "/report", { method: "POST" });
            M("Profile reported for review.");
          } catch (e) {
            M(e.message);
          }
        }}
      >
        <Flag size={15} /> Report this profile
      </button>
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
