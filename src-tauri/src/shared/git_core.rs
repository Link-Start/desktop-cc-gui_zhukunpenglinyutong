#![allow(dead_code)]

use std::path::PathBuf;

use crate::utils::{async_command, git_env_path, resolve_git_binary};

const NON_INTERACTIVE_GIT_TIMEOUT_SECS: u64 = 120;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct FileHistoryEntry {
    pub(crate) oid: String,
    pub(crate) path: String,
}

fn format_git_error(stdout: &[u8], stderr: &[u8]) -> String {
    let stderr = String::from_utf8_lossy(stderr);
    let stdout = String::from_utf8_lossy(stdout);
    let detail = if stderr.trim().is_empty() {
        stdout.trim()
    } else {
        stderr.trim()
    };
    if detail.is_empty() {
        "Git command failed.".to_string()
    } else {
        detail.to_string()
    }
}

pub(crate) async fn run_git_command(repo_path: &PathBuf, args: &[&str]) -> Result<String, String> {
    let git_bin = resolve_git_binary().map_err(|err| format!("Failed to run git: {err}"))?;
    let output = async_command(git_bin)
        .args(args)
        .current_dir(repo_path)
        .env("PATH", git_env_path())
        .output()
        .await
        .map_err(|err| format!("Failed to run git: {err}"))?;
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
    }
    Err(format_git_error(&output.stdout, &output.stderr))
}

pub(crate) async fn run_git_command_owned(
    repo_path: PathBuf,
    args_owned: Vec<String>,
) -> Result<String, String> {
    let arg_refs = args_owned
        .iter()
        .map(|value| value.as_str())
        .collect::<Vec<_>>();
    run_git_command(&repo_path, &arg_refs).await
}

pub(crate) async fn run_git_command_owned_non_interactive(
    repo_path: PathBuf,
    args_owned: Vec<String>,
) -> Result<String, String> {
    let git_bin = resolve_git_binary().map_err(|err| format!("Failed to run git: {err}"))?;
    let command_display = format!("git {}", args_owned.join(" "));
    let mut command = async_command(git_bin);
    command
        .args(&args_owned)
        .current_dir(repo_path)
        .env("PATH", git_env_path())
        .env_remove("GH_TOKEN")
        .env_remove("GITHUB_TOKEN")
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GCM_INTERACTIVE", "never")
        .kill_on_drop(true)
        .stdin(std::process::Stdio::null());
    let output = tokio::time::timeout(
        std::time::Duration::from_secs(NON_INTERACTIVE_GIT_TIMEOUT_SECS),
        command.output(),
    )
    .await
    .map_err(|_| {
        format!(
            "Git command timed out after {NON_INTERACTIVE_GIT_TIMEOUT_SECS}s: {command_display}"
        )
    })?
    .map_err(|err| format!("Failed to run git: {err}"))?;
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
    }
    Err(format_git_error(&output.stdout, &output.stderr))
}

pub(crate) fn normalize_file_history_path(path: &str) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty()
        || trimmed.starts_with('/')
        || trimmed.starts_with('\\')
        || trimmed.as_bytes().get(1) == Some(&b':')
    {
        return Err("File history path must be repository-relative.".to_string());
    }

    let normalized = trimmed
        .replace('\\', "/")
        .trim_start_matches("./")
        .trim_end_matches('/')
        .to_string();
    if normalized.is_empty()
        || normalized
            .split('/')
            .any(|segment| segment.is_empty() || segment == "." || segment == "..")
    {
        return Err("File history path contains an invalid path segment.".to_string());
    }
    Ok(normalized)
}

pub(crate) async fn list_file_history_entries(
    repo_path: &PathBuf,
    branch: Option<&str>,
    path: &str,
) -> Result<Vec<FileHistoryEntry>, String> {
    let normalized_path = normalize_file_history_path(path)?;
    let mut args = vec![
        "log".to_string(),
        "--follow".to_string(),
        "--format=%H%x00".to_string(),
        "--name-only".to_string(),
        "-z".to_string(),
    ];
    match branch.map(str::trim).filter(|value| !value.is_empty()) {
        Some("all" | "*") => args.push("--all".to_string()),
        Some(reference) => {
            let verified_oid = run_git_command_owned(
                repo_path.clone(),
                vec![
                    "rev-parse".to_string(),
                    "--verify".to_string(),
                    "--end-of-options".to_string(),
                    format!("{reference}^{{commit}}"),
                ],
            )
            .await?;
            if verified_oid.len() != 40
                || !verified_oid.bytes().all(|byte| byte.is_ascii_hexdigit())
            {
                return Err("Git file history resolved an invalid commit id.".to_string());
            }
            args.push(verified_oid);
        }
        None => args.push("HEAD".to_string()),
    }
    args.push("--".to_string());
    args.push(normalized_path);

    let output = run_git_command_owned(repo_path.clone(), args).await?;
    let mut tokens = output.split('\0');
    let mut entries = Vec::new();
    while let Some(oid_token) = tokens.next() {
        let oid = oid_token.trim();
        if oid.is_empty() {
            continue;
        }
        if oid.len() != 40 || !oid.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err("Git file history returned an invalid commit id.".to_string());
        }

        let historical_path = tokens
            .by_ref()
            .map(str::trim)
            .find(|token| !token.is_empty())
            .ok_or_else(|| "Git file history returned no path for a commit.".to_string())?;
        entries.push(FileHistoryEntry {
            oid: oid.to_string(),
            path: historical_path.replace('\\', "/"),
        });
    }
    Ok(entries)
}

pub(crate) async fn list_file_history_oids(
    repo_path: &PathBuf,
    branch: Option<&str>,
    path: &str,
) -> Result<Vec<String>, String> {
    Ok(list_file_history_entries(repo_path, branch, path)
        .await?
        .into_iter()
        .map(|entry| entry.oid)
        .collect())
}

pub(crate) fn build_git_history_snapshot_id(
    head_sha: &str,
    branch: Option<&str>,
    query: Option<&str>,
    author: Option<&str>,
    date_from: Option<i64>,
    date_to: Option<i64>,
    repository_root: Option<&str>,
    path: Option<&str>,
) -> String {
    [
        head_sha,
        branch.unwrap_or("HEAD"),
        query.unwrap_or_default(),
        author.unwrap_or_default(),
        &date_from.unwrap_or_default().to_string(),
        &date_to.unwrap_or_default().to_string(),
        repository_root.unwrap_or_default(),
        path.unwrap_or_default(),
    ]
    .iter()
    .map(|value| format!("{}:{value}", value.len()))
    .collect::<Vec<_>>()
    .join("|")
}

pub(crate) fn push_git_history_branch_scope(
    repo: &git2::Repository,
    revwalk: &mut git2::Revwalk<'_>,
    branch: Option<&str>,
) -> Result<(), String> {
    let Some(selected_branch) = branch.map(str::trim).filter(|value| !value.is_empty()) else {
        return revwalk.push_head().map_err(|error| error.to_string());
    };

    if selected_branch.eq_ignore_ascii_case("all") || selected_branch == "*" {
        let mut has_ref = false;
        if revwalk.push_glob("refs/heads/*").is_ok() {
            has_ref = true;
        }
        if revwalk.push_glob("refs/remotes/*").is_ok() {
            has_ref = true;
        }
        return if has_ref {
            Ok(())
        } else {
            revwalk.push_head().map_err(|error| error.to_string())
        };
    }

    for reference in [
        format!("refs/heads/{selected_branch}"),
        format!("refs/remotes/{selected_branch}"),
    ] {
        if let Ok(oid) = repo.refname_to_id(&reference) {
            return revwalk.push(oid).map_err(|error| error.to_string());
        }
    }
    if let Ok(object) = repo.revparse_single(selected_branch) {
        return revwalk.push(object.id()).map_err(|error| error.to_string());
    }
    Err(format!("Branch or ref not found: {selected_branch}"))
}

pub(crate) async fn run_git_command_bytes(
    repo_path: &PathBuf,
    args: &[&str],
) -> Result<Vec<u8>, String> {
    let git_bin = resolve_git_binary().map_err(|err| format!("Failed to run git: {err}"))?;
    let output = async_command(git_bin)
        .args(args)
        .current_dir(repo_path)
        .env("PATH", git_env_path())
        .output()
        .await
        .map_err(|err| format!("Failed to run git: {err}"))?;
    if output.status.success() {
        return Ok(output.stdout);
    }
    Err(format_git_error(&output.stdout, &output.stderr))
}

pub(crate) async fn run_git_diff(repo_path: &PathBuf, args: &[&str]) -> Result<Vec<u8>, String> {
    let git_bin = resolve_git_binary().map_err(|err| format!("Failed to run git: {err}"))?;
    let output = async_command(git_bin)
        .args(args)
        .current_dir(repo_path)
        .env("PATH", git_env_path())
        .output()
        .await
        .map_err(|err| format!("Failed to run git: {err}"))?;
    if output.status.success() || output.status.code() == Some(1) {
        return Ok(output.stdout);
    }
    Err(format_git_error(&output.stdout, &output.stderr))
}

pub(crate) fn is_missing_worktree_error(error: &str) -> bool {
    error.contains("is not a working tree")
}

pub(crate) async fn git_branch_exists(repo_path: &PathBuf, branch: &str) -> Result<bool, String> {
    let git_bin = resolve_git_binary().map_err(|err| format!("Failed to run git: {err}"))?;
    let status = async_command(git_bin)
        .args(["show-ref", "--verify", &format!("refs/heads/{branch}")])
        .current_dir(repo_path)
        .env("PATH", git_env_path())
        .status()
        .await
        .map_err(|err| format!("Failed to run git: {err}"))?;
    Ok(status.success())
}

pub(crate) async fn git_remote_exists(repo_path: &PathBuf, remote: &str) -> Result<bool, String> {
    let git_bin = resolve_git_binary().map_err(|err| format!("Failed to run git: {err}"))?;
    let status = async_command(git_bin)
        .args(["remote", "get-url", remote])
        .current_dir(repo_path)
        .env("PATH", git_env_path())
        .status()
        .await
        .map_err(|err| format!("Failed to run git: {err}"))?;
    Ok(status.success())
}

pub(crate) async fn git_remote_branch_exists_live(
    repo_path: &PathBuf,
    remote: &str,
    branch: &str,
) -> Result<bool, String> {
    let git_bin = resolve_git_binary().map_err(|err| format!("Failed to run git: {err}"))?;
    let output = async_command(git_bin)
        .args([
            "ls-remote",
            "--heads",
            remote,
            &format!("refs/heads/{branch}"),
        ])
        .current_dir(repo_path)
        .env("PATH", git_env_path())
        .output()
        .await
        .map_err(|err| format!("Failed to run git: {err}"))?;
    if output.status.success() {
        return Ok(!String::from_utf8_lossy(&output.stdout).trim().is_empty());
    }
    Err(format_git_error(&output.stdout, &output.stderr))
}

pub(crate) async fn git_remote_branch_exists_local(
    repo_path: &PathBuf,
    remote: &str,
    branch: &str,
) -> Result<bool, String> {
    let git_bin = resolve_git_binary().map_err(|err| format!("Failed to run git: {err}"))?;
    let status = async_command(git_bin)
        .args([
            "show-ref",
            "--verify",
            &format!("refs/remotes/{remote}/{branch}"),
        ])
        .current_dir(repo_path)
        .env("PATH", git_env_path())
        .status()
        .await
        .map_err(|err| format!("Failed to run git: {err}"))?;
    Ok(status.success())
}

pub(crate) async fn git_list_remotes(repo_path: &PathBuf) -> Result<Vec<String>, String> {
    let output = run_git_command(repo_path, &["remote"]).await?;
    Ok(output
        .lines()
        .map(|line| line.trim())
        .filter(|line| !line.is_empty())
        .map(|line| line.to_string())
        .collect())
}

pub(crate) async fn git_find_remote_for_branch_live(
    repo_path: &PathBuf,
    branch: &str,
) -> Result<Option<String>, String> {
    if git_remote_exists(repo_path, "origin").await?
        && git_remote_branch_exists_live(repo_path, "origin", branch).await?
    {
        return Ok(Some("origin".to_string()));
    }

    for remote in git_list_remotes(repo_path).await? {
        if remote == "origin" {
            continue;
        }
        if git_remote_branch_exists_live(repo_path, &remote, branch).await? {
            return Ok(Some(remote));
        }
    }

    Ok(None)
}

pub(crate) async fn git_find_remote_tracking_branch_local(
    repo_path: &PathBuf,
    branch: &str,
) -> Result<Option<String>, String> {
    if git_remote_branch_exists_local(repo_path, "origin", branch).await? {
        return Ok(Some(format!("origin/{branch}")));
    }

    for remote in git_list_remotes(repo_path).await? {
        if remote == "origin" {
            continue;
        }
        if git_remote_branch_exists_local(repo_path, &remote, branch).await? {
            return Ok(Some(format!("{remote}/{branch}")));
        }
    }

    Ok(None)
}

pub(crate) async fn unique_branch_name_live(
    repo_path: &PathBuf,
    desired: &str,
    remote: Option<&str>,
) -> Result<(String, bool), String> {
    let mut candidate = desired.to_string();
    if desired.is_empty() {
        return Ok((candidate, false));
    }
    if !git_branch_exists(repo_path, &candidate).await?
        && match remote {
            Some(remote) => !git_remote_branch_exists_live(repo_path, remote, &candidate).await?,
            None => true,
        }
    {
        return Ok((candidate, false));
    }
    for index in 2..1000 {
        candidate = format!("{desired}-{index}");
        let local_exists = git_branch_exists(repo_path, &candidate).await?;
        let remote_exists = match remote {
            Some(remote) => git_remote_branch_exists_live(repo_path, remote, &candidate).await?,
            None => false,
        };
        if !local_exists && !remote_exists {
            return Ok((candidate, true));
        }
    }
    Err("Unable to find an available branch name.".to_string())
}

pub(crate) async fn git_get_origin_url(repo_path: &PathBuf) -> Option<String> {
    run_git_command(repo_path, &["remote", "get-url", "origin"])
        .await
        .ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;

    fn commit_tree(
        repo: &git2::Repository,
        update_ref: Option<&str>,
        message: &str,
        file_name: &str,
        parent: Option<&git2::Commit<'_>>,
    ) -> git2::Oid {
        let worktree = repo.workdir().expect("test repository worktree");
        fs::write(worktree.join(file_name), message).expect("write commit fixture");
        let mut index = repo.index().expect("open test index");
        index.add_path(Path::new(file_name)).expect("stage fixture");
        index.write().expect("write test index");
        let tree_id = index.write_tree().expect("write test tree");
        let tree = repo.find_tree(tree_id).expect("find test tree");
        let signature = git2::Signature::now("Test", "test@example.com").expect("create signature");
        let parents = parent.into_iter().collect::<Vec<_>>();
        repo.commit(update_ref, &signature, &signature, message, &tree, &parents)
            .expect("create test commit")
    }

    #[test]
    fn all_branch_scope_traverses_local_and_remote_refs() {
        let root =
            std::env::temp_dir().join(format!("ccgui-history-scope-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).expect("create test repository root");
        let repo = git2::Repository::init(&root).expect("init test repository");
        let local_oid = commit_tree(&repo, Some("HEAD"), "local", "local.txt", None);
        let local_commit = repo.find_commit(local_oid).expect("find local commit");
        let remote_oid = commit_tree(&repo, None, "remote", "remote.txt", Some(&local_commit));
        repo.reference(
            "refs/remotes/origin/remote-only",
            remote_oid,
            true,
            "test remote",
        )
        .expect("create remote tracking ref");
        drop(local_commit);

        for branch in ["all", "*"] {
            let mut revwalk = repo.revwalk().expect("create revwalk");
            push_git_history_branch_scope(&repo, &mut revwalk, Some(branch))
                .expect("push all branch scope");
            let oids = revwalk
                .map(|oid| oid.expect("walk commit"))
                .collect::<Vec<_>>();
            assert!(oids.contains(&local_oid));
            assert!(oids.contains(&remote_oid));
        }

        drop(repo);
        let _ = fs::remove_dir_all(root);
    }

    #[tokio::test]
    async fn non_interactive_git_runner_propagates_command_failure() {
        let root = std::env::temp_dir().join(format!("ccgui-pr-precheck-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).expect("create test repository root");
        git2::Repository::init(&root).expect("init test repository");

        let error = run_git_command_owned_non_interactive(
            root.clone(),
            vec!["rev-parse".to_string(), "missing-range-ref".to_string()],
        )
        .await
        .expect_err("missing revision should fail");

        assert!(!error.trim().is_empty());
        let _ = fs::remove_dir_all(root);
    }
}
