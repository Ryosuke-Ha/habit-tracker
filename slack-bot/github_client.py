from github import Github, GithubException

from config import GITHUB_REPO, GITHUB_TOKEN


class GitHubClient:
    def __init__(self):
        self.g = Github(GITHUB_TOKEN)
        self.repo = self.g.get_repo(GITHUB_REPO)

    def get_file_content(self, file_path: str, branch: str = "main") -> dict:
        try:
            content = self.repo.get_contents(file_path, ref=branch)
            return {
                "path": file_path,
                "content": content.decoded_content.decode("utf-8"),
                "sha": content.sha,
            }
        except GithubException as e:
            return {"error": str(e)}

    def list_files(self, directory: str) -> dict:
        try:
            contents = self.repo.get_contents(directory)
            if not isinstance(contents, list):
                contents = [contents]
            return {"files": [c.path for c in contents]}
        except GithubException as e:
            return {"error": str(e)}

    def search_code(self, query: str) -> dict:
        try:
            results = self.g.search_code(f"{query} repo:{GITHUB_REPO}")
            items = [{"path": r.path, "url": r.html_url} for r in results[:10]]
            return {"results": items}
        except GithubException as e:
            return {"error": str(e)}

    def create_branch(self, branch_name: str, from_branch: str = "main") -> dict:
        try:
            source = self.repo.get_branch(from_branch)
            self.repo.create_git_ref(
                ref=f"refs/heads/{branch_name}",
                sha=source.commit.sha,
            )
            return {"ok": True, "branch": branch_name}
        except GithubException as e:
            return {"error": str(e)}

    def create_or_update_file(
        self, file_path: str, content: str, commit_message: str, branch: str
    ) -> dict:
        try:
            encoded = content.encode("utf-8")
            try:
                existing = self.repo.get_contents(file_path, ref=branch)
                result = self.repo.update_file(
                    file_path, commit_message, encoded, existing.sha, branch=branch
                )
                return {"ok": True, "action": "updated", "commit": result["commit"].sha}
            except GithubException:
                result = self.repo.create_file(
                    file_path, commit_message, encoded, branch=branch
                )
                return {"ok": True, "action": "created", "commit": result["commit"].sha}
        except GithubException as e:
            return {"error": str(e)}

    def create_pull_request(
        self, title: str, body: str, branch: str, base: str = "main"
    ) -> dict:
        try:
            pr = self.repo.create_pull(title=title, body=body, head=branch, base=base)
            return {"ok": True, "pr_number": pr.number, "url": pr.html_url}
        except GithubException as e:
            return {"error": str(e)}

    def get_pr_status(self, pr_number: int) -> dict:
        try:
            pr = self.repo.get_pull(pr_number)
            head_sha = pr.head.sha
            check_runs = list(self.repo.get_commit(head_sha).get_check_runs())

            if not check_runs:
                return {
                    "pr_number": pr_number,
                    "state": pr.state,
                    "merged": pr.merged,
                    "ci_status": "pending",
                    "check_runs": [],
                }

            run_info = [
                {"name": cr.name, "status": cr.status, "conclusion": cr.conclusion}
                for cr in check_runs
            ]
            all_completed = all(cr.status == "completed" for cr in check_runs)
            if all_completed:
                if all(cr.conclusion == "success" for cr in check_runs):
                    ci_status = "success"
                elif any(
                    cr.conclusion in ("failure", "cancelled", "timed_out")
                    for cr in check_runs
                ):
                    ci_status = "failure"
                else:
                    ci_status = "pending"
            else:
                ci_status = "pending"

            return {
                "pr_number": pr_number,
                "state": pr.state,
                "merged": pr.merged,
                "ci_status": ci_status,
                "check_runs": run_info,
            }
        except GithubException as e:
            return {"error": str(e)}

    def merge_pull_request(self, pr_number: int) -> dict:
        try:
            pr = self.repo.get_pull(pr_number)
            result = pr.merge(merge_method="squash")
            return {"ok": result.merged, "message": result.message}
        except GithubException as e:
            return {"error": str(e)}
