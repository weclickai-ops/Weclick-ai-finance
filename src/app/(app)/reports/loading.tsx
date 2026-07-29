import { PageSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return <PageSkeleton stats={4} rows={6} action={true} />;
}
