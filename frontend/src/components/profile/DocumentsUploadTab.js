import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Upload, Loader2, FileText, Image as ImageIcon, Video } from "lucide-react";
import { mediaUrl } from "@/lib/utils";
import { uploadAPI, authAPI } from "@/lib/api";
import { toast } from "sonner";

const DOC_SLOTS = [
  { key: "business_license", label: "Business License", type: "document", accept: "image/*,.pdf", multiple: false, required: true },
  { key: "gst_certificate", label: "GST Certificate", type: "document", accept: "image/*,.pdf", multiple: false, required: true },
  { key: "id_proof", label: "ID Proof", type: "document", accept: "image/*,.pdf", multiple: false, required: true },
  { key: "address_proof", label: "Address Proof", type: "document", accept: "image/*,.pdf", multiple: false, required: true },
  { key: "turf_images", label: "Turf Images", type: "image", accept: "image/*", multiple: true, required: false },
  { key: "turf_videos", label: "Turf Videos", type: "video", accept: "video/*", multiple: true, required: false },
];

export function DocumentsUploadTab({ user, updateUser }) {
  const [docs, setDocs] = useState(() => {
    const rawDocs = user?.verification_documents || {};
    return {
      ...rawDocs,
      turf_images: Array.isArray(rawDocs.turf_images) ? rawDocs.turf_images : [],
      turf_videos: Array.isArray(rawDocs.turf_videos) ? rawDocs.turf_videos : [],
    };
  });
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submittingDocs, setSubmittingDocs] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const docStatus = user?.doc_verification_status || "not_uploaded";

  const handleDocUpload = async (slotKey, files, slotType) => {
    if (!files || files.length === 0) return;
    setUploadingDoc(slotKey);
    setUploadProgress(0);
    try {
      const onProgress = (e) => {
        if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      };
      const slotDef = DOC_SLOTS.find(s => s.key === slotKey);
      const isMultiple = slotDef?.multiple;

      if (!isMultiple) {
        const file = files[0];
        const res = slotType === "document"
          ? await uploadAPI.document(file, onProgress)
          : await uploadAPI.image(file, onProgress);
        const docData = { url: res.data.url, uploaded_at: new Date().toISOString() };
        const newDocs = { ...docs, [slotKey]: docData };
        setDocs(newDocs);
        await authAPI.updateVerificationDocs({ [slotKey]: docData });
      } else {
        const existing = Array.isArray(docs[slotKey]) ? docs[slotKey] : [];
        const uploaded = [];
        for (const file of files) {
          const res = slotType === "image"
            ? await uploadAPI.image(file, onProgress)
            : await uploadAPI.video(file, onProgress);
          uploaded.push({ url: res.data.url, uploaded_at: new Date().toISOString() });
        }
        const merged = [...existing, ...uploaded];
        const newDocs = { ...docs, [slotKey]: merged };
        setDocs(newDocs);
        await authAPI.updateVerificationDocs({ [slotKey]: merged });
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
    const current = docs[slotKey];
    let newVal;
    if (Array.isArray(current)) {
      newVal = current.filter((_, i) => i !== index);
    } else {
      newVal = null;
    }
    const newDocs = { ...docs, [slotKey]: newVal };
    setDocs(newDocs);
    await authAPI.updateVerificationDocs({ [slotKey]: newVal }).catch(() => {});
  };

  const handleSubmitForReview = async () => {
    setSubmittingDocs(true);
    try {
      const res = await authAPI.updateVerificationDocs({ submit: true });
      updateUser(res.data);
      toast.success("Documents submitted for review!");
    } catch (err) {
      toast.error("Failed to submit documents");
    } finally {
      setSubmittingDocs(false);
    }
  };

  const allRequiredDocsUploaded = DOC_SLOTS.filter(s => s.required).every(s => docs[s.key]?.url);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/30">
          <Upload className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-display font-bold text-lg text-foreground">Verification Documents</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Upload required documents to verify your business</p>
        </div>
      </div>
      {/* Required Documents Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {DOC_SLOTS.filter(s => !s.multiple).map(slot => {
          const doc = docs[slot.key];
          const isUploading = uploadingDoc === slot.key;
          const isPdf = doc?.url?.toLowerCase().endsWith(".pdf");
          return (
            <DocumentSlot
              key={slot.key}
              slot={slot}
              doc={doc}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              isPdf={isPdf}
              docStatus={docStatus}
              onUpload={(files) => handleDocUpload(slot.key, files, slot.type)}
              onRemove={() => handleRemoveDoc(slot.key)}
            />
          );
        })}
      </div>

      {/* Turf Images */}
      {DOC_SLOTS.filter(s => s.key === "turf_images").map(slot => (
        <MultipleFilesSection
          key={slot.key}
          slot={slot}
          items={Array.isArray(docs[slot.key]) ? docs[slot.key] : []}
          isUploading={uploadingDoc === slot.key}
          docStatus={docStatus}
          onUpload={(files) => handleDocUpload(slot.key, files, slot.type)}
          onRemove={(index) => handleRemoveDoc(slot.key, index)}
          renderPreview={(item, i) => (
            <img
              src={mediaUrl(item.url || item)}
              alt={`Turf ${i + 1}`}
              className="w-20 h-20 rounded-lg object-cover cursor-pointer"
              onClick={() => window.open(mediaUrl(item.url || item), "_blank")}
            />
          )}
          icon={ImageIcon}
          addLabel="Add"
        />
      ))}

      {/* Turf Videos */}
      {DOC_SLOTS.filter(s => s.key === "turf_videos").map(slot => (
        <MultipleFilesSection
          key={slot.key}
          slot={slot}
          items={Array.isArray(docs[slot.key]) ? docs[slot.key] : []}
          isUploading={uploadingDoc === slot.key}
          docStatus={docStatus}
          onUpload={(files) => handleDocUpload(slot.key, files, slot.type)}
          onRemove={(index) => handleRemoveDoc(slot.key, index)}
          renderPreview={(item) => (
            <video
              src={mediaUrl(item.url || item)}
              controls
              className="w-36 h-24 rounded-lg object-cover"
            />
          )}
          icon={Video}
          addLabel="Add Video"
          containerClass="w-36 h-24"
        />
      ))}

      {/* Submit Section */}
      {docStatus !== "pending_review" && docStatus !== "verified" && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border-2 border-border bg-muted/30 p-4">
            <Checkbox
              id="agree-terms"
              checked={agreedToTerms}
              onCheckedChange={setAgreedToTerms}
              className="mt-0.5"
            />
            <label htmlFor="agree-terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
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
                <Upload className="h-5 w-5 mr-2" aria-hidden="true" /> Submit Documents for Review
              </>
            )}
          </Button>
        </div>
      )}
      {!allRequiredDocsUploaded && docStatus !== "pending_review" && docStatus !== "verified" && (
        <p className="text-xs text-muted-foreground text-center">
          Upload all required documents (<span className="text-red-500">*</span>) to submit for review
        </p>
      )}
    </div>
  );
}

function DocumentSlot({ slot, doc, isUploading, uploadProgress, isPdf, docStatus, onUpload, onRemove }) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-card via-card to-muted/10 border border-border shadow-sm p-5 hover:border-brand-400 dark:hover:border-brand-600 hover:shadow-md transition-all duration-300">
      <div className="flex items-center justify-between mb-3">
        <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
          {slot.label}
          {slot.required && <span className="text-red-500">*</span>}
        </Label>
        {doc?.url && <CheckCircle2 className="h-5 w-5 text-green-500" aria-hidden="true" />}
      </div>
      {doc?.url ? (
        <div className="space-y-3">
          {isPdf ? (
            <a
              href={mediaUrl(doc.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 p-4 rounded-lg bg-muted/50 border border-border text-sm text-brand-600 dark:text-brand-400 hover:bg-muted transition-colors font-medium"
            >
              <FileText className="h-5 w-5 shrink-0" aria-hidden="true" /> View PDF Document
            </a>
          ) : (
            <img
              src={mediaUrl(doc.url)}
              alt={slot.label}
              className="w-full h-40 object-contain rounded-lg bg-muted/50 border border-border cursor-pointer hover:border-brand-400 transition-colors"
              onClick={() => window.open(mediaUrl(doc.url), "_blank")}
            />
          )}
          {docStatus !== "pending_review" && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-xs text-muted-foreground hover:text-foreground font-medium"
              onClick={onRemove}
            >
              Replace
            </Button>
          )}
        </div>
      ) : (
        <label
          className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
            isUploading
              ? "border-brand-500 bg-brand-50 dark:bg-brand-950"
              : "border-border hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950"
          }`}
        >
          {isUploading ? (
            <div className="w-full space-y-3">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <Progress value={uploadProgress} className="h-2" />
              <div className="text-xs text-center text-muted-foreground font-medium tabular-nums">
                {uploadProgress}%
              </div>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground mb-2" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground mb-1">Click to upload</span>
              <span className="text-xs text-muted-foreground">Image or PDF, max 10MB</span>
            </>
          )}
          <input
            type="file"
            accept={slot.accept}
            className="hidden"
            disabled={isUploading}
            onChange={(e) => onUpload(e.target.files)}
            aria-label={`Upload ${slot.label}`}
          />
        </label>
      )}
    </div>
  );
}

function MultipleFilesSection({ slot, items, isUploading, docStatus, onUpload, onRemove, renderPreview, icon: Icon, addLabel, containerClass = "w-20 h-20" }) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-card via-card to-muted/10 border border-border shadow-sm p-5">
      <Label className="text-xs font-bold uppercase tracking-wider mb-4 block">{slot.label}</Label>
      <div className="flex flex-wrap gap-3">
        {items.map((item, i) => (
          <div key={i} className="relative group">
            {renderPreview(item, i)}
            {docStatus !== "pending_review" && (
              <button
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600 font-bold"
                onClick={() => onRemove(i)}
                aria-label={`Remove ${slot.label} ${i + 1}`}
              >
                ×
              </button>
            )}
          </div>
        ))}
        {docStatus !== "pending_review" && (
          <label className={`${containerClass} flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer border-border hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950 transition-all`}>
            {Icon && <Icon className="h-5 w-5 text-muted-foreground mb-1" aria-hidden="true" />}
            <span className="text-xs text-muted-foreground font-medium">{addLabel}</span>
            <input
              type="file"
              accept={slot.accept}
              multiple={slot.multiple}
              className="hidden"
              disabled={isUploading}
              onChange={(e) => onUpload(e.target.files)}
              aria-label={`Upload ${slot.label}`}
            />
          </label>
        )}
      </div>
    </div>
  );
}
