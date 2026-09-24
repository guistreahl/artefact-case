import { cookies } from "next/headers";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { TaskList } from "@/components/TaskList";
import { Welcome } from "@/components/Welcome";
import { PAGE_SIZE, WELCOME_COOKIE } from "@/lib/constants";
import { getQueryClient, trpc } from "@/trpc/server";

// The list depends on each visitor's cookie. Without this line, Next could
// try to render the page only once, at build time.
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ help?: string }> };

export default async function ListPage({ searchParams }: Props) {
  const { help } = await searchParams;
  const welcomeSeen = (await cookies()).has(WELCOME_COOKIE);

  // SSR: the first page is fetched here, on the server, and goes out in the
  // HTML. HydrationBoundary hands the same data to the client cache, which
  // continues the scroll from it without fetching again.
  const queryClient = getQueryClient();
  await queryClient.prefetchInfiniteQuery(
    trpc.tasks.list.infiniteQueryOptions({ limit: PAGE_SIZE }, { getNextPageParam: (page) => page.nextCursor }),
  );

  return (
    <>
      <Welcome initiallyOpen={!welcomeSeen || help === "1"} />
      <h1 className="page-title mb-6">Your tasks</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <TaskList />
      </HydrationBoundary>
    </>
  );
}
