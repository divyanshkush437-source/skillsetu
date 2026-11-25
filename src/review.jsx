import React, { useEffect, useState } from "react";
import { api, live, demoWorkers, demoReview, read } from "./data";
export default function Review({ user }) {
  const [data, set] = useState(null),
    [error, E] = useState(""),
    [busy, B] = useState(false);
  async function refresh() {
    E("");
    try {
      if (live) set(await api("/admin/workers", { user }));
      else {
        const counts = {};
        for (const x of Object.values(read("receipts", {})))
          if (x.at > Date.now() - 604800000)
            counts[x.outcome] = (counts[x.outcome] || 0) + 1;
        set({
          rows: demoWorkers().sort(
            (a, b) => (b.reports || 0) - (a.reports || 0),
          ),
          counts,
        });
      }
    } catch (e) {
      E(e.message);
    }
  }
  useEffect(() => {
    refresh();
  }, [user]);
  async function decide(w, decision) {
    B(true);
    try {
      if (live)
        await api("/admin/worker/" + encodeURIComponent(w.id), {
          method: "PATCH",
          user,
          body: { decision, reports: w.reports || 0, version: w.version || 0 },
        });
      else
        demoReview(w.id, {
          moderation: decision,
          reports: 0,
          reportReason: "",
        });
      await refresh();
    } catch (e) {
      E(e.message);
    } finally {
      B(false);
    }
  }
  return (
    <section className="formbox">
      <h2>Listing review</h2>
      {!live && <p>Demo reviewer · decisions affect this device only.</p>}
      {error && <p role="alert">{error}</p>}
      <button className="btn light" onClick={refresh}>
        Refresh queue
      </button>
      {data && (
        <>
          <h3>Enquiries in the last seven days</h3>
          <p>
            {Object.entries(data.counts)
              .map(([k, v]) => k + ": " + v)
              .join(" · ") || "No enquiries yet."}
          </p>
          <small>
            Latest self-reported stage per enquiry. Opening a contact does not
            confirm a sent message.
          </small>
          {data.rows.map((w) => (
            <article key={w.id} className="jobitem">
              <b>{w.name}</b>
              <p>
                {w.skill} · {w.locality} · {w.moderation || "active"}
              </p>
              {w.sharedContact && (
                <p>
                  Work number shared by multiple older listings. Check with the
                  owners.
                </p>
              )}
              {w.reports > 0 && (
                <p>
                  {w.reports} report(s) · {w.reason || w.reportReason}
                </p>
              )}
              <div className="actions">
                <button
                  className="btn light"
                  disabled={busy}
                  onClick={() => decide(w, "active")}
                >
                  {w.moderation === "hidden"
                    ? "Restore listing"
                    : "Approve listing"}
                </button>
                {w.moderation !== "hidden" && (
                  <button
                    className="btn light"
                    disabled={busy}
                    onClick={() => decide(w, "hidden")}
                  >
                    Hide listing
                  </button>
                )}
              </div>
            </article>
          ))}
        </>
      )}
    </section>
  );
}
