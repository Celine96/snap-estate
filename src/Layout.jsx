import { Toaster } from "@/components/ui/sonner";

export default function Layout({ children }) {
  return (
    <div>
      {children}
      <Toaster position="top-center" richColors />
    </div>
  );
}