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

// ENV
const WORKFLOW_ID = import.meta.env.VITE_WORKFLOW_ID || "";
const API_ORIGIN = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const api = (path) => `${API_ORIGIN}${path}`;

/* ==== helpers ==== */
async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || JSON.stringify(data));
  return data;
}

// așteaptă până ajunge webhook-ul (poll pe /api/webhook_runs/:runId)
async function waitForWebhook(runId, { tries = 100, intervalMs = 5000 } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const data = await fetchJSON(api(`/api/webhook_runs/${encodeURIComponent(runId)}`));
      return data;
    } catch {}
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
  const [view, setView] = useState("home"); // home | form | workflow | pending | error | final
  const [firstName, setFirstName] = useState("Razvan");
  const [lastName, setLastName] = useState("Blaga");
  const [email, setEmail] = useState("razvanblaga10@gmail.com");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [runId, setRunId] = useState(null);
  const [finalData, setFinalData] = useState(null);

  const onfidoRef = useRef(null);
  const redirectTimerRef = useRef(null);

  // shortcuts demo (nemodificate vizual)
  useEffect(() => {
    const url = new URL(window.location.href);
    const force = (url.searchParams.get("force") || "").toLowerCase();
    if (!force) return;
    if (force === "approved") {
      // doar pentru demo: sari direct la final „approved”
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
    } else if (force === "failed") {
      setFinalData({
        status: "review",
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

  async function loadFinalData(id) {
    try {
      const data = await fetchJSON(api(`/api/workflow_runs/${encodeURIComponent(id)}`));

      // mereu mergem la pagina cu DETALII.
      // dacă status !== approved, afișăm un banner roșu pe aceeași pagină (demo)
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
      // 1) applicant
      const applicant = await fetchJSON(api(`/api/applicants`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, email }),
      });

      // 2) workflow_run
      const run = await fetchJSON(api(`/api/workflow_runs`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow_id: WORKFLOW_ID, applicant_id: applicant.id }),
      });

      setRunId(run.id);
      setView("workflow");

      // 3) Onfido SDK
      onfidoRef.current?.tearDown?.();
      onfidoRef.current = Onfido.init({
        token: run.sdk_token,
        workflowRunId: run.id,
        containerId: "onfido-mount",
        onComplete: async () => {
          // ecran clar după upload – verificăm în fundal
          setView("pending");
          try {
            await waitForWebhook(run.id);
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

  const isApproved = (finalData?.status || "").toLowerCase() === "approved";

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

        {/* PENDING (mesaj clar după upload) */}
        {view === "pending" && (
          <WhiteScreen
            title="Thank you for uploading"
            subtitle="We are currently verifying your information. This may take a few minutes."
            ok
            navbarUrl={CONFIG.navbars.success}
            onBack={closeAndCleanup}
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

        {/* FINAL PAGE — arată detaliile indiferent de status (demo) */}
        {view === "final" && finalData && (
          <div className="mx-auto my-10 w-full max-w-3xl px-4">
            <div className="mb-6 flex items-center justify-between">
              <h1 className="text-3xl font-extrabold tracking-tight">
                {isApproved ? "You're approved ✅" : "We need to do further verification"}
              </h1>
              <button
                onClick={closeAndCleanup}
                className="rounded-xl border border-black/10 bg-white px-4 py-2 font-bold shadow-sm hover:bg-gray-50"
              >
                Back to home
              </button>
            </div>

            {!isApproved && (
              <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
                <p className="font-semibold">Status: {finalData.status ?? "unknown"}</p>
                <p className="text-sm mt-1">
                  Please call us at <span className="font-bold">{CONFIG.supportPhone}</span> and reference
                  <span className="font-bold"> {CONFIG.referenceCode}</span>.
                </p>
              </div>
            )}

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

      </div>
    </FullBg>
  );
}
