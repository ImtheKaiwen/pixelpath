import React from "react";
import {
  Box,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Expand,
  Focus,
  Layers3,
  Languages,
  List,
  PanelLeft,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Upload,
  X,
} from "lucide-react";

const icons = {
  cube: Box,
  plus: Plus,
  settings: Settings,
  expand: Expand,
  rotate: RotateCcw,
  search: Search,
  arrowLeft: ChevronLeft,
  arrowRight: ChevronRight,
  layers: Layers3,
  language: Languages,
  list: List,
  upload: Upload,
  download: Download,
  target: Focus,
  x: X,
  check: Check,
  chevron: ChevronRight,
  menu: PanelLeft,
  chevronDown: ChevronDown,
};

export function Icon({ name, size = 18, strokeWidth = 1.8, className = "" }) {
  const Component = icons[name] || Box;
  return (
    <Component
      className={className}
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
    />
  );
}
