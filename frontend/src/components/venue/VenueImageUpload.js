import { useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { uploadAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export default function VenueImageUpload({ images = [], onChange }) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFiles = async (files) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!arr.length) return;
    setUploading(true);
    const uploaded = [...images];
    for (const file of arr) {
      try {
        const res = await uploadAPI.image(file, (e) => {
          if (e.total)
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
        });
        uploaded.push(res.data.url);
        setUploadProgress(0);
      } catch (err) {
        toast.error(
          `Upload failed: ${err?.response?.data?.detail || "Unknown error"}`
        );
        break;
      }
    }
    onChange(uploaded);
    setUploading(false);
  };

  const removeImage = (idx) => onChange(images.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      {/* Image count */}
      {images.length > 0 && (
        <p className="text-xs text-muted-foreground font-medium">
          {images.length} image{images.length !== 1 ? "s" : ""} uploaded
        </p>
      )}

      {/* Thumbnails Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {images.map((url, i) => (
            <div
              key={i}
              className="relative group aspect-square rounded-xl overflow-hidden border border-border bg-secondary/20"
            >
              <img
                src={mediaUrl(url)}
                alt={`Venue image ${i + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:opacity-100"
                aria-label={`Remove image ${i + 1}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Progress */}
      {uploading && uploadProgress > 0 && (
        <div className="space-y-1">
          <Progress value={uploadProgress} className="h-1.5" />
          <p className="text-xs text-muted-foreground">
            Uploading... {uploadProgress}%
          </p>
        </div>
      )}

      {/* Upload Button */}
      <label
        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 text-sm font-medium min-h-[44px] ${
          uploading
            ? "opacity-60 pointer-events-none border-border"
            : "border-brand-600/30 hover:border-brand-600 hover:bg-brand-600/5 text-muted-foreground hover:text-brand-600"
        }`}
      >
        {uploading ? (
          <>
            <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <ImagePlus className="h-5 w-5" />
            {images.length > 0 ? "Add more images" : "Upload venue images"}
          </>
        )}
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading}
        />
      </label>

      <p className="text-xs text-muted-foreground">
        JPG, PNG, WebP · max 10 MB each. Images appear on your public venue page.
      </p>
    </div>
  );
}
