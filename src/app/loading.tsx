import Image from "next/image";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <Image
        src="/logo.png"
        alt="HOOHR"
        width={64}
        height={64}
        className="animate-pulse"
        priority
      />
    </div>
  );
}
