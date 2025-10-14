"use client";

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  chatTitle?: string;
}

export const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  chatTitle
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="bg-[#30302e] rounded-2xl shadow-2xl max-w-md w-full pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 ">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-white">Delete Chat</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:text-red-600 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-zinc-400 hover:text-red-500" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6">
            <p className="text-zinc-300 ">
              Are you sure you want to delete this chat?
            </p>
            {chatTitle && (
              <p className="text-zinc-400 text-sm mt-2">
                &quot;{chatTitle}&quot;
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 ">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-700 hover:bg-zinc-600 rounded-3xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-3xl transition-colors"
            >
              Delete Chat
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
