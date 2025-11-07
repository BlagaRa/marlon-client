import { useEffect, useRef, useState } from "react";
import { Onfido } from "onfido-sdk-ui";

const CONFIG = {
  backgrounds: { home: "/bank2.png", form: "/bank2.png", workflow: "/bank2.png" },
  navbars: { success: "/success-banner.png", failure: "/faile-banner.png" },
  supportPhone: "1 (800) 999-0000",
  referenceCode: "Onboarding Verification 05jx1-0fmt",
  autoRedirectMs: 5000,
};

const WORKFLOW_ID = import.meta.env.VITE_WORKFLOW_ID || "";
const API_ORIGIN = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const api = (path) => `${API_ORIGIN}${path}`;

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || JSON.stringify(data));
  return data;
}

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
      className={"min-h-[100svh] bg-cover bg-center bg-no-repeat " + (clickable ? "cursor-pointer outline-none" : "")}
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
  const [view, setView] = useState("home");
  const [firstName, setFirstName] = useState("Razvan");
  const [lastName, setLastName] = useState("Blaga");
  const [email, setEmail] = useState("razvanblaga10@gmail.com");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [runId, setRunId] = useState(null);
  const [finalData, setFinalData] = useState(null);

  const onfidoRef = useRef(null);
  const redirectTimerRef = useRef(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const force = (url.searchParams.get("force") || "").toLowerCase();
    if (!force) return;
    if (force === "approved") {
      setFinalData({
        status: "approved",
        full_name: "Razvan Blaga",
        dob: "1992-06-15",
        document_number: "RO1234567",
        document_type: "passport",
        date_expiry: "2032-06-15",
        workflow_run_id: "demo123",
      });
      setView("final");
    } else if (force === "failed") {
      setFinalData({
        status: "review",
        full_name: "Razvan Blaga",
        dob: "1992-06-15",
        document_number: "RO1234567",
        document_type: "passport",
        date_expiry: "2032-06-15",
        workflow_run_id: "demo123",
      });
      setView("final");
    }
  }, []);

  function startRedirectCountdown() {
    clearTimeout(redirectTimerRef.current);
    redirectTimerRef.current = setTimeout(() => {
      if (runId) loadFinalData(runId);
      else {
        setErrorMsg("Missing workflow run id");
        setView("error");
      }
    }, CONFIG.autoRedirectMs);
  }

  async function loadFinalData(id) {
    try {
      const [runData, webhookData] = await Promise.all([
        fetchJSON(api(`/api/workflow_runs/${encodeURIComponent(id)}`)),
        fetchJSON(api(`/api/webhook_runs/${encodeURIComponent(id)}`)).catch(() => null),
      ]);

      setFinalData({
        status: runData.status,
        full_name: runData.full_name ?? null,
        address: runData.address ?? null,
        gender: runData.gender ?? null,
        dob: runData.dob ?? null,
        document_type: runData.document_type ?? null,
        document_number: runData.document_number ?? null,
        date_expiry: runData.date_expiry ?? null,
        workflow_run_id: runData.workflow_run_id,
        dashboard_url: runData.dashboard_url,
        webhook: webhookData || null,
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
      const applicant = await fetchJSON(api(`/api/applicants`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, email }),
      });

      const run = await fetchJSON(api(`/api/workflow_runs`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow_id: WORKFLOW_ID, applicant_id: applicant.id }),
      });

      setRunId(run.id);
      setView("workflow");

      onfidoRef.current?.tearDown?.();
      onfidoRef.current = Onfido.init({
        token: run.sdk_token,
        workflowRunId: run.id,
        containerId: "onfido-mount",
        onComplete: async () => {
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

        {view === "pending" && (
          <WhiteScreen
            title="Thank you for uploading"
            subtitle="We are currently verifying your information. This may take a few minutes."
            ok
            navbarUrl={CONFIG.navbars.success}
            onBack={closeAndCleanup}
          />
        )}

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
              <InfoRow
                label="Full name"
                value={
                  finalData.full_name
                    || `${firstName} ${lastName}`.trim()
                }
              />
              {finalData.address && <InfoRow label="Address" value={finalData.address} />}

              <InfoRow label="Verification status" value={finalData.status} />
              <InfoRow label="Gender" value={finalData.gender} />
              <InfoRow label="Date of birth" value={finalData.dob} />
              <InfoRow label="Document number" value={finalData.document_number} />
              <InfoRow label="Document type" value={finalData.document_type} />
              <InfoRow label="Date of expiry" value={finalData.date_expiry} />
              {finalData.workflow_run_id && <InfoRow label="Workflow run" value={finalData.workflow_run_id} />}
            </div>

            {finalData.webhook && (
              <div className="mt-8">
                <h2 className="text-xl font-extrabold mb-2">Webhook payload</h2>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 overflow-x-auto">
                  <pre className="text-xs leading-snug">
{JSON.stringify(finalData.webhook.raw_payload || finalData.webhook, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </FullBg>
  );
}
