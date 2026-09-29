import { cn } from "./utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("ui-shimmer bg-accent rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
