import { verifySession } from "@/lib/dal";
import { env } from "@/env";
import { reposLeftToIndex } from "@/server/repo-indexer";
import { listRepos } from "@/server/repos";
import { ProjectsView } from "./projects-view";

// Indexing runs one repo per server action call from this page; a big repo can take a while.
export const maxDuration = 300;

export default async function ProjectsPage() {
  const { user } = await verifySession();
  const [repos, toIndex] = await Promise.all([listRepos(user.id), reposLeftToIndex(user.id)]);
  return <ProjectsView repos={repos} toIndex={toIndex} installUrl={`https://github.com/apps/${env().GITHUB_APP_SLUG}/installations/new`} login={user.name} />;
}
