"use client";

import { useEffect, useRef, useState } from "react";
import type { Worker } from "tesseract.js";

type Props = {
  disabled: boolean;
  onText: (text: string) => void;
  onBusy: (busy: boolean) => void;
  language: "ar" | "en";
};
export default function ImageNewsInput({
  disabled,
  onText,
  onBusy,
  language,
}: Props) {
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const imageUrl = useRef("");
  const job = useRef(0);

  useEffect(() => {
    return () => {
      job.current++;
      if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
      void workerRef.current?.terminate().catch(() => undefined);
    };
  }, []);

  function removeImage() {
    job.current++;

    const worker = workerRef.current;
    workerRef.current = null;
    void worker?.terminate().catch(() => undefined);

    if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
    imageUrl.current = "";

    setPreview("");
    setBusy(false);
    setMessage("");
    setError("");
    onBusy(false);

    if (inputRef.current) inputRef.current.value = "";
  }

  async function readImage(file: File) {
    if (busy || disabled) return;

    setError("");

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("اختر صورة PNG أو JPG أو WEBP.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("حجم الصورة يجب ألا يتجاوز 10 ميجابايت.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const currentJob = ++job.current;

    setBusy(true);
    onBusy(true);
    setProgress(0);
    setMessage("جاري تحميل قارئ الصور...");

    if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);

    const url = URL.createObjectURL(file);
    imageUrl.current = url;
    setPreview(url);

    let worker: Worker | null = null;

    try {
      const image = new Image();
      image.src = url;
      await image.decode();

      if (currentJob !== job.current) return;

      if (image.naturalWidth * image.naturalHeight > 20_000_000) {
        throw new Error("large-image");
      }

      const scale = Math.min(
        1,
        2400 / Math.max(image.naturalWidth, image.naturalHeight)
      );

      const canvas = document.createElement("canvas");

      canvas.width = Math.max(
        1,
        Math.round(image.naturalWidth * scale)
      );

      canvas.height = Math.max(
        1,
        Math.round(image.naturalHeight * scale)
      );

      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas");

      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const { createWorker } = await import("tesseract.js");

      if (currentJob !== job.current) return;

      worker = await createWorker(["ara", "eng"], 1, {
        logger: (event) => {
          if (currentJob !== job.current) return;

          if (event.status === "recognizing text") {
            setMessage("جاري قراءة النص من الصورة...");
            setProgress(Math.round(event.progress * 100));
          }
        },
      });

      if (currentJob !== job.current) return;

      workerRef.current = worker;

      const { data } = await worker.recognize(canvas);

      if (currentJob !== job.current) return;

      const text = data.text.trim();

      if (!text || !/[\p{L}\p{N}]/u.test(text)) {
        setMessage("");
        setError("لم أجد نصًا واضحًا. جرّب صورة أوضح.");
        return;
      }

      onText(text);
      setProgress(100);
      setMessage("تم استخراج النص. راجعه ثم اضغط «تحقق الآن».");
    } catch (cause) {
      if (currentJob === job.current) {
        setMessage("");
        setError(
          cause instanceof Error && cause.message === "large-image"
            ? "أبعاد الصورة كبيرة جدًا. اختر صورة أصغر."
            : "تعذرت قراءة الصورة. تأكد من الإنترنت وجرّب صورة واضحة."
        );
      }
    } finally {
      if (workerRef.current === worker) workerRef.current = null;

      await worker?.terminate().catch(() => undefined);

      if (currentJob === job.current) {
        setBusy(false);
        onBusy(false);

        if (inputRef.current) inputRef.current.value = "";
      }
    }
  }

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={busy || disabled}
        aria-label={
  language === "ar"
    ? "اختيار صورة الخبر"
    : "Choose News Image"
}
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void readImage(file);
        }}
      />

      <button
        type="button"
        className="factroot-round-button"
        onClick={() => inputRef.current?.click()}
        disabled={busy || disabled}
        aria-label={
  language === "ar"
    ? "إرفاق صورة الخبر"
    : "Upload News Image"
}
        style={{
          position: "relative",
          width: 54,
          height: 54,
          padding: 0,
          display: "grid",
          placeItems: "center",
          border: "1px solid #DCE5F5",
          borderRadius: "50%",
          background: "#EDF2FF",
          color: "#1769CC",
          cursor: busy || disabled ? "not-allowed" : "pointer",
          opacity: busy || disabled ? 0.6 : 1,
        }}
      >
        <span className="factroot-button-tooltip">
  {language === "ar"
    ? "أرفق صورة الخبر"
    : "Upload News Image"}
</span>

        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14.5 4h-5L7.5 7H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2.5z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </button>

      {(preview || message || error) && (
        <div
          style={{
            position: "absolute",
            bottom: 68,
            left: 0,
            width: 230,
            maxWidth: "65vw",
            padding: 12,
            borderRadius: 12,
            border: "1px solid #DBEAFE",
            background: "#FFFFFF",
            boxShadow: "0 8px 25px rgba(0,0,0,0.12)",
            zIndex: 20,
            color: "#1E3A8A",
            fontSize: 13,
            lineHeight: 1.7,
            direction: "rtl",
          }}
        >
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="معاينة صورة الخبر"
              style={{
                width: "100%",
                maxHeight: 100,
                objectFit: "contain",
                borderRadius: 8,
              }}
            />
          )}

          {busy && (
            <progress
              value={progress}
              max={100}
              aria-label="تقدم قراءة الصورة"
              style={{ width: "100%", marginTop: 8 }}
            />
          )}

          <p role="status" aria-live="polite">
            {message}
          </p>

          {error && (
            <p role="alert" style={{ color: "#B91C1C" }}>
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={removeImage}
            disabled={disabled}
            style={{
              padding: "5px 10px",
              border: "1px solid #DBEAFE",
              borderRadius: 8,
              background: "#EFF6FF",
              color: "#2563EB",
              cursor: "pointer",
            }}
          >
            {busy ? "إلغاء القراءة" : "إغلاق المعاينة"}
          </button>
        </div>
      )}
    </div>
  );
}