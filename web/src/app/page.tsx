import { Experience } from "@/components/world/Experience";
import { SmoothScrollProvider } from "@/components/SmoothScrollProvider";

export default function Home() {
  return (
    <SmoothScrollProvider>
      <main className="relative h-screen w-screen overflow-hidden bg-[#08070a]">
        <Experience />
      </main>
    </SmoothScrollProvider>
  );
}
