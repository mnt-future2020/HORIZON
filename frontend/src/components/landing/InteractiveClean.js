import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

const SVG_MASK = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 250' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='10' y='10' width='180' height='230' rx='20' ry='20' fill='%23000'/%3E%3C/svg%3E")`;

export function InteractiveClean() {
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef(null);
  const displayCanvasRef = useRef(null);
  const maskCanvasRef = useRef(null);

  const dirtyImageRef = useRef(null);
  const cleanImageRef = useRef(null);

  const lastMousePos = useRef(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  const BRUSH_SIZE = 120;
  const BRUSH_HARDNESS = 0.2;

  const renderFrame = () => {
    const displayCanvas = displayCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const displayCtx = displayCanvas?.getContext("2d");

    if (!displayCtx || !displayCanvas || !maskCanvas) return;
    if (!dirtyImageRef.current || !cleanImageRef.current) return;

    const width = displayCanvas.width;
    const height = displayCanvas.height;

    displayCtx.clearRect(0, 0, width, height);

    const dirtyImg = dirtyImageRef.current;
    const cleanImg = cleanImageRef.current;
    const scale = Math.max(width / dirtyImg.width, height / dirtyImg.height);
    const x = (width - dirtyImg.width * scale) / 2;
    const y = (height - dirtyImg.height * scale) / 2;

    displayCtx.save();
    displayCtx.globalCompositeOperation = "source-over";
    displayCtx.drawImage(maskCanvas, 0, 0);
    displayCtx.globalCompositeOperation = "source-out";
    displayCtx.drawImage(dirtyImg, x, y, dirtyImg.width * scale, dirtyImg.height * scale);
    displayCtx.globalCompositeOperation = "destination-over";
    displayCtx.drawImage(cleanImg, x, y, cleanImg.width * scale, cleanImg.height * scale);
    displayCtx.restore();
  };

  useEffect(() => {
    const dirtyImg = document.createElement("img");
    dirtyImg.src = "https://lobbi-s3.s3.ap-south-1.amazonaws.com/images/unnamed+(5).png";
    dirtyImg.onload = () => {
      dirtyImageRef.current = dirtyImg;
      renderFrame();
    };

    const cleanImg = document.createElement("img");
    cleanImg.src = "https://lobbi-s3.s3.ap-south-1.amazonaws.com/images/unnamed+(1).png";
    cleanImg.onload = () => {
      cleanImageRef.current = cleanImg;
      renderFrame();
    };
  }, []);

  useEffect(() => {
    const displayCanvas = displayCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!displayCanvas || !maskCanvas || !containerRef.current) return;

    const resizeCanvas = () => {
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      displayCanvas.width = width;
      displayCanvas.height = height;
      maskCanvas.width = width;
      maskCanvas.height = height;

      renderFrame();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  useEffect(() => {
    let animationFrameId;
    const fadeLoop = () => {
      const maskCanvas = maskCanvasRef.current;
      const maskCtx = maskCanvas?.getContext("2d");
      if (maskCtx && maskCanvas) {
        maskCtx.globalCompositeOperation = "destination-out";
        maskCtx.fillStyle = "rgba(0, 0, 0, 0.01)";
        maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
        maskCtx.globalCompositeOperation = "source-over";
        renderFrame();
      }
      animationFrameId = requestAnimationFrame(fadeLoop);
    };
    fadeLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const drawBrush = (ctx, x, y) => {
    ctx.globalCompositeOperation = "source-over";
    const gradient = ctx.createRadialGradient(x, y, BRUSH_SIZE * BRUSH_HARDNESS, x, y, BRUSH_SIZE / 2);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.5)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, BRUSH_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const handleMouseMove = (e) => {
    if (!containerRef.current || !maskCanvasRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    setCursorPos({ x: currentX, y: currentY });
    const maskCtx = maskCanvasRef.current.getContext("2d");
    if (!maskCtx) return;

    if (lastMousePos.current) {
      const { x: lastX, y: lastY } = lastMousePos.current;
      const dist = Math.hypot(currentX - lastX, currentY - lastY);
      const angle = Math.atan2(currentY - lastY, currentX - lastX);
      const step = 5;
      for (let i = 0; i < dist; i += step) {
        const interpX = lastX + Math.cos(angle) * i;
        const interpY = lastY + Math.sin(angle) * i;
        drawBrush(maskCtx, interpX, interpY);
      }
    } else {
      drawBrush(maskCtx, currentX, currentY);
    }
    lastMousePos.current = { x: currentX, y: currentY };
    renderFrame();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    lastMousePos.current = null;
  };

  return (
    <div
      className="relative w-full h-full"
      style={{ filter: "drop-shadow(0px 15px 25px rgba(0,0,0,0.6))" }}
    >
      <div
        ref={containerRef}
        className="relative w-full h-full select-none touch-none group cursor-none bg-gray-900"
        style={{
          WebkitMaskImage: SVG_MASK,
          maskImage: SVG_MASK,
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      >
        <canvas ref={displayCanvasRef} className="absolute inset-0 w-full h-full" />
        <canvas ref={maskCanvasRef} className="hidden" />


      </div>
    </div>
  );
}
