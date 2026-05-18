import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RotateCcw } from "lucide-react";

function getCanvasPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function canvasHasInk(canvas) {
  if (!canvas) return false;
  const context = canvas.getContext("2d");
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] > 0) return true;
  }
  return false;
}

const CertificateSignaturePad = forwardRef(function CertificateSignaturePad({ onChange, signerName = "" }, ref) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const [hasSigned, setHasSigned] = useState(false);

  const captureSignature = () => {
    const canvas = canvasRef.current;
    const signed = canvasHasInk(canvas);
    const signatureDataUrl = signed && canvas ? canvas.toDataURL("image/png") : "";
    return { hasSignature: signed, signatureDataUrl };
  };

  const emitChange = () => {
    const next = captureSignature();
    setHasSigned(next.hasSignature);
    onChange?.(next);
  };

  useImperativeHandle(ref, () => ({
    captureSignature,
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context.strokeStyle = "#1e2535";
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.lineJoin = "round";
  }, []);

  const startDraw = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    isDrawing.current = true;
    context.beginPath();
    const point = getCanvasPoint(event, canvas);
    context.moveTo(point.x, point.y);
    event.preventDefault();
  };

  const draw = (event) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    const point = getCanvasPoint(event, canvas);
    context.lineTo(point.x, point.y);
    context.stroke();
    event.preventDefault();
  };

  const endDraw = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    emitChange();
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
    onChange?.({ hasSignature: false, signatureDataUrl: "" });
  };

  return (
    <div className="space-y-2">
      <Label>NOVI Society signature</Label>
      <p className="text-xs text-slate-500">
        Sign on behalf of NOVI Society{signerName ? ` as ${signerName}` : ""}. This signature is embedded on the issued certificate.
      </p>
      <div className="border border-slate-300 rounded-xl overflow-hidden bg-white relative">
        <canvas
          ref={canvasRef}
          width={560}
          height={128}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!hasSigned && (
          <p className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm pointer-events-none">
            Sign here
          </p>
        )}
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={clearSignature} className="text-slate-500">
        <RotateCcw className="w-3.5 h-3.5 mr-1" />
        Clear signature
      </Button>
    </div>
  );
});

export default CertificateSignaturePad;
