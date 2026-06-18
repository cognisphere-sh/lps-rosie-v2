"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

interface SortButtonProps {
  isActive: boolean;
  direction: "asc" | "desc" | null;
  onClick: () => void;
  className?: string;
}

export function SortButton({
  isActive,
  direction,
  onClick,
  className,
}: SortButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("h-6 w-6 p-0 hover:bg-transparent", isActive && "text-primary", className)}
      onClick={onClick}
    >
      {isActive && direction === "asc" ? (
        <ArrowUp className="h-4 w-4" />
      ) : isActive && direction === "desc" ? (
        <ArrowDown className="h-4 w-4" />
      ) : (
        <ArrowUpDown className="h-4 w-4 opacity-50" />
      )}
    </Button>
  );
}
