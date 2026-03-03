import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Upload, Loader2, FileText, ShieldCheck, Trash2, Plus } from "lucide-react";
import { mediaUrl } from "@/lib/utils";
import { uploadAPI, authAPI } from "@/lib/api";
import { toast } from "sonner";

const COACH_DOC_SLOTS = [
  { key: "government_id", label: "Government ID (Aadhaar / PAN / Passport)", type: "document", required: true },
  { key: "coaching_certification", label: "Coaching Certification (NIS / AIFF / NCA / ICC)", type: "document", required: true },
  { key: "federation_membership", label: "Sport Federation Membership Card", type: "document", required: true },
  { key: "profile_photo", label: "Professional Photo", type: "image", required: true },
  { key: "playing_experience", label: "Playing Experience Proof", type: "document", required: false },
  { key: "first_aid_certificate", label: "First Aid / CPR Certificate", type: "document", required: false },
  { key: "fitness_certificate", label: "Fitness Certificate", type: "document", required: false },
  { key: "background_check", label: "Background / Police Check", type: "document", required: false },
  { key: "qualification_proof", label: "Qualification Proof (10+2 / Graduation)", type: "document", required: false },
  { key: "experience_letters", label: "Previous Coaching Experience Letters", type: "document", multiple: true, required: false },
];

export function CoachDocumentsTab({ user, updateUser }) {
  const [docs, setDocs] = useState(user?.coach_verification_documents || {});
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submittingDocs, setSubmittingDocs] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const docStatus = user?.doc_verification_status || "not_uploaded";

  const handleDocUpload = async (slotKey, files) => {
    if (!files || files.length === 0) return;
    setUploadingDoc(slotKey);
    setUploadProgress(0);
    try {
      const onProgress = (e) => {
        if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      };
      const slotDef = COACH_DOC_SLOTS.find(s => s.key === slotKey);

      if (slotDef?.multiple) {
        const existing = Array.isArray(docs[slotKey]) ? docs[slotKey] : [];
        const uploaded = [];
        for (const file of files) {
          const res = await uploadAPI.document(file, onProgress);
          uploaded.push({ url: res.data.url, uploaded_at: new Date().toISOString() });
        }
        const merged = [...existing, ...uploaded];
        const newDocs = { ...docs, [slotKey]: merged };
        setDocs(newDocs);
        await authAPI.updateCoachVerificationDocs({ [slotKey]: merged });
      } else {
        const file = files[0];
        const res = slotDef?.type === "image"
          ? await uploadAPI.image(file, onProgress)
          : await uploadAPI.document(file, onProgress);
        const docData = { url: res.data.url, uploaded_at: new Date().toISOString() };
        const newDocs = { ...docs, [slotKey]: docData };
        setDocs(newDocs);
        await authAPI.updateCoachVerificationDocs({ [slotKey]: docData });
      }
      toast.success("Uploaded successfully!");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Upload failed");
    } finally {
      setUploadingDoc(null);
      setUploadProgress(0);
    }
  };

  const handleRemoveDoc = async (slotKey, index) => {
    const slotDef = COACH_DOC_SLOTS.find(s => s.key === slotKey);
    let newVal;
    if (slotDef?.multiple) {
      const current = Array.isArray(docs[slotKey]) ? docs[slotKey] : [];
      newVal = current.filter((_, i) => i !== index);
    } else {
      newVal = null;
    }
    const newDocs = { ...docs, [slotKey]: newVal };
    setDocs(newDocs);
    await authAPI.updateCoachVerificationDocs({ [slotKey]: newVal }).catch(() => {});
    toast.success("Document removed");
  };

  const handleSubmitForReview = async () => {
    setSubmittingDocs(true);
    try {
      const res = await authAPI.updateCoachVerificationDocs({ submit: true });
      updateUser(res.data);
      toast.success("Documents submitted for review!");
    } catch (err) {
      toast.error("Failed to submit documents");
    } finally {
      setSubmittingDocs(false);
    }
  };

  const allRequiredDocsUploaded = COACH_DOC_SLOTS.filter(s => s.required).every(s => docs[s.key]?.url);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display font-bold text-lg flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-brand-100 dark:bg-brand-900">
            <ShieldCheck className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          </div>
          Verification Documents
        </h3>
        {docStatus === "verified" && (
          <span className="px-3 py-1.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-semibold uppercase tracking-wider rounded-full">
            Verified
          </span>
        )}
        {docStatus === "pending_review" && (
          <span className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-semibold uppercase tracking-wider rounded-full">
            Under Review
          </span>
        )}
        {docStatus === "rejected" && (
          <span className="px-3 py-1.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-xs font-semibold uppercase tracking-wider rounded-full">
            Rejected
          </span>
        )}
      </div>

      {docStatus === "rejected" && user?.doc_rejection_reason && (
        <div className="p-4 bg-red-50 dark:bg-red-950 border-2 border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
          <strong className="font-semibold">Rejection reason:</strong> {user.doc_rejection_reason}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Upload required documents to get verified. <span className="text-red-500 font-semibold">*</span> marks mandatory.
      </p>

      <div className="space-y-4">
        {COACH_DOC_SLOTS.map(slot => {
          const doc = docs[slot.key];
          const isUploaded = slot.multiple ? (Array.isArray(doc) && doc.length > 0) : !!doc?.url;
          const isUploading = uploadingDoc === slot.key;
          const isPdf = !slot.multiple && doc?.url?.toLowerCase().endsWith(".pdf");

          return (
            <div
              key={slot.key}
              className={`rounded-xl bg-card border shadow-sm p-5 transition-colors ${
                isUploaded
                  ? "border-green-500/30 bg-green-50/50 dark:bg-green-950/20"
                  : "border-border hover:border-brand-400 dark:hover:border-brand-600"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  {slot.label} {slot.required && <span className="text-red-500">*</span>}
                </Label>
                {isUploaded && !isUploading && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" aria-hidden="true" />
                    {docStatus !== "pending_review" && docStatus !== "verified" && (
                      <button
                        onClick={() => handleRemoveDoc(slot.key)}
                        className="text-muted-foreground hover:text-red-500 transition-colors"
                        aria-label={`Remove ${slot.label}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {isUploading ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span className="font-medium">Uploading… {uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              ) : isUploaded && !slot.multiple ? (
                <div className="space-y-3">
                  {isPdf ? (
                    <a
                      href={mediaUrl(doc.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 p-4 rounded-lg bg-muted/50 border border-border text-sm text-brand-600 dark:text-brand-400 hover:bg-muted transition-colors font-medium"
                    >
                      <FileText className="h-5 w-5 shrink-0" aria-hidden="true" /> View PDF
                    </a>
                  ) : (
                    <img
                      src={mediaUrl(doc.url)}
                      alt={slot.label}
                      className="w-full h-40 object-contain rounded-lg bg-muted/50 border border-border cursor-pointer hover:border-brand-400 transition-colors"
                      onClick={() => window.open(mediaUrl(doc.url), "_blank")}
                    />
                  )}
                </div>
              ) : isUploaded && slot.multiple ? (
                <div className="flex flex-wrap gap-3">
                  {(Array.isArray(doc) ? doc : []).map((item, i) => (
                    <div key={i} className="relative group">
                      <a
                        href={mediaUrl(item.url || item)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border text-xs text-brand-600 dark:text-brand-400 hover:bg-muted transition-colors font-medium"
                      >
                        <FileText className="h-4 w-4 shrink-0" aria-hidden="true" /> Doc {i + 1}
                      </a>
                      {docStatus !== "pending_review" && docStatus !== "verified" && (
                        <button
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600 font-bold"
                          onClick={() => handleRemoveDoc(slot.key, i)}
                          aria-label={`Remove document ${i + 1}`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {docStatus !== "pending_review" && docStatus !== "verified" && (
                    <label className="flex items-center gap-2 p-3 rounded-lg border-2 border-dashed border-border text-xs text-brand-600 dark:text-brand-400 cursor-pointer hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950 transition-all font-medium">
                      <Plus className="h-4 w-4 shrink-0" aria-hidden="true" /> Add more
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf"
                        multiple
                        onChange={e => handleDocUpload(slot.key, e.target.files)}
                        aria-label={`Upload additional ${slot.label}`}
                      />
                    </label>
                  )}
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-all border-border hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950">
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" aria-hidden="true" />
                  <span className="text-sm font-medium text-foreground mb-1">Click to upload</span>
                  <span className="text-xs text-muted-foreground">
                    {slot.type === "image" ? "Image, max 10MB" : "Image or PDF, max 10MB"}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept={slot.type === "image" ? "image/*" : "image/*,.pdf"}
                    multiple={!!slot.multiple}
                    onChange={e => handleDocUpload(slot.key, e.target.files)}
                    aria-label={`Upload ${slot.label}`}
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit Section */}
      {docStatus !== "pending_review" && docStatus !== "verified" && (
        <div className="space-y-4 mt-6">
          <div className="flex items-start gap-3 rounded-xl border-2 border-border bg-muted/30 p-4">
            <Checkbox
              id="coach-agree-terms"
              checked={agreedToTerms}
              onCheckedChange={setAgreedToTerms}
              className="mt-0.5"
            />
            <label htmlFor="coach-agree-terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
              I confirm that all uploaded documents are genuine and I agree to the{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-brand-600 dark:text-brand-400 underline hover:text-brand-700 dark:hover:text-brand-300 font-medium">
                Terms & Conditions
              </a>{" "}
              and{" "}
              <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-brand-600 dark:text-brand-400 underline hover:text-brand-700 dark:hover:text-brand-300 font-medium">
                Privacy Policy
              </a>
              .
            </label>
          </div>
          <Button
            onClick={handleSubmitForReview}
            disabled={!allRequiredDocsUploaded || !agreedToTerms || submittingDocs || !!uploadingDoc}
            className="w-full bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 text-white font-semibold min-h-[52px]"
          >
            {submittingDocs ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" aria-hidden="true" /> Submitting…
              </>
            ) : (
              <>
                <ShieldCheck className="h-5 w-5 mr-2" aria-hidden="true" /> Submit Documents for Review
              </>
            )}
          </Button>
        </div>
      )}
      {!allRequiredDocsUploaded && docStatus !== "pending_review" && docStatus !== "verified" && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          Upload all required documents (<span className="text-red-500">*</span>) to submit for review
        </p>
      )}
    </div>
  );
}
