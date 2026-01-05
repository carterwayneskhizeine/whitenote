import { InputMachine } from "@/components/InputMachine";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen pt-[106px] desktop:pt-0">
      <div className="desktop:block hidden sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex w-full">
          <button className="flex-1 py-4 hover:bg-secondary/50 transition-colors relative flex justify-center items-center">
            <span className="font-bold text-sm">For you</span>
            <div className="absolute bottom-0 h-1 w-14 bg-primary rounded-full" />
          </button>
          <button className="flex-1 py-4 hover:bg-secondary/50 transition-colors flex justify-center items-center">
            <span className="font-medium text-sm text-muted-foreground">Following</span>
          </button>
        </div>
      </div>

      <InputMachine />

      { /* Timeline placeholder */}
      <div className="flex flex-col">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 border-b hover:bg-muted/20 transition-colors cursor-pointer">
            <div className="flex gap-3">
              <div className="h-10 w-10 rounded-full bg-muted animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/4 bg-muted animate-pulse rounded" />
                <div className="h-16 w-full bg-muted animate-pulse rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
