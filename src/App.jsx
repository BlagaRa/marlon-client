import { useRef, useState } from "react";
import { Onfido } from "onfido-sdk-ui";

const CONFIG = {
  backgrounds: { home: "/bank2.png", form: "/bank2.png", workflow: "/bank2.png" },
  navbars: { success: "/results-banner.png", failure: "/results-banner.png" },
  supportPhone: "1 (800) 999-0000",
  referenceCode: "Onboarding Verification 05jx1-0fmt",
};

const WORKFLOW_ID = import.meta.env.VITE_WORKFLOW_ID || "";
const API_ORIGIN = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const api = (path) => `${API_ORIGIN}${path}`;

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.error || "Request failed"), { details: data?.details });
  return data;
}

async function waitForWebhook(runId, { tries = 200, intervalMs = 2000 } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const data = await fetchJSON(api(`/api/webhook_runs/${encodeURIComponent(runId)}`));
      
      if (data && Object.keys(data.raw_output || {}).length > 0) {
          if(data.raw_output.sub_result) return data;
          
          const status = (data.status || "").toLowerCase();
          if (["approved", "declined", "review", "abandoned", "completed"].includes(status)) {
             return data;
          }
      }
    } catch {}
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Timeout waiting for completion");
}

function OverlayCard({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 backdrop-blur-sm p-4 overflow-x-hidden">
      <div className="w-full max-w-2xl max-h-[98svh] h-fit overflow-y-auto rounded-3xl border border-white/40 bg-white/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/5">
          <h2 className="m-0 text-2xl font-extrabold text-gray-900 tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-gray-100 px-3 py-2 text-sm font-bold text-gray-600 transition hover:bg-gray-200 cursor-pointer"
          >
            Close
          </button>
        </div>
        {subtitle && <p className="px-6 pt-4 text-gray-600 font-medium">{subtitle}</p>}
        <div className="px-6 pb-6 pt-6">{children}</div>
      </div>
    </div>
  );
}

function WhiteScreen({ title, subtitle, danger, onBack, onRetry, navbarUrl, children }) {
  return (
    <div className="fixed inset-0 z-30 overflow-x-hidden overflow-y-auto bg-gray-50">
      {navbarUrl && (
        <img src={navbarUrl} alt="Banner" className="w-full h-auto block shadow-sm" />
      )}
      
      <div className="mx-auto max-w-xl px-4 py-8 w-full">
        <h1 className="text-3xl font-extrabold text-gray-900 break-words tracking-tight">{title}</h1>
        
        {danger && (
          <div className="mt-4 mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 font-bold break-words shadow-sm flex items-start gap-2">
            <span>⚠</span>
            {danger}
          </div>
        )}

        {subtitle && <p className="mt-2 text-lg text-gray-600 break-words leading-relaxed">{subtitle}</p>}
        
        <div className="mt-6 flex gap-3 flex-wrap">
          <button
            onClick={onBack}
            className="rounded-xl bg-gray-900 px-6 py-3 font-bold text-white shadow-lg shadow-gray-900/20 hover:bg-black transition-all hover:-translate-y-0.5"
          >
            Back to home
          </button>
          {danger && (
            <button
              onClick={onRetry}
              className="rounded-xl border border-gray-200 bg-white px-6 py-3 font-bold text-gray-900 hover:bg-gray-50 transition-all"
            >
              Try again
            </button>
          )}
        </div>
      </div>

      {children && (
        <div className="mx-auto my-6 w-full max-w-3xl px-4 pb-20">
          {children}
        </div>
      )}
    </div>
  );
}

function FullBg({ view, children, clickable = false, onActivate }) {
  const wantsBg = view === "home" || view === "form" || view === "workflow";
  const bg = { home: "/bank2.png", form: "/bank2.png", workflow: "/bank2.png" }[view] || "/bank2.png";
  if (!wantsBg) return <>{children}</>;
  return (
    <div
      className="min-h-[100svh] w-full bg-cover bg-center bg-no-repeat cursor-pointer overflow-x-hidden transition-all duration-700"
      style={{ backgroundImage: `url(${bg})` }}
      onClick={clickable ? onActivate : undefined}
    >
      {children}
    </div>
  );
}

// 3. Result Badge - Updated Colors & Logic
function ResultBadge({ value }) {
  const normalized = (value || "").toLowerCase();
  const label = value ? value.charAt(0).toUpperCase() + value.slice(1) : "—";

  // GREEN: Approved, Clear
  if (normalized === "clear" || normalized === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        {label}
      </span>
    );
  } 
  
  // YELLOW/ORANGE: Review, Consider, Suspected
  else if (["review", "consider", "suspected"].includes(normalized)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-sm">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        {label}
      </span>
    );
  }

  // RED: Declined, Rejected, Abandoned
  else if (["declined", "rejected", "abandoned"].includes(normalized)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-rose-100 text-rose-800 border border-rose-200 shadow-sm">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        {label}
      </span>
    );
  }

  // DEFAULT / UNKNOWN
  return <span className="text-gray-400 font-normal">{label}</span>;
}

function InfoRow({ label, value, isBadge }) {
  return (
    <div className="grid grid-cols-1 gap-1 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:grid-cols-3 items-center w-full transition hover:border-gray-300">
      <div className="text-xs font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">{label}</div>
      <div className="sm:col-span-2 text-gray-900 font-medium break-all">
        {isBadge ? <ResultBadge value={value} /> : String(value ?? "—")}
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("home"); 
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isUsCitizen, setIsUsCitizen] = useState("no");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [finalData, setFinalData] = useState(null);

  const onfidoRef = useRef(null);

  async function loadFinalData(id) {
    const [runData, webhookData] = await Promise.all([
      fetchJSON(api(`/api/workflow_runs/${encodeURIComponent(id)}`)),
      fetchJSON(api(`/api/webhook_runs/${encodeURIComponent(id)}`)).catch(() => null),
    ]);

    const combinedOutput = {
      ...(runData.output || {}),
      ...(webhookData?.raw_output || {}),
    };
    
    const addrObj = combinedOutput.address_lines || combinedOutput.address;

    setFinalData({
      status: runData.status,
      sub_result: combinedOutput.sub_result, 
      full_name: runData.full_name || [combinedOutput.first_name, combinedOutput.last_name].filter(Boolean).join(" ") || [runData.first_name, runData.last_name].filter(Boolean).join(" "),
      workflow_run_id: runData.workflow_run_id,
      webhook: webhookData || null,
      address: addrObj,
      gender: combinedOutput.gender,
      dob: combinedOutput.dob || combinedOutput.date_of_birth,
      document_number: combinedOutput.document_number,
      document_type: combinedOutput.document_type,
      date_expiry: combinedOutput.date_expiry || combinedOutput.date_of_expiry,
    });
    setView("final");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const rawPhone = phone.trim();

      const applicant = await fetchJSON(api(`/api/applicants`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          phone_number: rawPhone 
        }),
      });

      const run = await fetchJSON(api(`/api/workflow_runs`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow_id: WORKFLOW_ID, applicant_id: applicant.id }),
      });

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
            setErrorMsg(err?.message || "Something went wrong.");
            setView("error");
          }
        },
        onError: (err) => {
          setErrorMsg(err?.message || "Something went wrong.");
          setView("error");
        },
      });
    } catch (err) {
      setErrorMsg(err?.message || "Something went wrong.");
      setView("error");
    } finally {
      setLoading(false);
    }
  }

  function closeAndCleanup() {
    onfidoRef.current?.tearDown?.();
    onfidoRef.current = null;
    setView("home");
    setErrorMsg("");
    setFinalData(null);
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setIsUsCitizen("no");
  }

  const computedFullName = finalData?.full_name || [firstName, lastName].filter(Boolean).join(" ");
  const breakdown = finalData?.webhook?.breakdown || {};
  const visualAuth = breakdown?.visual_authenticity?.result;
  const digitalTampering = breakdown?.visual_authenticity?.breakdown?.digital_tampering?.result;
  const securityFeatures = breakdown?.visual_authenticity?.breakdown?.security_features?.result;

  let addressStr = "—";
  if (finalData?.address) {
    if (typeof finalData.address === "object") {
        const { town, state, postcode, country } = finalData.address;
        addressStr = [town, state, postcode, country].filter(Boolean).join(", ");
    } else if (typeof finalData.address === "string") {
        const parts = finalData.address.split(",").map(s => s.trim());
        if (parts.length > 3) {
            addressStr = parts.slice(1).join(", "); 
        } else {
            addressStr = finalData.address;
        }
    }
  }

  const subResultVal = (finalData?.sub_result || "").toLowerCase();
  const isClear = subResultVal === "clear";
  const errorReason = (!isClear ? "Verification requires manual review." : undefined);

  return (
    <FullBg view={view} clickable={view === "home"} onActivate={() => setView("form")}>
      <div className="min-h-[100svh] w-full overflow-x-hidden">
        {(view === "form" || view === "workflow") && (
          <OverlayCard
            title={view === "form" ? "Applicant details" : "Verify your identity"}
            onClose={closeAndCleanup}
          >
            {view === "form" ? (
              <form onSubmit={handleSubmit} className="grid gap-6 w-full">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <label className="block">
                    <span className="block text-sm font-bold text-gray-700 mb-1">First name</span>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="w-full rounded-xl border-gray-300 px-4 py-3 text-base shadow-sm focus:border-black focus:ring-black transition"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-sm font-bold text-gray-700 mb-1">Last name</span>
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className="w-full rounded-xl border-gray-300 px-4 py-3 text-base shadow-sm focus:border-black focus:ring-black transition"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <label className="block">
                    <span className="block text-sm font-bold text-gray-700 mb-1">Email</span>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-xl border-gray-300 px-4 py-3 text-base shadow-sm focus:border-black focus:ring-black transition"
                    />
                    </label>
                    
                    <label className="block">
                    <span className="block text-sm font-bold text-gray-700 mb-1">Phone Number</span>
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+15551234567"
                        required
                        className="w-full rounded-xl border-gray-300 px-4 py-3 text-base shadow-sm focus:border-black focus:ring-black transition"
                    />
                    </label>
                </div>

                <label className="block">
                    <span className="block text-sm font-bold text-gray-700 mb-1">Are you a US Citizen?</span>
                    <select
                        value={isUsCitizen}
                        onChange={(e) => setIsUsCitizen(e.target.value)}
                        className="w-full rounded-xl border-gray-300 px-4 py-3 text-base shadow-sm focus:border-black focus:ring-black bg-white transition"
                    >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                    </select>
                </label>

                <div className="mt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto rounded-xl bg-gray-900 px-8 py-4 font-extrabold text-white shadow-lg shadow-gray-900/20 hover:bg-black hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? "Submitting…" : "Create & start workflow"}
                  </button>
                </div>
              </form>
            ) : (
              <div id="onfido-mount" className="min-h-[600px] w-full" />
            )}
          </OverlayCard>
        )}

        {view === "pending" && (
          <WhiteScreen
            title="Thank you for uploading"
            subtitle="We are currently verifying your information. This may take a few minutes."
            navbarUrl={CONFIG.navbars.success}
            onBack={closeAndCleanup}
          >
             <div className="flex justify-center mt-12 mb-8">
                <svg className="animate-spin h-10 w-10 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
             </div>
          </WhiteScreen>
        )}

        {view === "error" && (
          <WhiteScreen
            title="Something went wrong"
            subtitle="We couldn't complete your verification."
            danger={errorMsg}
            navbarUrl={CONFIG.navbars.failure}
            onBack={closeAndCleanup}
            onRetry={() => {
              setView("form");
              setErrorMsg("");
            }}
          />
        )}

        {view === "final" && finalData && (
          <WhiteScreen
            title={isClear ? "You're approved ✅" : "Process Complete"}
            subtitle={
              isClear
                ? "Your verification looks good."
                : `Please call us at ${CONFIG.supportPhone} and reference ${CONFIG.referenceCode}.`
            }
            navbarUrl={isClear ? CONFIG.navbars.success : CONFIG.navbars.failure}
            onBack={closeAndCleanup}
            onRetry={!isClear ? () => setView("form") : undefined}
            danger={!isClear ? errorReason : undefined}
          >
            <div className="grid gap-3 w-full">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Detailed Results</h3>
              {/* UPDATED: Verification Result now uses the colored badge */}
              <InfoRow label="Verification Result" value={finalData.status} isBadge />
              <InfoRow label="Sub-Result" value={finalData.sub_result} isBadge />
              <InfoRow label="Visual Authenticity" value={visualAuth} isBadge />
              <InfoRow label="Digital Tampering" value={digitalTampering} isBadge />
              <InfoRow label="Security Features" value={securityFeatures} isBadge />

              <div className="my-6 border-t border-gray-100"></div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">Personal Data</h3>
              <InfoRow label="Full name" value={computedFullName || "—"} />
              <InfoRow label="Address" value={addressStr} />
              <InfoRow label="Gender" value={finalData.gender} />
              <InfoRow label="Date of birth" value={finalData.dob} />
              <InfoRow label="Document number" value={finalData.document_number} />
              <InfoRow label="Document type" value={finalData.document_type} />
              <InfoRow label="Date of expiry" value={finalData.date_expiry} />
            </div>
          </WhiteScreen>
        )}
      </div>
    </FullBg>
  );
}
