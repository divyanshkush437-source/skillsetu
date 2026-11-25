import React, { useState } from "react";
import { MessageCircle, ArrowUpRight } from "lucide-react";
import { api, live, read, save } from "./data";
import { areasOf, draftMessage } from "../backend/listing.mjs";
const statuses = [
  "Awaiting reply",
  "Received a quote",
  "Visit agreed",
  "Work completed",
  "No reply",
  "Cancelled or no-show",
];
export function Contact({ w, detail = false, area }) {
  const areas = areasOf(w);
  const [locality, L] = useState(areas.includes(area) ? area : w.locality),
    [task, T] = useState(""),
    [when, H] = useState("today"),
    [error, E] = useState(""),
    [busy, B] = useState(false);
  const local = !live || w.id.startsWith("demo-");
  const last = () =>
    Object.entries(read("receipts", {}))
      .reverse()
      .find(([, r]) => r.id === w.id && r.at > Date.now() - 604800000);
  const [receipt, R] = useState(last);
  const message = draftMessage(w.skill, locality, task, when);
  function remember(id, outcome) {
    const receipts = read("receipts", {});
    const value = { id: w.id, at: receipts[id]?.at || Date.now(), outcome };
    save("receipts", { ...receipts, [id]: value });
    R([id, value]);
  }
  async function open() {
    B(true);
    E("");
    try {
      const data = await api(
        "/worker/" + encodeURIComponent(w.id) + "/contact",
        { method: "POST" },
      );
      remember(data.receipt, "Opened contact");
      location.assign(data.url + "?text=" + encodeURIComponent(message));
    } catch (e) {
      E(e.message);
    } finally {
      B(false);
    }
  }
  async function feedback(outcome) {
    B(true);
    try {
      if (!local)
        await api("/enquiry/" + receipt[0], {
          method: "PATCH",
          body: { outcome },
        });
      remember(receipt[0], outcome);
      E("");
    } catch (e) {
      E(e.message);
    } finally {
      B(false);
    }
  }
  const caption = (
    <>
      <MessageCircle size={18} />
      Contact on WhatsApp
      <ArrowUpRight size={16} />
    </>
  );
  return (
    <>
      {detail && (
        <details className="messagebox">
          <summary>Customize your WhatsApp message</summary>
          <label>
            Work area
            <select value={locality} onChange={(e) => L(e.target.value)}>
              {areas.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            What needs fixing?
            <input
              maxLength={160}
              value={task}
              placeholder="e.g. leaking kitchen tap"
              onChange={(e) => T(e.target.value)}
            />
          </label>
          <label>
            When?
            <select value={when} onChange={(e) => H(e.target.value)}>
              {["today", "tomorrow", "this week"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <p>{message}</p>
        </details>
      )}
      <div className={detail ? "stickycontact" : ""}>
        {local ? (
          <a
            className="contact"
            target="_blank"
            rel="noreferrer"
            href={
              (w.whatsappLink || "").split("?")[0] +
              "?text=" +
              encodeURIComponent(message)
            }
            onClick={() => remember(crypto.randomUUID(), "Opened contact")}
          >
            {caption}
          </a>
        ) : (
          <button className="contact" disabled={busy} onClick={open}>
            {caption}
          </button>
        )}
      </div>
      {!detail && receipt && (
        <a
          className="followup"
          href={
            (window.SKILLSETU.portable ? "#" : "") +
            "/worker/" +
            encodeURIComponent(w.id)
          }
        >
          Update enquiry outcome
        </a>
      )}
      {detail && receipt && (
        <label className="outcome">
          How did your enquiry go?
          <select
            disabled={busy}
            value={receipt[1].outcome}
            onChange={(e) => feedback(e.target.value)}
          >
            <option value="Opened contact" disabled>
              Choose an outcome (optional)
            </option>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <small>Shared as a self-reported outcome for this enquiry.</small>
        </label>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
