import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Sync the local packaging/homebrew/Casks/kuota.rb cask to both
 * kunkunsh/homebrew-tap and HuakunShen/homebrew-tap repositories.
 */
async function syncToRepo(repo: string, content: string) {
  const base64Content = Buffer.from(content).toString("base64");
  const path = "Casks/kuota.rb";

  // Check if file exists to get sha
  const checkProc = Bun.spawn(["gh", "api", `repos/${repo}/contents/${path}`], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const checkOut = await new Response(checkProc.stdout).text();
  let existingSha: string | undefined;
  try {
    const json = JSON.parse(checkOut);
    existingSha = json.sha;
  } catch {
    // doesn't exist yet
  }

  const payload: Record<string, any> = {
    message: "feat(cask): add or update kuota cask",
    content: base64Content,
    branch: "main",
  };
  if (existingSha) {
    payload.sha = existingSha;
  }

  const putProc = Bun.spawn(
    ["gh", "api", "--method", "PUT", `repos/${repo}/contents/${path}`, "--input", "-"],
    {
      stdin: new Blob([JSON.stringify(payload)]),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const putExit = await putProc.exited;
  const putErr = await new Response(putProc.stderr).text();

  if (putExit !== 0) {
    console.error(`Failed to push to ${repo}:`, putErr);
    process.exit(putExit);
  }

  console.log(`Successfully synced Casks/kuota.rb to ${repo}!`);
}

async function main() {
  const caskPath = join(import.meta.dir, "../packaging/homebrew/Casks/kuota.rb");
  const content = readFileSync(caskPath, "utf-8");

  if (content.includes("PENDING_RELEASE_SHA")) {
    console.error(
      "Cask still has PENDING_RELEASE_SHA. Render cask with real release artifacts first.",
    );
    process.exit(1);
  }

  const targetRepos = ["kunkunsh/homebrew-tap"];
  for (const repo of targetRepos) {
    await syncToRepo(repo, content);
  }
}

main().catch(console.error);
