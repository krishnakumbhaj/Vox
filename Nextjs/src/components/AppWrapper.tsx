// components/AppWrapper.tsx
'use client';

import Loader from "@/components/Loader";
import { useLoading } from "@/app/context/LoadingContext";

const AppWrapper = ({ children }: { children: React.ReactNode }) => {
  const { loading } = useLoading();

  return (
    <>
      {loading && <Loader />}
      {children}
    </>
  );
};

export default AppWrapper;
