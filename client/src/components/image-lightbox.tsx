import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn, ZoomOut, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageLightboxProps {
  src: string;
  alt?: string;
  downloadHref?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 6;

export function ImageLightbox({ src, alt, downloadHref, open, onOpenChange }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (open) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [open, src]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  const clampScale = (next: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));

  const zoomAt = (next: number) => {
    const clamped = clampScale(next);
    setScale(clamped);
    if (clamped === MIN_SCALE) setPosition({ x: 0, y: 0 });
  };

  const handleWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    zoomAt(scale + delta * scale);
  };

  const handleDoubleClick = () => {
    zoomAt(scale > MIN_SCALE ? MIN_SCALE : 2.5);
  };

  const handlePointerDown: React.PointerEventHandler<HTMLImageElement> = (e) => {
    if (scale <= MIN_SCALE) return;
    draggingRef.current = true;
    lastPointRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove: React.PointerEventHandler<HTMLImageElement> = (e) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastPointRef.current.x;
    const dy = e.clientY - lastPointRef.current.y;
    lastPointRef.current = { x: e.clientX, y: e.clientY };
    setPosition((p) => ({ x: p.x + dx, y: p.y + dy }));
  };

  const handlePointerUp: React.PointerEventHandler<HTMLImageElement> = (e) => {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
      onWheel={handleWheel}
      data-testid="image-lightbox"
    >
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-white hover:bg-white/10 hover:text-white"
          onClick={() => zoomAt(scale - 0.5)}
          disabled={scale <= MIN_SCALE}
          data-testid="button-lightbox-zoom-out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-white hover:bg-white/10 hover:text-white"
          onClick={() => zoomAt(scale + 0.5)}
          disabled={scale >= MAX_SCALE}
          data-testid="button-lightbox-zoom-in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-white hover:bg-white/10 hover:text-white"
          onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }}
          disabled={scale === MIN_SCALE && position.x === 0 && position.y === 0}
          data-testid="button-lightbox-reset"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        {downloadHref && (
          <a href={downloadHref} target="_blank" rel="noopener noreferrer">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-white hover:bg-white/10 hover:text-white"
              data-testid="button-lightbox-download"
            >
              <Download className="h-4 w-4" />
            </Button>
          </a>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-white hover:bg-white/10 hover:text-white"
          onClick={() => onOpenChange(false)}
          data-testid="button-lightbox-close"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-full h-full flex items-center justify-center overflow-hidden p-6">
        <img
          src={src}
          alt={alt}
          draggable={false}
          onDoubleClick={handleDoubleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="max-w-full max-h-full select-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: draggingRef.current ? "none" : "transform 0.1s ease-out",
            cursor: scale > MIN_SCALE ? "grab" : "zoom-in",
            touchAction: "none",
          }}
        />
      </div>
    </div>,
    document.body
  );
}
