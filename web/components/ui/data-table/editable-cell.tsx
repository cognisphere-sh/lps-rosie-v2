"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, Edit2 } from "lucide-react";
import { toast } from "sonner";

interface EditableCellProps {
  initialValue: string | number | null;
  onUpdate: (value: string | number) => Promise<void>;
  isReadOnly?: boolean;
}

export function EditableCell({
  initialValue,
  onUpdate,
  isReadOnly,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [value, setValue] = React.useState<string | number>(initialValue ?? "");
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    setValue(initialValue ?? "");
  }, [initialValue]);

  const handleSave = async () => {
    // If value is empty string, treat it as null depending on your backend logic, 
    // but here we just pass what the input has. 
    // If the initial was number, we try to preserve it, but input is string.
    // The parent/action usually handles validation/parsing. 
    
    if (value === (initialValue ?? "")) {
      setIsEditing(false);
      return;
    }
    
    setIsLoading(true);
    try {
      await onUpdate(value);
      setIsEditing(false);
      toast.success("Updated", { description: "Item updated successfully" });
    } catch (error) {
      console.error(error);
      toast.error("Error", { description: "Failed to update item" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setValue(initialValue ?? "");
    setIsEditing(false);
  };

  if (isReadOnly) {
    return <div className="px-2 py-1 truncate">{value}</div>;
  }

  if (isEditing) {
    return (
      <div className="flex flex-nowrap items-center gap-1 absolute left-0 top-1/2 -translate-y-1/2 min-h-9 w-max min-w-full max-w-[min(20rem,calc(100vw-2rem))] bg-background p-1 z-20 rounded outline outline-2 outline-primary outline-offset-[-2px]">
        <Input
          autoFocus
          className="h-full w-full min-w-0 flex-1 border-none focus-visible:ring-0 px-2 rounded-none bg-transparent text-sm"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          disabled={isLoading}
        />
        <div className="flex flex-nowrap gap-0.5 pr-1">
             <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-green-100 hover:text-green-600"
                onClick={handleSave}
                disabled={isLoading}
              >
                <Check className="h-3 w-3" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-red-100 hover:text-red-600"
                onClick={handleCancel}
                disabled={isLoading}
              >
                <X className="h-3 w-3" />
            </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group/cell relative flex items-center justify-between min-h-[32px] px-2 py-1 rounded hover:bg-muted w-full text-sm">
      <span className="truncate flex-1 cursor-text" onClick={() => setIsEditing(true)} title={String(value)}>
         {value === null || value === "" ? <span className="text-muted-foreground italic text-xs">empty</span> : value}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover/cell:opacity-100 transition-opacity absolute right-1"
        onClick={() => setIsEditing(true)}
      >
        <Edit2 className="h-3 w-3 text-muted-foreground" />
      </Button>
    </div>
  );
}
