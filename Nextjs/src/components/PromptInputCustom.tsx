"use client"

import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input"
import { Button } from "@/components/ui/button"
import { ArrowUp, Square } from "lucide-react"

interface PromptInputCustomProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  isLoading: boolean;
  disabled: boolean;
  placeholder?: string;
}

export function PromptInputCustom({
  value,
  onValueChange,
  onSubmit,
  onStop,
  isLoading,
  disabled,
  placeholder = "Ask something about your database..."
}: PromptInputCustomProps) {
  const handleSubmit = () => {
    if (isLoading && onStop) {
      onStop();
    } else if (!disabled && !isLoading && value.trim()) {
      onSubmit();
    }
  };

  return (
    <div className={`relative w-full ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <PromptInput
        value={value}
        onValueChange={onValueChange}
        isLoading={isLoading}
        onSubmit={handleSubmit}
        className="w-full !border-none !shadow-none"
      >
        <PromptInputTextarea 
          placeholder={placeholder}
          disabled={disabled}
          className=" text-white border-none outline-none focus:border-none focus:outline-none focus-visible:ring-0 rounded-2xl resize-none min-h-[56px] pr-16 py-4 px-4 disabled:opacity-50"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#ff9542 #30302e'
          }}
        />
        <PromptInputActions className="justify-end pt-2">
          <PromptInputAction
            tooltip={isLoading ? "Stop generation" : "Send message"}
          >
            <Button
              variant="default"
              size="icon"
              className="h-10 w-10 rounded-xl bg-[#ff4866] hover:bg-[#ff6b7d] transition-all duration-200 disabled:opacity-50"
              onClick={handleSubmit}
              disabled={disabled || (!isLoading && !value.trim())}
            >
              {isLoading ? (
                <Square className="size-6 fill-current text-white" />
              ) : (
                <ArrowUp className="size-10  text-white" />
              )}
            </Button>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>
    </div>
  )
}
