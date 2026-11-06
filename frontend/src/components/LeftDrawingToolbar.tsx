"use client";

import { useState } from "react";
import {
  Crosshair,
  TrendingUp,
  Spline,
  Pencil,
  Type,
  Shapes,
  Ruler,
  ZoomIn,
  Magnet,
  Lock,
  Eye,
  Trash2,
  Minus,
  Target,
} from "lucide-react";

interface Props {
  theme?: "light" | "dark";
  activeTool?: string;
  onSelectTool?: (toolId: string) => void;
}

export default function LeftDrawingToolbar({
  theme = "light",
  activeTool: controlledTool,
  onSelectTool,
}: Props) {
  const [internalTool, setInternalTool] = useState<string>("crosshair");
  const activeTool = controlledTool !== undefined ? controlledTool : internalTool;

  const handleSelect = (id: string) => {
    const next = activeTool === id ? "crosshair" : id;
    if (onSelectTool) {
      onSelectTool(next);
    } else {
      setInternalTool(next);
    }
  };

  const tools = [
    { id: "crosshair", icon: <Crosshair size={17} />, label: "Crosshair" },
    {
      id: "support",
      icon: (
        <div className="relative flex items-center justify-center">
          <Minus size={18} className="text-[#089981] stroke-[3]" />
          <span className="absolute -bottom-1 -right-1 text-[8px] font-black text-[#089981]">S</span>
        </div>
      ),
      label: "Support Line (Green)",
    },
    {
      id: "resistance",
      icon: (
        <div className="relative flex items-center justify-center">
          <Minus size={18} className="text-[#f23645] stroke-[3]" />
          <span className="absolute -bottom-1 -right-1 text-[8px] font-black text-[#f23645]">R</span>
        </div>
      ),
      label: "Resistance Line (Red)",
    },
    {
      id: "auto_sr",
      icon: <Target size={17} className="text-[#2962ff]" />,
      label: "Auto S/R Detection",
    },
    { id: "trendline", icon: <TrendingUp size={17} />, label: "Trend Line Tools" },
    { id: "fib", icon: <Spline size={17} />, label: "Gann & Fibonacci" },
    { id: "brush", icon: <Pencil size={17} />, label: "Geometric Shapes & Brush" },
    { id: "text", icon: <Type size={17} />, label: "Annotation Tools" },
    { id: "patterns", icon: <Shapes size={17} />, label: "Patterns" },
    { id: "measure", icon: <Ruler size={17} />, label: "Measure & Projection" },
    { id: "zoom", icon: <ZoomIn size={17} />, label: "Zoom In" },
    { id: "magnet", icon: <Magnet size={17} />, label: "Magnet Mode" },
    { id: "lock", icon: <Lock size={17} />, label: "Lock All Drawing Tools" },
    { id: "hide", icon: <Eye size={17} />, label: "Hide All Drawings" },
    { id: "trash", icon: <Trash2 size={17} />, label: "Remove Drawings / S&R Lines" },
  ];

  const isLight = theme === "light";
  const bg = isLight ? "bg-white border-[#e0e3eb]" : "bg-[#1e222d] border-[#2a2e39]";
  const text = isLight ? "text-[#5d606b] hover:text-[#131722] hover:bg-[#f0f3fa]" : "text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#2a2e39]";
  const activeBg = isLight ? "bg-[#e0e3eb] text-[#2962ff]" : "bg-[#2a2e39] text-[#2962ff]";

  return (
    <div
      className={`w-[46px] border-r flex flex-col items-center py-2 gap-0.5 select-none shrink-0 ${bg}`}
    >
      {tools.map((t) => (
        <button
          key={t.id}
          onClick={() => handleSelect(t.id)}
          title={t.label}
          className={`w-9 h-9 rounded flex items-center justify-center transition-colors ${
            activeTool === t.id ? activeBg : text
          }`}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}
