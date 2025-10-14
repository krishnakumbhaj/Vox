// components/Loader.tsx
import Loader2 from './Loader_global' // or your icon
import React from "react";

const Loader = () => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
      <Loader2 />
    </div>
  );
};

export default Loader;
