import { useEffect, useRef, useState } from "react";
import { Onfido } from "onfido-sdk-ui";

const CONFIG = {
  backgrounds: {
    home: "/bank2.png",
    form: "/bank2.png",
    workflow: "/bank2.png",
  },
  navbars: {
    success: "/success-banner.png",
    failure: "/faile-banner.png",
  },
  supportPhone: "1 (800) 999-0000",
  referenceCode: "Onboarding Verification 05jx1-0fmt",
  autoRedirectMs: 5000,
};

// pune aici workflow_id-ul tău Onfido
const WORKFLOW_ID = "817363d2-dc4d-4385-9720-fed153278775";

/* ==== helper-e funcționale (fără impact vizual) ==== */
async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || JSON.stringify(data));
  return data;
}

// așteaptă până ajunge webhook-ul în backend (polling pe /api/webhook_runs/:runId)
async function waitForWebhook(runId, { tries = 60, intervalMs = 2000 } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const data = await fetchJSON(`/api/webhook_runs/${encodeURIComponent(runId)}`);
      return data; // webhook a sosit
    } catch {
      // 404 => încă nu a sosit, mai așteptăm
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Timeout waiting for webhook");
}

function OverlayCard({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[92svh] overflow-y-auto rounded-2xl border border-black/10 bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10">
          <h2 className="m-0 text-2xl font-extrabold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-bold shadow-sm hover:bg-gray-50 cursor-pointer"
            aria-label="Close"
          >
            Close
          </button>
        </div>
        {subtitle && <p className="px-6 pt-4 text-gray-600">{subtitle}</p>}
        <div className="px-6 pb-6 pt-4">{children}</div>
      </div>
    </div>
  );
}

function WhiteScreen({ title, subtitle, ok, danger, onBack, onRetry, navbarUrl }) {
  return (
    <div className="fixed inset-0 z-30 overflow-auto bg-white">
      {navbarUrl && (
        <div
          className="h-24 w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${navbarUrl})` }}
          aria-hidden="true"
        />
      )}
      <div className="mx-auto max-w-xl px-6 py-6">
        <h1 className="text-2xl font-extrabold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-2 text-gray-600">{subtitle}</p>}
        {ok && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
            ✓ Verification submitted. You can close this window.
          </div>
        )}
        {danger && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800">
            ⚠ {danger}
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={onBack}
            className="rounded-xl border border-black/10 bg-black px-4 py-2 font-bold text-white hover:opacity-95"
          >
            Back to home
          </button>
          {danger && (
            <button
              onClick={onRetry}
              className="rounded-xl border border-black/10 bg-white px-4 py-2 font-bold hover:bg-gray-50"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FullBg({ view, children, clickable = false, onActivate }) {
  const wantsBg = view === "home" || view === "form" || view === "workflow";
  const bg = CONFIG.backgrounds[view] || CONFIG.backgrounds.home;

  const handleKeyDown = (e) => {
    if (!clickable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate?.();
    }
  };

  if (!wantsBg || !bg) return <>{children}</>;

  return (
    <div
      className={
        "min-h-[100svh] bg-cover bg-center bg-no-repeat " +
        (clickable ? "cursor-pointer outline-none" : "")
      }
      style={{ backgroundImage: `url(${bg})` }}
      onClick={clickable ? onActivate : undefined}
      onKeyDown={clickable ? handleKeyDown : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? "Start identity verification" : undefined}
      title={clickable ? "Click to start identity verification" : undefined}
    >
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="grid grid-cols-1 gap-1 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-3">
      <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="sm:col-span-2 text-gray-900">{String(value ?? "—")}</div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("home"); // "home" | "form" | "workflow" | "approved" | "failed" | "error" | "final"
  const [firstName, setFirstName] = useState("Razvan");
  const [lastName, setLastName] = useState("Blaga");
  const [email, setEmail] = useState("razvanblaga10@gmail.com");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [runId, setRunId] = useState(null);
  const [finalData, setFinalData] = useState(null); // datele finale pentru afișare

  const onfidoRef = useRef(null);
  const redirectTimerRef = useRef(null);

  // shortcuts demo optional (nemodificat)
  useEffect(() => {
    const url = new URL(window.location.href);
    const force = (url.searchParams.get("force") || "").toLowerCase();
    if (!force) return;
    if (force === "approved") {
      setView("approved");
      // păstrăm UI-ul tău exact — nu mai facem redirect automat
    } else if (force === "failed") {
      setErrorMsg("Outcome: failed (demo)");
      setView("failed");
    } else if (force === "final") {
      setFinalData({
        status: "approved",
        first_name: "Razvan",
        last_name: "Blaga",
        gender: "M",
        date_of_birth: "1992-06-15",
        document_number: "RO1234567",
        document_type: "passport",
        date_expiry: "2032-06-15",
        workflow_run_id: "demo123"
      });
      setView("final");
    }
  }, []);

  // funcția ta originală — o lăsăm, dar nu o mai apelăm după onComplete
  function startRedirectCountdown() {
    clearTimeout(redirectTimerRef.current);
    redirectTimerRef.current = setTimeout(() => {
      if (runId) {
        loadFinalData(runId);
      } else {
        setErrorMsg("Missing workflow run id");
        setView("error");
      }
    }, CONFIG.autoRedirectMs);
  }

  // luăm rezultatele finale din backend (după ce a venit webhook-ul)
  async function loadFinalData(id) {
    try {
      const res = await fetch(`/api/workflow_runs/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || JSON.stringify(data));

      if ((data?.status || "").toLowerCase() !== "approved") {
        setErrorMsg(`Status: ${data?.status || "unknown"}`);
        setView("failed");
        return;
      }

      setFinalData({
        status: data.status,
        first_name: data.first_name,
        last_name: data.last_name,
        gender: data.gender,
        date_of_birth: data.date_of_birth,
        document_type: data.document_type,
        document_number: data.document_number,
        date_expiry: data.date_expiry,
        workflow_run_id: data.workflow_run_id,
        dashboard_url: data.dashboard_url
      });
      setView("final");
    } catch (e) {
      setErrorMsg(e.message || String(e));
      setView("error");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      // 1) creează applicant
      const a = await fetch(`/api/applicants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, email }),
      });
      const applicant = await a.json();
      if (!a.ok) throw new Error(applicant?.error || JSON.stringify(applicant));

      // 2) creează workflow_run
      const r = await fetch(`/api/workflow_runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow_id: WORKFLOW_ID, applicant_id: applicant.id }),
      });
      const run = await r.json();
      if (!r.ok) throw new Error(run?.error || JSON.stringify(run));

      setRunId(run.id);
      setView("workflow");

      // 3) pornește SDK Onfido
      onfidoRef.current?.tearDown?.();
      onfidoRef.current = Onfido.init({
        token: run.sdk_token,
        workflowRunId: run.id,
        containerId: "onfido-mount",
        onComplete: async () => {
          setView("approved"); // păstrăm ecranul tău "approved"
          try {
            // AICI e schimbarea: așteptăm să vină webhook-ul în backend
            await waitForWebhook(run.id);
            // apoi luăm datele finale din backend (nume, doc, dob, etc.)
            await loadFinalData(run.id);
          } catch (err) {
            setErrorMsg(err.message || String(err));
            setView("error");
          }
        },
        onError: (err) => {
          console.error("Onfido error:", err);
          setErrorMsg(err?.message || "Something went wrong.");
          setView("error");
        },
      });
    } catch (err) {
      setErrorMsg(err.message || String(err));
      setView("error");
    } finally {
      setLoading(false);
    }
  }

  function closeAndCleanup() {
    onfidoRef.current?.tearDown?.();
    onfidoRef.current = null;
    clearTimeout(redirectTimerRef.current);
    setView("home");
    setRunId(null);
    setErrorMsg("");
    setFinalData(null);
  }

  useEffect(() => {
    return () => closeAndCleanup();
  }, []);

  const startForm = () => setView("form");

  return (
    <FullBg view={view} clickable={view === "home"} onActivate={startForm}>
      <div className="min-h-[100svh]">
        {/* FORM / WORKFLOW modal */}
        {(view === "form" || view === "workflow") && (
          <OverlayCard
            title={view === "form" ? "Applicant details" : "Verify your identity"}
            onClose={closeAndCleanup}
          >
            {view === "form" ? (
              <form onSubmit={handleSubmit} className="grid gap-4">
                <label className="font-bold">
                  First name
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-black focus:outline-none"
                  />
                </label>
                <label className="font-bold">
                  Last name
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-black focus:outline-none"
                  />
                </label>
                <label className="font-bold">
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-black focus:outline-none"
                  />
                </label>

                <div className="mt-2 flex gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="min-w-[220px] rounded-xl border border-black/10 bg-black px-5 py-3 font-extrabold text-white shadow-sm hover:opacity-95 disabled:opacity-60 cursor-pointer"
                  >
                    {loading ? "Submitting…" : "Create & start workflow"}
                  </button>
                </div>
              </form>
            ) : (
              <div id="onfido-mount" className="min-h-[480px]" />
            )}
          </OverlayCard>
        )}

        {/* APPROVED */}
        {view === "approved" && (
          <WhiteScreen
            title="Everything looks perfect!"
            subtitle={`You're approved. Redirecting in ${Math.floor(CONFIG.autoRedirectMs / 1000)} seconds…`}
            ok
            navbarUrl={CONFIG.navbars.success}
            onBack={closeAndCleanup}
          />
        )}

        {/* FAILED */}
        {view === "failed" && (
          <WhiteScreen
            title="We need to do further verification"
            subtitle={
              <span>
                Please call us at <span className="font-bold">{CONFIG.supportPhone}</span> and reference
                <span className="font-bold"> {CONFIG.referenceCode}</span>.
              </span>
            }
            danger={errorMsg || "Verification did not pass."}
            navbarUrl={CONFIG.navbars.failure}
            onBack={closeAndCleanup}
            onRetry={() => {
              setView("form");
              setErrorMsg("");
            }}
          />
        )}

        {/* ERROR */}
        {view === "error" && (
          <WhiteScreen
            title="Something went wrong"
            subtitle="We couldn't complete your verification."
            danger={errorMsg}
            onBack={closeAndCleanup}
            onRetry={() => {
              setView("form");
              setErrorMsg("");
            }}
          />
        )}

        {/* FINAL PAGE */}
        {view === "final" && finalData && (
          <div className="mx-auto my-10 w-full max-w-3xl px-4">
            <div className="mb-6 flex items-center justify-between">
              <h1 className="text-3xl font-extrabold tracking-tight">You're approved ✅</h1>
              <button
                onClick={closeAndCleanup}
                className="rounded-xl border border-black/10 bg-white px-4 py-2 font-bold shadow-sm hover:bg-gray-50"
              >
                Back to home
              </button>
            </div>

            <p className="mb-6 text-gray-700">
              Here is a summary of the details we extracted from your document. If anything looks off,
              please contact support.
            </p>

            <div className="grid gap-4">
              <InfoRow label="Verification status" value={finalData.status} />
              <InfoRow label="Full name" value={`${finalData.first_name ?? ""} ${finalData.last_name ?? ""}`} />
              <InfoRow label="Gender" value={finalData.gender} />
              <InfoRow label="Date of birth" value={finalData.date_of_birth} />
              <InfoRow label="Document number" value={finalData.document_number} />
              <InfoRow label="Document type" value={finalData.document_type} />
              <InfoRow label="Date of expiry" value={finalData.date_expiry} />
              {finalData.workflow_run_id && (
                <InfoRow label="Workflow run" value={finalData.workflow_run_id} />
              )}
            </div>

            {finalData.dashboard_url && (
              <div className="mt-6">
                <a
                  className="inline-block rounded-xl border border-black/10 bg-white px-4 py-2 font-bold shadow-sm hover:bg-gray-50"
                  href={finalData.dashboard_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Onfido Dashboard
                </a>
              </div>
            )}
          </div>
        )}

        {/* home view hint */}
        {view === "home" && (
          <div className="pointer-events-none fixed inset-0 flex items-end justify-center p-6">
            <div className="rounded-xl bg-white/80 px-4 py-2 text-sm font-semibold shadow-sm">
              Click anywhere to start verification
            </div>
          </div>
        )}
      </div>
    </FullBg>
  );
}
