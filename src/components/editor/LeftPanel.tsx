"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  ImagePlus,
  Frame,
  Type,
  Layers,
  ChevronRight,
  Stamp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import FrameSelector from "./FrameSelector";
import { ASPECT_RATIO_PRESETS } from "@/types/editor";
import { ALL_FONTS, preloadAllGoogleFonts } from "@/lib/fonts";
import type { BlendMode } from "@/types/editor";

type PanelTab = "images" | "frames" | "text" | "logos" | "layers" | null;

interface LeftPanelProps {
  organizationId: string | null;
  onAddImage: (url: string, file: File) => void;
  onAddFrame: (frameUrl: string, blendMode: BlendMode) => void;
  onFrameUpload: (file: File) => void;
  onAddText: (preset: "heading" | "subheading" | "body", fontFamily?: string) => void;
  onAddLogo: (url: string) => void;
  onChangeSize: (width: number, height: number) => void;
}

const LOGO_ASSETS = [
  { name: "ACP Logo Classic", path: "/assets/logos/ACP Logo Classic.png" },
  { name: "ACP Logo (Refined)", path: "/assets/logos/ACP_logo_refined-removebg-preview.png" },
  { name: "ACP Ribbon", path: "/assets/logos/ACP_Ribbon.png" },
  { name: "ACP Logo White", path: "/assets/logos/ACP-Logo-White.svg" },
  { name: "ACP Logo White Border", path: "/assets/logos/ACP Logo White Border.svg" },
  { name: "ACP Name", path: "/assets/logos/ACP Name.svg" },
];

const NAV_ITEMS: { id: PanelTab; icon: typeof ImagePlus; label: string }[] = [
  { id: "images", icon: ImagePlus, label: "Photos" },
  { id: "frames", icon: Frame, label: "Frames" },
  { id: "text", icon: Type, label: "Text" },
  { id: "logos", icon: Stamp, label: "Logos" },
  { id: "layers", icon: Layers, label: "Layers" },
];

export default function LeftPanel({
  organizationId,
  onAddImage,
  onAddFrame,
  onFrameUpload,
  onAddText,
  onAddLogo,
  onChangeSize,
}: LeftPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>("images");
  const [selectedFont, setSelectedFont] = useState("Eurostile");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preload Google Fonts
  useEffect(() => {
    preloadAllGoogleFonts();
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        if (file.type.startsWith("image/")) {
          const url = URL.createObjectURL(file);
          onAddImage(url, file);
        }
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [onAddImage]
  );

  const toggleTab = (tab: PanelTab) => {
    setActiveTab(activeTab === tab ? null : tab);
  };

  return (
    <div className="flex h-full">
      {/* Icon rail */}
      <div className="w-16 bg-card border-r border-border/50 flex flex-col items-center py-3 gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => toggleTab(item.id)}
              className={`
                w-12 h-12 rounded-lg flex flex-col items-center justify-center gap-0.5
                text-xs transition-colors
                ${isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }
              `}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Expanded panel */}
      {activeTab && (
        <div className="w-72 bg-card border-r border-border/50 flex flex-col">
          <div className="h-12 flex items-center justify-between px-4 border-b border-border/50 shrink-0">
            <h2 className="text-sm font-medium capitalize">{activeTab}</h2>
            <button
              onClick={() => setActiveTab(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4">
              {/* PHOTOS TAB */}
              {activeTab === "images" && (
                <div className="space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <ImagePlus className="h-8 w-8" />
                    <span className="text-sm">Upload Photo</span>
                    <span className="text-xs text-muted-foreground">or drag onto canvas</span>
                  </button>

                  <Separator />

                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                      Canvas Size
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {ASPECT_RATIO_PRESETS.map((preset) => (
                        <Button
                          key={preset.label}
                          variant="outline"
                          size="sm"
                          className="h-auto py-2 px-3 flex items-center gap-2 text-left"
                          onClick={() => onChangeSize(preset.width, preset.height)}
                        >
                          {(() => {
                            const [w, h] = preset.ratio.split(":").map(Number);
                            const maxD = 16;
                            const a = w / h;
                            return (
                              <div
                                className="rounded-[2px] bg-muted-foreground/25 border border-muted-foreground/30 shrink-0"
                                style={{ width: a >= 1 ? maxD : Math.round(maxD * a), height: a >= 1 ? Math.round(maxD / a) : maxD }}
                              />
                            );
                          })()}
                          <div>
                            <span className="text-xs font-medium block">{preset.label}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {preset.ratio}
                            </span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* FRAMES TAB */}
              {activeTab === "frames" && (
                <FrameSelector
                  organizationId={organizationId}
                  onFrameSelect={onAddFrame}
                  onFrameUpload={onFrameUpload}
                />
              )}

              {/* TEXT TAB */}
              {activeTab === "text" && (
                <div className="space-y-4">
                  {/* Font selector */}
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Font
                    </h3>
                    <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto rounded-lg border border-border p-1">
                      {ALL_FONTS.map((font) => (
                        <button
                          key={font.family}
                          onClick={() => setSelectedFont(font.family)}
                          className={`text-left px-3 py-2 rounded text-sm transition-colors ${
                            selectedFont === font.family
                              ? "bg-primary/15 text-primary"
                              : "hover:bg-muted text-foreground"
                          }`}
                          style={{ fontFamily: `"${font.family}", ${font.category}` }}
                        >
                          {font.label}
                          {font.source === "custom" && (
                            <span className="text-[10px] text-muted-foreground ml-2">custom</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Text presets */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Add Text
                    </h3>
                    <button
                      className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                      onClick={() => onAddText("heading", selectedFont)}
                    >
                      <span
                        className="text-xl font-bold block"
                        style={{ fontFamily: `"${selectedFont}", sans-serif` }}
                      >
                        Add a heading
                      </span>
                    </button>
                    <button
                      className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                      onClick={() => onAddText("subheading", selectedFont)}
                    >
                      <span
                        className="text-base font-semibold block"
                        style={{ fontFamily: `"${selectedFont}", sans-serif` }}
                      >
                        Add a subheading
                      </span>
                    </button>
                    <button
                      className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                      onClick={() => onAddText("body", selectedFont)}
                    >
                      <span
                        className="text-sm block"
                        style={{ fontFamily: `"${selectedFont}", sans-serif` }}
                      >
                        Add body text
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* LOGOS TAB */}
              {activeTab === "logos" && (
                <div className="space-y-4">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Organization Logos
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {LOGO_ASSETS.map((logo) => (
                      <button
                        key={logo.name}
                        className="aspect-square rounded-lg border border-border hover:border-primary/50 overflow-hidden checkerboard transition-colors flex items-center justify-center p-3 group"
                        onClick={() => onAddLogo(logo.path)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={logo.path}
                          alt={logo.name}
                          className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform"
                        />
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">
                    Click a logo to add it to the canvas
                  </p>
                </div>
              )}

              {/* LAYERS TAB */}
              {activeTab === "layers" && (
                <div className="text-sm text-muted-foreground text-center py-8">
                  Select objects on the canvas to manage layers
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
