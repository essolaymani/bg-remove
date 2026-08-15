import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { buildPreviewCanvasBackground, type PreviewBackground } from "../lib/previewCanvas";
import { AlertCircle, ArrowRight, Check, Download, FileImage, ImagePlus, Loader2, RefreshCw, ShieldCheck, Sparkles, UploadCloud, X } from "lucide-react";
import { ChangeEvent, CSSProperties, DragEvent, useRef, useState } from "react";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 8 * 1024 * 1024;
type StudioStatus = "idle" | "ready" | "uploading" | "processing" | "complete" | "error";
type RemovalMode = "background" | "tshirt-design";

function readImageFile(file: File, onProgress: (progress: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Your image could not be read. Please try again."));
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<string>();
  const [result, setResult] = useState<string>();
  const [filename, setFilename] = useState("");
  const [mimeType, setMimeType] = useState<"image/jpeg" | "image/png" | "image/webp">();
  const [mode, setMode] = useState<RemovalMode>("tshirt-design");
  const [previewBackground, setPreviewBackground] = useState<PreviewBackground>("gradient");
  const [solidBackground, setSolidBackground] = useState("#172a3a");
  const [gradientStart, setGradientStart] = useState("#111827");
  const [gradientEnd, setGradientEnd] = useState("#7c3aed");
  const [status, setStatus] = useState<StudioStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const removeBackground = trpc.background.remove.useMutation();
  const isPrintMode = mode === "tshirt-design";
  const previewCanvas = buildPreviewCanvasBackground(previewBackground, solidBackground, gradientStart, gradientEnd);
  const previewCanvasStyle: CSSProperties | undefined = isPrintMode && previewCanvas ? { background: previewCanvas } : undefined;

  const selectImage = async (file?: File) => {
    if (!file) return;
    setError("");
    setResult(undefined);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setStatus("error");
      setError("Choose a JPG, PNG, or WEBP image to begin.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setStatus("error");
      setError("Please choose an image smaller than 8 MB.");
      return;
    }
    try {
      setStatus("uploading");
      setUploadProgress(0);
      const dataUrl = await readImageFile(file, setUploadProgress);
      setSource(dataUrl);
      setFilename(file.name);
      setMimeType(file.type as "image/jpeg" | "image/png" | "image/webp");
      setUploadProgress(100);
      setStatus("ready");
    } catch (readError) {
      setStatus("error");
      setError(readError instanceof Error ? readError.message : "Your image could not be read. Please try again.");
    }
  };

  const changeMode = (nextMode: RemovalMode) => {
    setMode(nextMode);
    setResult(undefined);
    setError("");
    if (source) setStatus("ready");
  };

  const processImage = async () => {
    if (!source || !mimeType) return;
    setError("");
    setStatus("processing");
    try {
      const processed = await removeBackground.mutateAsync({ dataUrl: source, filename, mimeType, mode });
      setResult(processed.dataUrl);
      setStatus("complete");
    } catch (processingError) {
      setStatus("error");
      setError(processingError instanceof Error ? processingError.message : "We couldn’t process this image. Please try again.");
    }
  };

  const resetStudio = () => {
    setSource(undefined); setResult(undefined); setFilename(""); setMimeType(undefined); setError(""); setUploadProgress(0); setStatus("idle");
    if (inputRef.current) inputRef.current.value = "";
  };

  const downloadResult = () => {
    if (!result) return;
    const stem = filename.replace(/\.[^/.]+$/, "") || "withoutbg";
    const anchor = document.createElement("a");
    anchor.href = result;
    anchor.download = `${stem}-${isPrintMode ? "print-artwork" : "transparent"}.png`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void selectImage(event.dataTransfer.files[0]);
  };

  return (
    <div className="min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#123d39] text-[#ecfff5] shadow-[0_10px_26px_rgba(18,61,57,.18)]"><Sparkles size={18} strokeWidth={2.3} /></span><div><p className="font-display text-xl font-bold tracking-[-0.05em] text-[#173d3a]">withoutBG</p><p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#56716b]">Studio</p></div></div>
        <span className="hidden items-center gap-2 rounded-full border border-[#c9ded5] bg-[#f7fcf9]/80 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#40635c] sm:flex"><ShieldCheck size={13} /> Private processing</span>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 pb-12 sm:px-8 lg:px-12">
        <section className="grid gap-8 py-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-end lg:py-14">
          <div className="max-w-xl"><p className="mb-5 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[#4f8174]">Refine the frame</p><h1 className="font-display text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-[#193c38] sm:text-6xl lg:text-7xl">{isPrintMode ? <>The print,<br /><em className="font-normal text-[#3d806c]">uninterrupted.</em></> : <>The subject,<br /><em className="font-normal text-[#3d806c]">uninterrupted.</em></>}</h1><p className="mt-6 max-w-md text-[15px] leading-7 text-[#58706a]">{isPrintMode ? "Turn a printed T-shirt design into a transparent PNG, ready for your next product or creative composition." : "Upload a photograph and receive a crisp, transparent PNG — ready for your next composition."}</p></div>
          <div className="flex gap-3 border-l border-[#b8d2c8] pl-5 sm:max-w-xl sm:justify-self-end"><span className="font-display text-4xl italic text-[#5d9d86]">01</span><p className="max-w-xs pt-1 text-sm leading-6 text-[#5d746d]">JPG, PNG and WEBP supported. Your selected image is processed securely on the server.</p></div>
        </section>

        <section className="rounded-[28px] border border-white/90 bg-[#fffefa]/75 p-3 shadow-[0_28px_80px_rgba(36,73,62,.12)] backdrop-blur-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-2 pt-1 sm:px-3">
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#67b296]" /><span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#4f7067]">Removal workspace</span></div>
            {source && <button onClick={resetStudio} className="flex items-center gap-1.5 rounded-full px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[#668077] transition hover:bg-[#eef6f1] hover:text-[#264b42]"><RefreshCw size={12} /> Start over</button>}
          </div>

          <div className="mb-3 grid gap-2 rounded-[18px] bg-[#edf6f1] p-2 sm:grid-cols-2">
            <ModeButton active={isPrintMode} title="Extract T-shirt print" description="Keep the design, remove the fabric" onClick={() => changeMode("tshirt-design")} />
            <ModeButton active={!isPrintMode} title="Remove photo background" description="Keep the main subject" onClick={() => changeMode("background")} />
          </div>

          {!source ? (
            <div onDrop={onDrop} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onClick={() => inputRef.current?.click()} className={`group relative grid min-h-[390px] cursor-pointer place-items-center overflow-hidden rounded-[21px] border transition duration-200 sm:min-h-[475px] ${dragging ? "border-[#4d9f83] bg-[#e8f7ef]" : "border-dashed border-[#a8c9bd] bg-[#f4faf6] hover:border-[#518d79] hover:bg-[#eef8f2]"}`}>
              <div className="absolute inset-0 opacity-55 [background-image:radial-gradient(#bcd8ca_1px,transparent_1px)] [background-size:22px_22px]" />
              <div className="relative flex max-w-sm flex-col items-center px-5 text-center"><span className="mb-6 grid h-16 w-16 place-items-center rounded-3xl bg-[#123d39] text-[#eafff3] shadow-[0_14px_30px_rgba(18,61,57,.2)] transition duration-200 group-hover:-translate-y-1"><UploadCloud size={26} /></span><h2 className="font-display text-3xl font-semibold tracking-[-0.035em] text-[#1a423d]">{isPrintMode ? "Drop in a T-shirt photo" : "Drop in an image"}</h2><p className="mt-3 text-sm leading-6 text-[#638078]">{isPrintMode ? "Use a straight-on, well-lit photograph with a clearly contrasting print." : "Or click to browse from your device."}<br />JPG, PNG or WEBP up to 8 MB.</p><span className="mt-7 inline-flex items-center gap-2 border-b border-[#6da890] pb-1 font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-[#34705f]">Choose an image <ArrowRight size={13} /></span></div>
            </div>
          ) : <div className="grid gap-3 lg:grid-cols-2"><PreviewPanel label="Original" detail={filename} image={source} emptyText="Your selected image will appear here." /><PreviewPanel label={isPrintMode ? "Extracted print" : "Transparent result"} detail={result ? "Ready to download" : "Awaiting processing"} image={result} checkerboard={!isPrintMode || previewBackground === "checkerboard"} backgroundStyle={previewCanvasStyle} emptyText={status === "processing" ? (isPrintMode ? "Separating print from fabric…" : "Removing the background…") : (isPrintMode ? "Your transparent artwork will appear here." : "Your transparent PNG will appear here.")} processing={status === "processing"} /></div>}

          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event: ChangeEvent<HTMLInputElement>) => void selectImage(event.target.files?.[0])} />
          {isPrintMode && <div className="mt-3 rounded-[16px] border border-[#d5e6de] bg-[#f6fbf8] px-4 py-3 text-xs leading-5 text-[#486b61]"><strong className="font-semibold text-[#275848]">For cleanest artwork:</strong> use a front-facing shirt, even lighting, minimal wrinkles, and a print that visibly contrasts with the fabric. This mode is designed for chest prints; it cannot reliably recreate artwork that is the same colour as the shirt.</div>}
          {isPrintMode && source && <section className="mt-3 rounded-[18px] border border-[#d5e6de] bg-[#f6fbf8] p-3 sm:p-4" aria-label="Extracted print preview background">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><div><h3 className="text-xs font-semibold text-[#275848]">Preview background</h3><p className="mt-0.5 text-[11px] text-[#638078]">Use a darker canvas to inspect white artwork. This does not change the transparent PNG download.</p></div><span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#5f887b]">Display only</span></div>
            <div className="grid gap-2 lg:grid-cols-[1fr_auto] lg:items-center"><div className="grid grid-cols-3 gap-2"><BackgroundChoice active={previewBackground === "checkerboard"} label="Transparent" previewClass="checkerboard" onClick={() => setPreviewBackground("checkerboard")} /><BackgroundChoice active={previewBackground === "solid"} label="Solid" previewStyle={{ background: solidBackground }} onClick={() => setPreviewBackground("solid")} /><BackgroundChoice active={previewBackground === "gradient"} label="Gradient" previewStyle={{ background: `linear-gradient(135deg, ${gradientStart}, ${gradientEnd})` }} onClick={() => setPreviewBackground("gradient")} /></div>
              {previewBackground === "solid" ? <ColorControl label="Canvas colour" value={solidBackground} onChange={setSolidBackground} /> : previewBackground === "gradient" ? <div className="flex flex-wrap items-center gap-2"><ColorControl label="Start" value={gradientStart} onChange={setGradientStart} /><span className="hidden h-px w-4 bg-[#b9d4c7] sm:block" /><ColorControl label="End" value={gradientEnd} onChange={setGradientEnd} /></div> : null}
            </div>
          </section>}
          <div className="mt-3 flex flex-col gap-3 rounded-[18px] bg-[#edf6f1] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"><StatusMessage status={status} progress={uploadProgress} printMode={isPrintMode} /><div className="flex items-center gap-2">{source && !result && <Button disabled={status === "uploading" || status === "processing"} onClick={() => void processImage()} className="h-10 rounded-xl bg-[#123d39] px-4 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(18,61,57,.16)] hover:bg-[#0d302d] active:scale-[.97]">{status === "processing" ? <><Loader2 className="mr-2 animate-spin" size={15} /> Processing…</> : <><Sparkles className="mr-2" size={15} /> {isPrintMode ? "Extract print" : "Remove background"}</>}</Button>}{result && <Button onClick={downloadResult} className="h-10 rounded-xl bg-[#123d39] px-4 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(18,61,57,.16)] hover:bg-[#0d302d] active:scale-[.97]"><Download className="mr-2" size={15} /> Download PNG</Button>}{source && <Button variant="outline" onClick={() => inputRef.current?.click()} className="h-10 rounded-xl border-[#b7d2c6] bg-[#f8fcfa] px-3 text-[#31594e] hover:bg-white"><ImagePlus size={16} /></Button>}</div></div>
          {error && <div role="alert" className="mt-3 flex items-start gap-3 rounded-[16px] border border-[#f3c7bd] bg-[#fff3f0] px-4 py-3 text-sm leading-5 text-[#9b3b2e]"><AlertCircle className="mt-0.5 shrink-0" size={17} /><p>{error}</p><button onClick={() => setError("")} className="ml-auto p-0.5" aria-label="Dismiss error"><X size={16} /></button></div>}
        </section>

        <div className="mt-7 grid gap-4 border-t border-[#c9dbd3] pt-6 sm:grid-cols-3">{[["01", "Transparent by default"], ["02", "Built for composition"], ["03", "Simple by design"]].map(([number, title]) => <div key={number} className="flex gap-3"><span className="font-mono text-[10px] pt-1 text-[#699183]">{number}</span><p className="text-sm font-medium text-[#43645c]">{title}</p></div>)}</div>
      </main>
    </div>
  );
}

function ModeButton({ active, title, description, onClick }: { active: boolean; title: string; description: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-[13px] px-3 py-3 text-left transition ${active ? "bg-[#123d39] text-white shadow-[0_5px_14px_rgba(18,61,57,.15)]" : "text-[#527168] hover:bg-white/70"}`}><span className="block text-xs font-semibold">{title}</span><span className={`mt-1 block text-[11px] ${active ? "text-[#cceadd]" : "text-[#76938a]"}`}>{description}</span></button>;
}

function PreviewPanel({ label, detail, image, checkerboard, backgroundStyle, emptyText, processing }: { label: string; detail: string; image?: string; checkerboard?: boolean; backgroundStyle?: CSSProperties; emptyText: string; processing?: boolean }) {
  return <div style={backgroundStyle} className={`relative min-h-[310px] overflow-hidden rounded-[21px] border border-[#dae9e2] ${checkerboard ? "checkerboard" : "bg-[#f5f7f5]"}`}><div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/35 to-transparent px-4 py-4 text-white"><span className="font-mono text-[10px] uppercase tracking-[0.14em]">{label}</span><span className="rounded-full bg-black/20 px-2 py-1 text-[10px]">{detail}</span></div>{image ? <img src={image} alt={label} className="absolute inset-0 h-full w-full object-contain" /> : <div className="absolute inset-0 grid place-items-center px-6 text-center"><div>{processing ? <Loader2 className="mx-auto mb-3 animate-spin text-[#3f8c75]" size={26} /> : <FileImage className={`mx-auto mb-3 ${backgroundStyle ? "text-white/75" : "text-[#8eaea2]"}`} size={26} />}<p className={`text-sm ${backgroundStyle ? "text-white/85" : "text-[#6c8780]"}`}>{emptyText}</p></div></div>}</div>;
}

function BackgroundChoice({ active, label, previewClass, previewStyle, onClick }: { active: boolean; label: string; previewClass?: string; previewStyle?: CSSProperties; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`rounded-xl border p-2 text-left transition ${active ? "border-[#34705f] bg-white shadow-sm" : "border-transparent hover:border-[#c6ddd2] hover:bg-white/60"}`}><span style={previewStyle} className={`mb-1.5 block h-7 rounded-md border border-black/5 ${previewClass ?? ""}`} /><span className="block text-[10px] font-medium text-[#41645a]">{label}</span></button>;
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="flex items-center gap-2 rounded-xl border border-[#c8ded4] bg-white px-2 py-1.5 text-[10px] text-[#50746a]"><input aria-label={label} type="color" value={value} onChange={event => onChange(event.target.value)} className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0" /><span>{label}</span><span className="font-mono text-[9px] text-[#6d8c83]">{value.toUpperCase()}</span></label>;
}

function StatusMessage({ status, progress, printMode }: { status: StudioStatus; progress: number; printMode: boolean }) {
  if (status === "uploading") return <div className="flex items-center gap-2 text-xs text-[#496c62]"><Loader2 size={15} className="animate-spin" /><span>Reading image <span className="font-mono">{progress}%</span></span></div>;
  if (status === "processing") return <div className="flex items-center gap-2 text-xs text-[#496c62]"><Loader2 size={15} className="animate-spin" /><span>{printMode ? "Separating print from fabric…" : "Removing background securely…"}</span></div>;
  if (status === "complete") return <div className="flex items-center gap-2 text-xs font-medium text-[#287057]"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#d5f2df]"><Check size={13} /></span><span>{printMode ? "Your print artwork is ready." : "Your transparent PNG is ready."}</span></div>;
  if (status === "ready") return <div className="flex items-center gap-2 text-xs text-[#496c62]"><FileImage size={15} /><span>Image selected — ready when you are.</span></div>;
  return <div className="text-xs text-[#658178]">Select an image to begin.</div>;
}
