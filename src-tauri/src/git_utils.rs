use std::collections::HashSet;
use std::path::{Component, Path, PathBuf};

use git2::{BranchType, DiffOptions, ErrorCode, Repository, Status, StatusOptions, Tree};
use ignore::WalkBuilder;

use crate::types::{GitLogEntry, GitRepositoryFileStatus, GitRepositorySummary, WorkspaceEntry};
use crate::utils::normalize_git_path;

pub(crate) fn image_mime_type(path: &str) -> Option<&'static str> {
    let ext = Path::new(path)
        .extension()
        .and_then(|value| value.to_str())?
        .to_ascii_lowercase();
    match ext.as_str() {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        "svg" => Some("image/svg+xml"),
        "bmp" => Some("image/bmp"),
        "ico" => Some("image/x-icon"),
        _ => None,
    }
}

pub(crate) fn commit_to_entry(commit: git2::Commit) -> GitLogEntry {
    let summary = commit.summary().unwrap_or("").to_string();
    let author = commit.author().name().unwrap_or("").to_string();
    let timestamp = commit.time().seconds();
    GitLogEntry {
        sha: commit.id().to_string(),
        summary,
        author,
        timestamp,
    }
}

pub(crate) fn checkout_branch(repo: &Repository, name: &str) -> Result<(), git2::Error> {
    let refname = format!("refs/heads/{name}");
    repo.set_head(&refname)?;
    let mut options = git2::build::CheckoutBuilder::new();
    options.safe();
    repo.checkout_head(Some(&mut options))?;
    Ok(())
}

pub(crate) fn diff_stats_for_path(
    repo: &Repository,
    head_tree: Option<&Tree>,
    path: &str,
    include_index: bool,
    include_workdir: bool,
) -> Result<(i64, i64), git2::Error> {
    let mut additions = 0i64;
    let mut deletions = 0i64;

    if include_index {
        let mut options = DiffOptions::new();
        options.pathspec(path).include_untracked(true);
        let diff = repo.diff_tree_to_index(head_tree, None, Some(&mut options))?;
        let stats = diff.stats()?;
        additions += stats.insertions() as i64;
        deletions += stats.deletions() as i64;
    }

    if include_workdir {
        let mut options = DiffOptions::new();
        options
            .pathspec(path)
            .include_untracked(true)
            .recurse_untracked_dirs(true)
            .show_untracked_content(true);
        let diff = repo.diff_index_to_workdir(None, Some(&mut options))?;
        let stats = diff.stats()?;
        additions += stats.insertions() as i64;
        deletions += stats.deletions() as i64;
    }

    Ok((additions, deletions))
}

pub(crate) fn diff_patch_to_string(patch: &mut git2::Patch) -> Result<String, git2::Error> {
    let buf = patch.to_buf()?;
    Ok(buf
        .as_str()
        .map(|value| value.to_string())
        .unwrap_or_else(|| String::from_utf8_lossy(&buf).to_string()))
}

#[cfg(test)]
mod tests {
    use super::{
        compact_repository_status, image_mime_type, list_git_repository_summaries,
        path_has_git_repository_marker, resolve_git_root_for_scope,
    };
    use crate::types::{WorkspaceEntry, WorkspaceKind, WorkspaceSettings};
    use git2::{Repository, Signature};
    use std::fs;

    fn workspace_entry(path: &std::path::Path) -> WorkspaceEntry {
        WorkspaceEntry {
            id: "workspace".to_string(),
            name: "Workspace".to_string(),
            path: path.display().to_string(),
            codex_bin: None,
            kind: WorkspaceKind::Main,
            parent_id: None,
            worktree: None,
            settings: WorkspaceSettings::default(),
        }
    }

    fn commit_initial_file(repo: &Repository, root: &std::path::Path) {
        fs::write(root.join("tracked.txt"), "tracked").expect("write tracked file");
        let mut index = repo.index().expect("open index");
        index
            .add_path(std::path::Path::new("tracked.txt"))
            .expect("stage tracked file");
        index.write().expect("write index");
        let tree_id = index.write_tree().expect("write tree");
        let tree = repo.find_tree(tree_id).expect("find tree");
        let signature = Signature::now("Moss Test", "moss@example.test").expect("signature");
        repo.commit(Some("HEAD"), &signature, &signature, "initial", &tree, &[])
            .expect("initial commit");
    }

    #[test]
    fn image_mime_type_detects_known_extensions() {
        assert_eq!(image_mime_type("icon.PNG"), Some("image/png"));
        assert_eq!(image_mime_type("photo.jpeg"), Some("image/jpeg"));
        assert_eq!(image_mime_type("vector.SVG"), Some("image/svg+xml"));
        assert_eq!(image_mime_type("glyph.ico"), Some("image/x-icon"));
        assert_eq!(image_mime_type("readme.txt"), None);
    }

    #[test]
    fn path_has_git_repository_marker_accepts_git_dir_and_file() {
        let root = std::env::temp_dir().join(format!("ccgui-git-utils-{}", uuid::Uuid::new_v4()));
        let dir_repo = root.join("dir-repo");
        let file_repo = root.join("file-repo");
        let plain_dir = root.join("plain-dir");

        fs::create_dir_all(dir_repo.join(".git")).expect("create dir repo marker");
        fs::create_dir_all(&file_repo).expect("create file repo root");
        fs::write(file_repo.join(".git"), "gitdir: /tmp/worktree/.git")
            .expect("write file repo marker");
        fs::create_dir_all(&plain_dir).expect("create plain dir");

        assert!(path_has_git_repository_marker(&dir_repo));
        assert!(path_has_git_repository_marker(&file_repo));
        assert!(!path_has_git_repository_marker(&plain_dir));

        fs::remove_dir_all(&root).expect("cleanup temp git utils root");
    }

    #[test]
    fn scoped_git_root_is_cross_platform_and_stays_inside_workspace() {
        let root = std::env::temp_dir().join(format!("ccgui-git-scope-{}", uuid::Uuid::new_v4()));
        let nested = root.join("nested").join("repo");
        let plain = root.join("plain");
        fs::create_dir_all(&root).expect("create workspace");
        Repository::init(&root).expect("init root repo");
        fs::create_dir_all(&nested).expect("create nested repo");
        Repository::init(&nested).expect("init nested repo");
        fs::create_dir_all(&plain).expect("create plain folder");
        let entry = workspace_entry(&root);

        assert_eq!(
            resolve_git_root_for_scope(&entry, Some("nested/repo")).expect("slash scope"),
            nested.canonicalize().expect("canonical nested")
        );
        assert_eq!(
            resolve_git_root_for_scope(&entry, Some("nested\\repo")).expect("backslash scope"),
            nested.canonicalize().expect("canonical nested")
        );
        assert!(resolve_git_root_for_scope(&entry, Some("../outside")).is_err());
        assert!(resolve_git_root_for_scope(&entry, Some("/tmp/outside")).is_err());
        assert!(resolve_git_root_for_scope(&entry, Some("C:\\outside")).is_err());
        assert!(resolve_git_root_for_scope(&entry, Some("plain")).is_err());

        fs::remove_dir_all(&root).expect("cleanup scoped root");
    }

    #[test]
    fn repository_summaries_cover_root_nested_and_dirty_state() {
        let root = std::env::temp_dir().join(format!("ccgui-git-summary-{}", uuid::Uuid::new_v4()));
        let nested = root.join("packages").join("child");
        let sibling = root.join("packages").join("sibling");
        let corrupt = root.join("packages").join("corrupt");
        fs::create_dir_all(&nested).expect("create roots");
        fs::create_dir_all(&sibling).expect("create sibling root");
        fs::create_dir_all(corrupt.join(".git")).expect("create corrupt marker");
        let root_repo = Repository::init(&root).expect("init root repo");
        commit_initial_file(&root_repo, &root);
        let child_repo = Repository::init(&nested).expect("init child repo");
        commit_initial_file(&child_repo, &nested);
        fs::write(nested.join("untracked.txt"), "dirty").expect("write untracked file");
        let sibling_repo = Repository::init(&sibling).expect("init sibling repo");
        commit_initial_file(&sibling_repo, &sibling);
        fs::write(sibling.join("tracked.txt"), "modified").expect("modify sibling file");

        let summaries = list_git_repository_summaries(&root, 4, 16);
        assert_eq!(summaries.len(), 4);
        assert_eq!(summaries[0].repository_root, "");
        assert!(!summaries[0].is_clean);
        let child = summaries
            .iter()
            .find(|summary| summary.repository_root == "packages/child")
            .expect("child summary");
        assert_eq!(child.untracked_count, 1);
        assert_eq!(
            child.file_statuses,
            vec![crate::types::GitRepositoryFileStatus {
                path: "untracked.txt".to_string(),
                status: "A".to_string(),
            }]
        );
        assert!(!child.is_clean);
        let sibling_summary = summaries
            .iter()
            .find(|summary| summary.repository_root == "packages/sibling")
            .expect("sibling summary");
        assert_eq!(sibling_summary.modified_count, 1);
        assert_eq!(sibling_summary.file_statuses[0].path, "tracked.txt");
        assert_eq!(sibling_summary.file_statuses[0].status, "M");
        let unavailable = summaries
            .iter()
            .find(|summary| summary.repository_root == "packages/corrupt")
            .expect("corrupt summary");
        assert_eq!(unavailable.head_state, "unavailable");
        assert!(unavailable.error.is_some());
        assert!(unavailable.file_statuses.is_empty());

        fs::remove_dir_all(&root).expect("cleanup summary root");
    }

    #[test]
    fn compact_repository_status_prefers_conflict_and_worktree_state() {
        assert_eq!(
            compact_repository_status(git2::Status::CONFLICTED),
            Some("U")
        );
        assert_eq!(compact_repository_status(git2::Status::WT_NEW), Some("A"));
        assert_eq!(
            compact_repository_status(git2::Status::WT_DELETED),
            Some("D")
        );
        assert_eq!(
            compact_repository_status(git2::Status::INDEX_RENAMED),
            Some("R")
        );
        assert_eq!(
            compact_repository_status(git2::Status::INDEX_TYPECHANGE),
            Some("T")
        );
        assert_eq!(compact_repository_status(git2::Status::CURRENT), None);
    }
}

pub(crate) fn parse_github_repo(remote_url: &str) -> Option<String> {
    let trimmed = remote_url.trim();
    if trimmed.is_empty() {
        return None;
    }
    let mut path = if trimmed.starts_with("git@github.com:") {
        trimmed.trim_start_matches("git@github.com:").to_string()
    } else if trimmed.starts_with("ssh://git@github.com/") {
        trimmed
            .trim_start_matches("ssh://git@github.com/")
            .to_string()
    } else if let Some(index) = trimmed.find("github.com/") {
        trimmed[index + "github.com/".len()..].to_string()
    } else {
        return None;
    };
    path = path
        .trim_end_matches(".git")
        .trim_end_matches('/')
        .to_string();
    if path.is_empty() {
        None
    } else {
        Some(path)
    }
}

pub(crate) fn resolve_git_root(entry: &WorkspaceEntry) -> Result<PathBuf, String> {
    let base = PathBuf::from(&entry.path);
    let root = entry
        .settings
        .git_root
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty());
    let Some(root) = root else {
        return Ok(base);
    };
    let root_path = if Path::new(root).is_absolute() {
        PathBuf::from(root)
    } else {
        base.join(root)
    };
    if root_path.is_dir() {
        Ok(root_path)
    } else {
        Err(format!("Git root not found: {root}"))
    }
}

pub(crate) fn resolve_git_root_for_scope(
    entry: &WorkspaceEntry,
    repository_root: Option<&str>,
) -> Result<PathBuf, String> {
    let Some(repository_root) = repository_root else {
        return resolve_git_root(entry);
    };
    let base = PathBuf::from(&entry.path);
    let normalized = repository_root.trim().replace('\\', "/");
    let has_windows_prefix = normalized
        .as_bytes()
        .get(1)
        .is_some_and(|separator| *separator == b':');
    if normalized.starts_with('/') || has_windows_prefix {
        return Err("Invalid Git repository root: absolute paths are not allowed.".to_string());
    }
    let relative = Path::new(&normalized);
    if relative.components().any(|component| {
        matches!(
            component,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        )
    }) {
        return Err("Invalid Git repository root: path traversal is not allowed.".to_string());
    }
    let candidate = if normalized.is_empty() {
        base.clone()
    } else {
        base.join(relative)
    };
    let canonical_base = base
        .canonicalize()
        .map_err(|error| format!("Failed to resolve workspace Git root: {error}"))?;
    let canonical_candidate = candidate
        .canonicalize()
        .map_err(|error| format!("Git repository root not found: {error}"))?;
    if !canonical_candidate.starts_with(&canonical_base) {
        return Err(
            "Invalid Git repository root: path resolves outside the workspace.".to_string(),
        );
    }
    if !path_has_git_repository_marker(&canonical_candidate) {
        return Err("Git repository root does not contain a .git marker.".to_string());
    }
    Ok(canonical_candidate)
}

pub(crate) fn path_has_git_repository_marker(path: &Path) -> bool {
    path.join(".git").is_dir() || path.join(".git").is_file()
}

fn should_skip_dir(name: &str) -> bool {
    matches!(
        name,
        ".git" | "node_modules" | "dist" | "target" | "release-artifacts"
    )
}

pub(crate) fn list_git_roots(root: &Path, max_depth: usize, max_results: usize) -> Vec<String> {
    if !root.is_dir() {
        return Vec::new();
    }

    let mut results = Vec::new();
    let mut seen = HashSet::new();
    let max_depth = max_depth.max(1);
    let walker = WalkBuilder::new(root)
        .hidden(false)
        .follow_links(false)
        .max_depth(Some(max_depth))
        .filter_entry(|entry| {
            if entry.depth() == 0 {
                return true;
            }
            if entry.file_type().is_some_and(|ft| ft.is_dir()) {
                let name = entry.file_name().to_string_lossy();
                if should_skip_dir(&name) {
                    return false;
                }
            }
            true
        })
        .build();

    for entry in walker {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        if !entry.file_type().is_some_and(|ft| ft.is_dir()) {
            continue;
        }
        if entry.depth() == 0 {
            continue;
        }
        let candidate = entry.path();
        let git_marker = candidate.join(".git");
        if !git_marker.is_dir() && !git_marker.is_file() {
            continue;
        }
        let rel = match candidate.strip_prefix(root) {
            Ok(rel) => rel,
            Err(_) => continue,
        };
        let normalized = normalize_git_path(&rel.to_string_lossy());
        if normalized.is_empty() || !seen.insert(normalized.clone()) {
            continue;
        }
        results.push(normalized);
        if results.len() >= max_results {
            break;
        }
    }

    results.sort();
    results
}

fn repository_display_name(repo_root: &Path) -> String {
    repo_root
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or(".")
        .to_string()
}

fn unavailable_repository_summary(
    repository_root: String,
    repo_root: &Path,
    error: String,
) -> GitRepositorySummary {
    GitRepositorySummary {
        repository_root,
        display_name: repository_display_name(repo_root),
        current_branch: None,
        head_state: "unavailable".to_string(),
        upstream: None,
        ahead: 0,
        behind: 0,
        staged_count: 0,
        modified_count: 0,
        untracked_count: 0,
        conflicted_count: 0,
        file_statuses: Vec::new(),
        is_clean: false,
        error: Some(error),
    }
}

fn compact_repository_status(status: Status) -> Option<&'static str> {
    if status.contains(Status::CONFLICTED) {
        return Some("U");
    }
    if status.contains(Status::WT_NEW) {
        return Some("A");
    }
    if status.contains(Status::WT_DELETED) {
        return Some("D");
    }
    if status.contains(Status::WT_RENAMED) {
        return Some("R");
    }
    if status.contains(Status::WT_TYPECHANGE) {
        return Some("T");
    }
    if status.contains(Status::WT_MODIFIED) {
        return Some("M");
    }
    if status.contains(Status::INDEX_NEW) {
        return Some("A");
    }
    if status.contains(Status::INDEX_DELETED) {
        return Some("D");
    }
    if status.contains(Status::INDEX_RENAMED) {
        return Some("R");
    }
    if status.contains(Status::INDEX_TYPECHANGE) {
        return Some("T");
    }
    if status.contains(Status::INDEX_MODIFIED) {
        return Some("M");
    }
    None
}

pub(crate) fn git_repository_summary(
    workspace_root: &Path,
    repository_root: &str,
) -> GitRepositorySummary {
    let repo_root = if repository_root.is_empty() {
        workspace_root.to_path_buf()
    } else {
        workspace_root.join(repository_root)
    };
    let repo = match Repository::open_ext(
        &repo_root,
        git2::RepositoryOpenFlags::NO_SEARCH,
        std::iter::empty::<&Path>(),
    ) {
        Ok(repo) => repo,
        Err(error) => {
            return unavailable_repository_summary(
                repository_root.to_string(),
                &repo_root,
                format!("Failed to open Git repository: {error}"),
            )
        }
    };

    let (current_branch, head_state, head_error) = match repo.head() {
        Ok(head) if head.is_branch() => (
            head.shorthand().map(ToOwned::to_owned),
            "branch".to_string(),
            None,
        ),
        Ok(_) => (None, "detached".to_string(), None),
        Err(error) if error.code() == ErrorCode::UnbornBranch => (None, "unborn".to_string(), None),
        Err(error) => (
            None,
            "unavailable".to_string(),
            Some(format!("Failed to resolve Git HEAD: {error}")),
        ),
    };

    let mut upstream = None;
    let mut ahead = 0;
    let mut behind = 0;
    if let Some(branch_name) = current_branch.as_deref() {
        if let Ok(branch) = repo.find_branch(branch_name, BranchType::Local) {
            if let Ok(upstream_branch) = branch.upstream() {
                upstream = upstream_branch
                    .get()
                    .shorthand()
                    .map(ToOwned::to_owned)
                    .or_else(|| upstream_branch.get().name().map(ToOwned::to_owned));
                if let (Some(local_oid), Some(upstream_oid)) =
                    (branch.get().target(), upstream_branch.get().target())
                {
                    if let Ok((ahead_count, behind_count)) =
                        repo.graph_ahead_behind(local_oid, upstream_oid)
                    {
                        ahead = ahead_count;
                        behind = behind_count;
                    }
                }
            }
        }
    }

    let mut options = StatusOptions::new();
    options
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);
    let statuses = match repo.statuses(Some(&mut options)) {
        Ok(statuses) => statuses,
        Err(error) => {
            return unavailable_repository_summary(
                repository_root.to_string(),
                &repo_root,
                format!("Failed to read Git status: {error}"),
            )
        }
    };
    let mut staged_count = 0;
    let mut modified_count = 0;
    let mut untracked_count = 0;
    let mut conflicted_count = 0;
    let mut file_statuses = Vec::with_capacity(statuses.len());
    for entry in statuses.iter() {
        let status = entry.status();
        if let (Some(path), Some(compact_status)) =
            (entry.path(), compact_repository_status(status))
        {
            let normalized_path = normalize_git_path(path);
            if !normalized_path.is_empty() {
                file_statuses.push(GitRepositoryFileStatus {
                    path: normalized_path,
                    status: compact_status.to_string(),
                });
            }
        }
        if status.contains(Status::CONFLICTED) {
            conflicted_count += 1;
        }
        if status.intersects(
            Status::INDEX_NEW
                | Status::INDEX_MODIFIED
                | Status::INDEX_DELETED
                | Status::INDEX_RENAMED
                | Status::INDEX_TYPECHANGE,
        ) {
            staged_count += 1;
        }
        if status.contains(Status::WT_NEW) {
            untracked_count += 1;
        } else if status.intersects(
            Status::WT_MODIFIED | Status::WT_DELETED | Status::WT_RENAMED | Status::WT_TYPECHANGE,
        ) {
            modified_count += 1;
        }
    }
    let is_clean =
        staged_count == 0 && modified_count == 0 && untracked_count == 0 && conflicted_count == 0;

    GitRepositorySummary {
        repository_root: repository_root.to_string(),
        display_name: repository_display_name(&repo_root),
        current_branch,
        head_state,
        upstream,
        ahead,
        behind,
        staged_count,
        modified_count,
        untracked_count,
        conflicted_count,
        file_statuses,
        is_clean,
        error: head_error,
    }
}

pub(crate) fn list_git_repository_summaries(
    workspace_root: &Path,
    max_depth: usize,
    max_results: usize,
) -> Vec<GitRepositorySummary> {
    if !workspace_root.is_dir() || max_results == 0 {
        return Vec::new();
    }
    let mut roots = Vec::new();
    if path_has_git_repository_marker(workspace_root) {
        roots.push(String::new());
    }
    let remaining = max_results.saturating_sub(roots.len());
    if remaining > 0 {
        roots.extend(list_git_roots(workspace_root, max_depth, remaining));
    }
    roots
        .iter()
        .map(|repository_root| git_repository_summary(workspace_root, repository_root))
        .collect()
}
